import {
    DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
    estimateTextTokens,
    generateCarryoverSummary,
    loadConversationMemory,
    shouldRollOverConversation
} from '$lib/server/chat/conversation-memory';
import {
    createChatToolRegistry,
    toGeminiFunctionResponsePart,
    type ChatToolSource
} from '$lib/server/chat/tool-registry';
import {
    extractGeminiFunctionCalls,
    geminiContentToText,
    generateGeminiContent,
    streamGeminiContent,
    type GeminiContent
} from '$lib/server/llm/gemini';
import {
    commitConversationTurn,
    ConversationCommitConflictError,
    resolveCurrentConversation,
    type ConversationHandle
} from '$lib/server/repos/conversation-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import {
    createChatErrorLogPayload,
    logChatError,
    logChatInfo,
    logChatWarn,
    summarizeGeminiUsage
} from '$lib/server/telemetry/chat-logger';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import { buildSpecialOccasionSystemInstruction } from '@jacoblincool/agent';
import type { Firestore } from 'fires2rest';

type SendSseFn = (event: string, data: unknown) => void;

type StreamChatInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
    requestId: string;
    user: {
        uid: string;
        isAnonymous: boolean;
    };
    locale: string;
    message: string;
    send: SendSseFn;
};

const MAX_TOOL_ROUNDS_PER_TURN = 8;

