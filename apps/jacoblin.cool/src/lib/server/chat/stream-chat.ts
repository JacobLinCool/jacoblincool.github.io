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
    persistConversationEvent,
    persistConversationMessage,
    resolveCurrentConversation,
    rolloverCurrentConversation,
    updateConversationStatus
} from '$lib/server/repos/conversation-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import type { Firestore } from 'fires2rest';

type SendSseFn = (event: string, data: unknown) => void;

type StreamChatInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
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
        'Prefer site tools over GitHub or Hugging Face tools. Use live tools only for freshness, repository details, or profile metrics that are not fully covered by the site bundle.',
        'If a tool says information is missing or disabled, explain that boundary directly instead of guessing.',
        'Treat the conversation like a user interview with Jacob. Answer as the interviewee, not as a report generator.',
        'Do not dump everything at once. Reveal information progressively: one layer first, then let the user steer deeper with follow-up questions.',
        'Keep answers compact by default: usually 2 to 4 short sentences or one short paragraph. Avoid long bullet lists unless the user explicitly asks for a full breakdown.',
        'When the question is broad, give a small framing answer and at most 1 to 3 key points. Do not proactively enumerate every section, project, or publication unless asked.',
        'Prefer natural spoken phrasing over polished summaries. It is acceptable to sound partial, conversational, and incremental as long as the answer stays grounded and clear.',
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
    let conversation = await resolveCurrentConversation(db, {
        ownerUid: user.uid,
        ownerType: user.isAnonymous ? 'anonymous' : 'google',
        locale
    });

    if (shouldRollOverConversation(conversation, DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS)) {
        const carryoverSummary = await generateCarryoverSummary({
            db,
            fetchFn,
            config,
            locale,
            conversation
        });

        conversation = await rolloverCurrentConversation(db, {
            ownerUid: user.uid,
            ownerType: user.isAnonymous ? 'anonymous' : 'google',
            locale,
            currentConversationId: conversation.conversationId,
            carryoverSummary,
            archivedReason: 'context_limit',
            initialContextTokenCount: estimateTextTokens(carryoverSummary ?? '')
        });
    }

    const conversationId = conversation.conversationId;
    let seq = conversation.seq;
    let contextTokenCount = conversation.contextTokenCount;
    const dynamicRevisions: Record<string, string> = {};

    const nextSeq = () => {
        seq += 1;
        return seq;
    };

    await updateConversationStatus(db, conversationId, 'streaming', seq);

    const pushStatus = async (
        status: 'collecting_context' | 'generating_answer' | 'completed',
        detail?: string
    ) => {
        send('status', {
            type: 'status',
            status,
            detail: detail ?? null
        });

        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'status', {
            status,
            detail: detail ?? null
        });
    };

    try {
        await pushStatus('collecting_context');

        const userContextTokens = estimateTextTokens(trimmed);
        await persistConversationMessage(
            db,
            conversationId,
            nextSeq(),
            turnId,
            'user',
            trimmed,
            true,
            userContextTokens
        );
        contextTokenCount += userContextTokens;

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
            carryoverSummary: memory.carryoverSummary
        });

        const bundleId = createContextBundleId();
        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'context_frozen', {
            bundleId,
            contentVersion: toolRegistry.contentVersion,
            refs: toolRegistry.siteRefs,
            recentMessageCount: memory.recentMessages.length,
            totalFinalizedMessages: memory.totalFinalizedMessages,
            hasCarryoverSummary: Boolean(memory.carryoverSummary),
            contextTokenCount
        });

        const workingContents: GeminiContent[] = [...memory.contents];
        let finalCandidateText: string | null = null;
        let finalCandidateParts: GeminiContent['parts'] | null = null;

        let toolRounds = 0;
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
                finalCandidateParts = toolRound.content?.parts ?? null;
                break;
            }

            toolRounds += 1;

            if (toolRound.content) {
                workingContents.push(toolRound.content);
            }

            const functionResponseParts = [];
            for (const call of functionCalls) {
                const pendingPreview = buildPendingToolCallPreview(call.name ?? 'unknown_tool', {
                    ...(call.args ?? {})
                });
                const pendingSource: ChatToolSource = call.name?.startsWith('get_github_')
                    ? 'github'
                    : call.name?.startsWith('get_huggingface_')
                      ? 'huggingface'
                      : 'site';

                send(
                    'tool_call',
                    buildToolEventPayload(
                        pendingSource,
                        pendingPreview.target,
                        pendingPreview.label
                    )
                );
                await persistConversationEvent(
                    db,
                    conversationId,
                    nextSeq(),
                    turnId,
                    'tool_call_started',
                    {
                        tool: pendingSource,
                        target: pendingPreview.target,
                        label: pendingPreview.label
                    }
                );

                const toolResult = await toolRegistry.executeTool(call.name ?? '', call.args ?? {});
                if (!toolResult) {
                    functionResponseParts.push(
                        toGeminiFunctionResponsePart(call.name ?? 'unknown_tool', {
                            ok: false,
                            error: `Unknown tool: ${call.name ?? 'unknown'}`
                        })
                    );
                    continue;
                }

                if (toolResult.revision) {
                    dynamicRevisions[`${toolResult.tool}:${toolResult.target}`] =
                        toolResult.revision;
                }

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
                await persistConversationEvent(
                    db,
                    conversationId,
                    nextSeq(),
                    turnId,
                    toolResult.payload.ok === false ? 'tool_call_failed' : 'tool_call_succeeded',
                    {
                        tool: toolResult.tool,
                        target: toolResult.target,
                        label: toolResult.label,
                        refs: toolResult.refs,
                        revision: toolResult.revision ?? null,
                        ok: toolResult.payload.ok !== false,
                        error:
                            toolResult.payload.ok === false
                                ? String(toolResult.payload.error ?? 'Tool failed.')
                                : null
                    }
                );

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
            await persistConversationEvent(
                db,
                conversationId,
                nextSeq(),
                turnId,
                'tool_round_limit',
                {
                    maxToolRoundsPerTurn: MAX_TOOL_ROUNDS_PER_TURN
                }
            );
        }

        await pushStatus('generating_answer');

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

                await persistConversationEvent(
                    db,
                    conversationId,
                    nextSeq(),
                    turnId,
                    'answer_delta',
                    {
                        delta
                    }
                );
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
            await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'answer_delta', {
                delta: fallbackText
            });
        }

        const assistantContextTokens = estimateTextTokens(assistantText);
        await persistConversationMessage(
            db,
            conversationId,
            nextSeq(),
            turnId,
            'assistant',
            assistantText,
            true,
            assistantContextTokens,
            {
                model: config.geminiModel,
                usage: completion.usage ?? undefined,
                parts: completion.content?.parts ?? finalCandidateParts ?? undefined
            }
        );
        contextTokenCount += assistantContextTokens;

        await pushStatus('completed');
        await updateConversationStatus(db, conversationId, 'done', seq);

        send('done', {
            type: 'done',
            contentVersion: toolRegistry.contentVersion,
            dynamicRevisions
        });
    } catch (error) {
        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'error', {
            message: error instanceof Error ? error.message : 'Unknown chat failure'
        });
        await updateConversationStatus(db, conversationId, 'error', seq);
        throw error;
    }
};