const createTurnId = () => `turn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const createTraceId = () => `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const createContextBundleId = () => `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildSystemInstruction = ({
    locale,
    siteIndexText,
    carryoverSummary
}: {
    locale: string;
    siteIndexText: string;
    carryoverSummary: string | null;
}) =>
    [
        'You are Jacob Lin website assistant.',
        'Answer only from verified site knowledge and tool outputs from this turn.',
        'Start from the published site index, then call site tools when the user needs section-level or item-level detail.',
        'Answer at the same level of abstraction as the user question. If the user asks for concrete things such as projects, papers, tools, repositories, examples, or things Jacob has built, answer with concrete named items first.',
        'Use internal site structure only to locate information. Do not answer with collection names, category names, or taxonomy labels unless the user explicitly asks about structure or categories.',
        "Prefer site tools for stable framing. Use GitHub tools when the user asks about Jacob's longer engineering history, repository or source-code details, or project discovery. Use other live tools only for freshness or profile metrics that are not fully covered by the site bundle.",
        'When the user asks about what is recent, current, latest, or being worked on now, prefer the most recent grounded information available. Use live tools when recency matters and the site bundle is not enough.',
        'If a tool says information is missing or disabled, explain that boundary directly instead of guessing.',
        'Treat the conversation like a user interview with Jacob. Answer as the interviewee, not as a report generator.',
        'Do not dump everything at once. Reveal information progressively: one layer first, then let the user steer deeper with follow-up questions.',
        'Keep answers compact by default: usually 2 to 4 short sentences or one short paragraph. Avoid long bullet lists unless the user explicitly asks for a full breakdown.',
        'When the question is broad, give a small framing answer and at most 1 to 3 key points. Do not proactively enumerate every section, project, or publication unless asked.',
        'Prefer natural spoken phrasing over polished summaries. It is acceptable to sound partial, conversational, and incremental as long as the answer stays grounded and clear.',
        'After answering, ask at most one narrow follow-up question that stays on the same topic. Do not redirect the conversation into a broader framing unless the user asks for it.',
        buildSpecialOccasionSystemInstruction(new Date()),
        locale === 'zh-tw'
            ? 'Reply in Traditional Chinese by default unless the user clearly uses another language.'
            : 'Reply in the user language when clear; otherwise default to English.',
        carryoverSummary
            ? `Conversation carryover from earlier chapters:\n${carryoverSummary}`
            : '',
        siteIndexText
    ]
        .filter(Boolean)
        .join('\n\n');

const buildToolEventPayload = (tool: ChatToolSource, target: string, label: string) => ({
    type: 'tool_call',
    tool,
    target,
    label
});

const toUserPromptContent = (text: string): GeminiContent => ({
    role: 'user',
    parts: [{ text }]
});

const buildPendingToolCallPreview = (name: string, args: Record<string, unknown>) => {
    const target =
        (typeof args.id === 'string' && args.id.trim()) ||
        (typeof args.projectId === 'string' && args.projectId.trim()) ||
        (typeof args.repoFullName === 'string' && args.repoFullName.trim()) ||
        name;

    const labelMap: Record<string, string> = {
        get_knowledge_root: 'Reading knowledge root',
        get_knowledge_node: 'Reading knowledge node',
        get_knowledge_item: 'Reading knowledge item',
        get_github_profile: 'Reading GitHub profile',
        get_github_repositories: 'Reading GitHub repositories',
        get_github_repo_detail: 'Reading GitHub repository details',
        get_huggingface_profile: 'Reading Hugging Face profile',
        get_huggingface_model_detail: 'Reading Hugging Face model details',
        get_huggingface_space_detail: 'Reading Hugging Face Space details'
    };

    return {
        target,
        label: labelMap[name] ?? `Reading ${name}`
    };
};

export const streamChatTurn = async ({
    db,
    fetchFn,
    config,
    externalToolConfig,
    requestId,
    user,
    locale,
    message,
    send
}: StreamChatInput) => {
    const trimmed = message.trim();
    if (!trimmed) {
        throw new Error('Message cannot be empty.');
    }

    const turnId = createTurnId();
    const traceId = createTraceId();
    const turnStartedAt = Date.now();
    const userContextTokens = estimateTextTokens(trimmed);
    const conversation = await resolveCurrentConversation(db, {
        ownerUid: user.uid,
        ownerType: user.isAnonymous ? 'anonymous' : 'google',
        locale
    });

    logChatInfo('chat_turn_started', {
        requestId,
        traceId,
        turnId,
        ownerType: user.isAnonymous ? 'anonymous' : 'google',
        locale,
        conversationId: conversation.conversationId,
        conversationContextTokens: conversation.contextTokenCount,
        carryoverSummaryPresent: Boolean(conversation.carryoverSummary),
        continuedFromConversationId: conversation.continuedFromConversationId,
        userMessageChars: trimmed.length,
        estimatedUserTokens: userContextTokens
    });

    let rolloverPlan: {
        archivedReason: 'context_limit';
        carryoverSummary: string | null;
        carryoverContextTokenCount: number;
        archivedConversationId: string;
        archivedConversationContextTokens: number;
    } | null = null;

    if (
        conversation.exists &&
        shouldRollOverConversation(conversation, DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS)
    ) {
        logChatWarn('conversation_rollover_started', {
            requestId,
            traceId,
            turnId,
            archivedConversationId: conversation.conversationId,
            archivedConversationContextTokens: conversation.contextTokenCount,
            contextLimitTokens: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS
        });

        const carryoverSummary = await generateCarryoverSummary({
            db,
            fetchFn,
            config,
            locale,
            conversation
        });

        rolloverPlan = {
            archivedReason: 'context_limit',
            carryoverSummary,
            carryoverContextTokenCount: estimateTextTokens(carryoverSummary ?? ''),
            archivedConversationId: conversation.conversationId,
            archivedConversationContextTokens: conversation.contextTokenCount
        };
    }

    const baseConversationId = conversation.conversationId;
    let contextTokenCount = conversation.contextTokenCount;
    const dynamicRevisions: Record<string, string> = {};

    const pushStatus = (
        status: 'collecting_context' | 'generating_answer' | 'completed',
        detail?: string
    ) => {
        send('status', {
            type: 'status',
            status,
            detail: detail ?? null
        });
    };

    try {
        pushStatus('collecting_context');

        const toolRegistry = createChatToolRegistry({
            db,
            fetchFn,
            config,
            externalToolConfig
        });

        const memory = await loadConversationMemory(db, conversation);
        const systemInstruction = buildSystemInstruction({
            locale,
            siteIndexText: toolRegistry.siteIndexText,
            carryoverSummary: rolloverPlan?.carryoverSummary ?? memory.carryoverSummary
        });

        const bundleId = createContextBundleId();
        logChatInfo('chat_context_frozen', {
            requestId,
            traceId,
            turnId,
            conversationId: baseConversationId,
            bundleId,
            contentVersion: toolRegistry.contentVersion,
            recentMessageCount: memory.recentMessages.length,
            totalFinalizedMessages: memory.totalFinalizedMessages,
            hasCarryoverSummary: Boolean(memory.carryoverSummary),
            conversationContextTokens: contextTokenCount,
            siteRefCount: toolRegistry.siteRefs.length
        });

        const workingContents: GeminiContent[] = [
            ...(rolloverPlan ? [] : memory.contents),
            toUserPromptContent(trimmed)
        ];
        let finalCandidateText: string | null = null;

        let toolRounds = 0;
        let toolCallsCount = 0;
        while (toolRounds < MAX_TOOL_ROUNDS_PER_TURN) {
            const toolRound = await generateGeminiContent({
                fetchFn,
                config,
                systemInstruction,
                contents: workingContents,
                functionDeclarations: toolRegistry.toolDeclarations,
                toolMode: 'AUTO'
            });

            const functionCalls = extractGeminiFunctionCalls(toolRound.content);
            if (functionCalls.length === 0) {
                finalCandidateText = geminiContentToText(toolRound.content);
                break;
            }

            toolRounds += 1;

            if (toolRound.content) {
                workingContents.push(toolRound.content);
            }

            const functionResponseParts = [];
            for (const call of functionCalls) {
                toolCallsCount += 1;
                const pendingPreview = buildPendingToolCallPreview(call.name ?? 'unknown_tool', {
                    ...(call.args ?? {})
                });
                const pendingSource: ChatToolSource = call.name?.startsWith('get_github_')
                    ? 'github'
                    : call.name?.startsWith('get_huggingface_')
                      ? 'huggingface'
                      : 'site';
                const toolStartedAt = Date.now();

                send(
                    'tool_call',
                    buildToolEventPayload(
                        pendingSource,
                        pendingPreview.target,
                        pendingPreview.label
                    )
                );

                logChatInfo('chat_tool_call_started', {
                    requestId,
                    traceId,
                    turnId,
                    conversationId: baseConversationId,
                    toolRound: toolRounds,
                    toolIndex: toolCallsCount,
                    tool: pendingSource,
                    toolName: call.name ?? 'unknown_tool',
                    target: pendingPreview.target,
                    label: pendingPreview.label
                });

                const toolResult = await toolRegistry.executeTool(call.name ?? '', call.args ?? {});
                if (!toolResult) {
                    const toolLatencyMs = Date.now() - toolStartedAt;
                    functionResponseParts.push(
                        toGeminiFunctionResponsePart(call.name ?? 'unknown_tool', {
                            ok: false,
                            error: `Unknown tool: ${call.name ?? 'unknown'}`
                        })
                    );
                    logChatWarn('chat_tool_call_failed', {
                        requestId,
                        traceId,
                        turnId,
                        conversationId: baseConversationId,
                        toolRound: toolRounds,
                        toolIndex: toolCallsCount,
                        tool: pendingSource,
                        toolName: call.name ?? 'unknown_tool',
                        target: pendingPreview.target,
                        latencyMs: toolLatencyMs,
                        ok: false,
                        error: `Unknown tool: ${call.name ?? 'unknown'}`
                    });
                    continue;
                }

                if (toolResult.revision) {
                    dynamicRevisions[`${toolResult.tool}:${toolResult.target}`] =
                        toolResult.revision;
                }

                const toolLatencyMs = Date.now() - toolStartedAt;

                send('tool_result', {
                    type: 'tool_result',
                    tool: toolResult.tool,
                    target: toolResult.target,
                    label: toolResult.label,
                    result: toolResult.payload.ok === false ? 'failed' : 'success',
                    revision: toolResult.revision,
                    error:
                        toolResult.payload.ok === false
                            ? String(toolResult.payload.error ?? 'Tool failed.')
                            : undefined
                });

                const toolSucceeded = toolResult.payload.ok !== false;
                logChatInfo(toolSucceeded ? 'chat_tool_call_succeeded' : 'chat_tool_call_failed', {
                    requestId,
                    traceId,
                    turnId,
                    conversationId: baseConversationId,
                    toolRound: toolRounds,
                    toolIndex: toolCallsCount,
                    tool: toolResult.tool,
                    toolName: call.name ?? 'unknown_tool',
                    target: toolResult.target,
                    latencyMs: toolLatencyMs,
                    ok: toolSucceeded,
                    revision: toolResult.revision ?? null,
                    refsCount: toolResult.refs.length,
                    error:
                        toolResult.payload.ok === false
                            ? String(toolResult.payload.error ?? 'Tool failed.')
                            : null
                });

                functionResponseParts.push(
                    toGeminiFunctionResponsePart(call.name ?? 'unknown_tool', toolResult.payload)
                );
            }

            if (functionResponseParts.length > 0) {
                workingContents.push({
                    role: 'user',
                    parts: functionResponseParts.map((functionResponse) => ({
                        functionResponse
                    }))
                });
            }
        }

        if (toolRounds >= MAX_TOOL_ROUNDS_PER_TURN) {
            logChatWarn('chat_tool_round_limit_reached', {
                requestId,
                traceId,
                turnId,
                conversationId: baseConversationId,
                maxToolRoundsPerTurn: MAX_TOOL_ROUNDS_PER_TURN,
                toolCallsCount
            });
        }

        pushStatus('generating_answer');

        let assistantText = '';

        const completion = await streamGeminiContent({
            fetchFn,
            config,
            systemInstruction,
            contents: workingContents,
            onTextDelta: async (delta) => {
                assistantText += delta;

                send('answer_delta', {
                    type: 'answer_delta',
                    delta
                });
            }
        });

        if (!assistantText.trim()) {
            const fallbackText = finalCandidateText || geminiContentToText(completion.content);
            if (!fallbackText) {
                throw new Error('Gemini returned an empty response.');
            }
            assistantText = fallbackText;
            send('answer_delta', {
                type: 'answer_delta',
                delta: fallbackText
            });
        }

        const assistantContextTokens = estimateTextTokens(assistantText);
        const turnContextTokenCount = userContextTokens + assistantContextTokens;

        const committedConversation: ConversationHandle = await commitConversationTurn(db, {
            ownerUid: user.uid,
            ownerType: user.isAnonymous ? 'anonymous' : 'google',
            locale,
            baseConversation: conversation,
            turnId,
            userText: trimmed,
            assistantText,
            turnContextTokenCount,
            rollover: rolloverPlan
        });
        contextTokenCount = committedConversation.contextTokenCount;

        pushStatus('completed');

        if (rolloverPlan) {
            logChatInfo('conversation_rollover_completed', {
                requestId,
                traceId,
                turnId,
                archivedConversationId: rolloverPlan.archivedConversationId,
                archivedConversationContextTokens: rolloverPlan.archivedConversationContextTokens,
                newConversationId: committedConversation.conversationId,
                newConversationContextTokens: committedConversation.contextTokenCount,
                carryoverSummaryChars: rolloverPlan.carryoverSummary?.length ?? 0,
                carryoverSummaryTokens: rolloverPlan.carryoverContextTokenCount,
                continuedFromConversationId: committedConversation.continuedFromConversationId
            });
        }

        logChatInfo('chat_turn_completed', {
            requestId,
            traceId,
            turnId,
            conversationId: committedConversation.conversationId,
            durationMs: Date.now() - turnStartedAt,
            toolRounds,
            toolCallsCount,
            responseChars: assistantText.length,
            estimatedAssistantTokens: assistantContextTokens,
            conversationContextTokens: contextTokenCount,
            finishReason: completion.finishReason,
            geminiUsage: summarizeGeminiUsage(completion.usage),
            dynamicRevisionCount: Object.keys(dynamicRevisions).length
        });

        send('done', {
            type: 'done',
            contentVersion: toolRegistry.contentVersion,
            dynamicRevisions
        });
    } catch (error) {
        if (error instanceof ConversationCommitConflictError) {
            logChatWarn('chat_turn_commit_conflict', {
                requestId,
                traceId,
                turnId,
                conversationId: baseConversationId,
                durationMs: Date.now() - turnStartedAt,
                conversationContextTokens: contextTokenCount
            });
            throw error;
        }

        logChatError(
            'chat_turn_failed',
            createChatErrorLogPayload(error, {
                requestId,
                traceId,
                turnId,
                conversationId: baseConversationId,
                durationMs: Date.now() - turnStartedAt,
                conversationContextTokens: contextTokenCount
            })
        );
        throw error;
    }
};
