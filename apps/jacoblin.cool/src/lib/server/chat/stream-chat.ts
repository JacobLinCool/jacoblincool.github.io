import {
    DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
    estimateTextTokens,
    generateCarryoverSummary,
    loadConversationMemory,
    shouldRollOverConversation
} from '$lib/server/chat/conversation-memory';
import { buildDynamicPrompt } from '$lib/server/chat/prompt-engine';
import {
    createChatToolRegistry,
    toGeminiFunctionResponsePart,
    type ChatToolSource
} from '$lib/server/chat/tool-registry';
import {
    extractGeminiFunctionCalls,
    streamGeminiContent,
    type GeminiContent
} from '$lib/server/llm/gemini';
import {
    commitConversationTurn,
    ConversationCommitConflictError,
    findCommittedTurn,
    resolveCurrentConversation
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
import type { Firestore } from 'fires2rest';

type SendSseFn = (event: string, data: unknown) => void;

type StreamChatInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
    requestId: string;
    turnId: string;
    signal?: AbortSignal;
    user: {
        uid: string;
        isAnonymous: boolean;
    };
    locale: string;
    message: string;
    send: SendSseFn;
};

const MAX_TOOL_ROUNDS_PER_TURN = 8;

const createTraceId = () => `trace-${crypto.randomUUID()}`;
const createContextBundleId = () => `ctx-${crypto.randomUUID()}`;

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
    turnId,
    signal,
    user,
    locale,
    message,
    send
}: StreamChatInput) => {
    const trimmed = message.trim();
    if (!trimmed) {
        throw new Error('Message cannot be empty.');
    }

    const traceId = createTraceId();
    const turnStartedAt = Date.now();
    const userContextTokens = estimateTextTokens(trimmed);
    signal?.throwIfAborted();
    send('status', { type: 'status', status: 'analyzing_request' });
    // Carry cancellation through model requests and live tool fetches alike.
    const turnFetch: typeof fetch = (input, init) =>
        fetchFn(input, {
            ...init,
            signal:
                signal && init?.signal
                    ? AbortSignal.any([signal, init.signal])
                    : (signal ?? init?.signal)
        });
    const previous = await findCommittedTurn(db, user.uid, turnId);
    if (previous) {
        if (previous.userText !== trimmed)
            throw new Error('This turn id belongs to another message.');
        signal?.throwIfAborted();
        const registry = createChatToolRegistry({
            db,
            fetchFn: turnFetch,
            config,
            externalToolConfig
        });
        send('answer_delta', { type: 'answer_delta', delta: previous.assistantText });
        send('status', { type: 'status', status: 'completed' });
        send('done', {
            type: 'done',
            contentVersion: registry.contentVersion,
            dynamicRevisions: {}
        });
        return;
    }
    const conversation = await resolveCurrentConversation(db, {
        ownerUid: user.uid,
        ownerType: user.isAnonymous ? 'anonymous' : 'google',
        locale
    });
    const memory = await loadConversationMemory(db, conversation);

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
            fetchFn: turnFetch,
            config,
            signal,
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
        status: 'analyzing_request' | 'collecting_context' | 'generating_answer' | 'completed',
        detail?: string
    ) => {
        send('status', {
            type: 'status',
            status,
            detail: detail ?? null
        });
    };

    try {
        signal?.throwIfAborted();

        const toolRegistry = createChatToolRegistry({
            db,
            fetchFn: turnFetch,
            config,
            externalToolConfig
        });

        if (!config.jevApiKey) throw new Error('TYPESAFE_API_KEY is required for chat.');
        const classificationStartedAt = Date.now();
        const prompt = await buildDynamicPrompt({
            fetchFn: turnFetch,
            apiKey: config.jevApiKey,
            model: config.jevModel,
            locale,
            message: trimmed,
            recentMessages: memory.recentMessages,
            siteIndexText: toolRegistry.siteIndexText,
            carryoverSummary: rolloverPlan?.carryoverSummary ?? memory.carryoverSummary,
            signal
        });
        const systemInstruction = prompt.systemInstruction;
        const responsePolicy = prompt.responsePolicy;
        const answerConfig =
            responsePolicy.maxOutputTokens === null
                ? config
                : {
                      ...config,
                      geminiMaxOutputTokens: Math.min(
                          config.geminiMaxOutputTokens,
                          responsePolicy.maxOutputTokens
                      )
                  };
        logChatInfo('chat_prompt_selected', {
            requestId,
            traceId,
            turnId,
            promptVersion: prompt.promptVersion,
            selectedItemIds: prompt.selectedItemIds,
            decisions: prompt.decisions,
            classification: prompt.classification,
            responseMode: responsePolicy.mode,
            toolsAllowed: responsePolicy.allowTools,
            maxOutputTokens: answerConfig.geminiMaxOutputTokens,
            latencyMs: Date.now() - classificationStartedAt
        });
        if (responsePolicy.includeKnowledge) pushStatus('collecting_context');

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
        let assistantText = '';
        let completion: Awaited<ReturnType<typeof streamGeminiContent>> | null = null;
        let firstDeltaAt: number | null = null;
        let hasRoundText = false;
        const onTextDelta = async (delta: string) => {
            signal?.throwIfAborted();
            if (firstDeltaAt === null) firstDeltaAt = Date.now();
            if (!hasRoundText && assistantText) delta = `\n\n${delta}`;
            hasRoundText = true;
            assistantText += delta;
            send('answer_delta', { type: 'answer_delta', delta });
        };

        let toolRounds = 0;
        let toolCallsCount = 0;
        while (true) {
            signal?.throwIfAborted();
            hasRoundText = false;
            pushStatus('generating_answer');
            completion = await streamGeminiContent({
                fetchFn: turnFetch,
                config: answerConfig,
                systemInstruction,
                contents: workingContents,
                ...(responsePolicy.allowTools
                    ? { functionDeclarations: toolRegistry.toolDeclarations }
                    : {}),
                toolMode:
                    responsePolicy.allowTools && toolRounds < MAX_TOOL_ROUNDS_PER_TURN
                        ? 'AUTO'
                        : 'NONE',
                signal,
                onTextDelta
            });
            if (
                !responsePolicy.allowTools &&
                completion.content?.parts.some((part) => part.functionCall)
            ) {
                throw new Error('Model requested a tool disabled by the response policy.');
            }
            const functionCalls = extractGeminiFunctionCalls(completion.content);
            if (functionCalls.length === 0) break;
            if (toolRounds >= MAX_TOOL_ROUNDS_PER_TURN) {
                throw new Error('Model exceeded the tool-call limit.');
            }
            if (responsePolicy.includeKnowledge) pushStatus('collecting_context');

            toolRounds += 1;

            if (completion.content) {
                workingContents.push(completion.content);
            }

            const functionResponseParts = await Promise.all(
                functionCalls.map(async (call) => {
                    signal?.throwIfAborted();
                    const toolIndex = ++toolCallsCount;
                    const pendingPreview = buildPendingToolCallPreview(
                        call.name ?? 'unknown_tool',
                        {
                            ...(call.args ?? {})
                        }
                    );
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
                        toolIndex,
                        tool: pendingSource,
                        toolName: call.name ?? 'unknown_tool',
                        target: pendingPreview.target,
                        label: pendingPreview.label
                    });

                    const toolResult = await toolRegistry.executeTool(
                        call.name ?? '',
                        call.args ?? {}
                    );
                    if (!toolResult) {
                        const toolLatencyMs = Date.now() - toolStartedAt;
                        logChatWarn('chat_tool_call_failed', {
                            requestId,
                            traceId,
                            turnId,
                            conversationId: baseConversationId,
                            toolRound: toolRounds,
                            toolIndex,
                            tool: pendingSource,
                            toolName: call.name ?? 'unknown_tool',
                            target: pendingPreview.target,
                            latencyMs: toolLatencyMs,
                            ok: false,
                            error: `Unknown tool: ${call.name ?? 'unknown'}`
                        });
                        return {
                            ...toGeminiFunctionResponsePart(call.name ?? 'unknown_tool', {
                                ok: false,
                                error: `Unknown tool: ${call.name ?? 'unknown'}`
                            }),
                            ...(call.id ? { id: call.id } : {})
                        };
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
                    logChatInfo(
                        toolSucceeded ? 'chat_tool_call_succeeded' : 'chat_tool_call_failed',
                        {
                            requestId,
                            traceId,
                            turnId,
                            conversationId: baseConversationId,
                            toolRound: toolRounds,
                            toolIndex,
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
                        }
                    );

                    return {
                        ...toGeminiFunctionResponsePart(
                            call.name ?? 'unknown_tool',
                            toolResult.payload
                        ),
                        ...(call.id ? { id: call.id } : {})
                    };
                })
            );

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

        if (!assistantText.trim()) throw new Error('Gemini returned an empty response.');
        signal?.throwIfAborted();

        const assistantContextTokens = estimateTextTokens(assistantText);
        const turnContextTokenCount = userContextTokens + assistantContextTokens;

        const committedConversation = await commitConversationTurn(db, {
            ownerUid: user.uid,
            ownerType: user.isAnonymous ? 'anonymous' : 'google',
            locale,
            baseConversation: conversation,
            signal,
            turnId,
            userText: trimmed,
            assistantText,
            turnContextTokenCount,
            rollover: rolloverPlan
        });
        if (committedConversation.assistantText !== assistantText) {
            throw new ConversationCommitConflictError();
        }
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
            timeToFirstDeltaMs: firstDeltaAt === null ? null : firstDeltaAt - turnStartedAt,
            finishReason: completion?.finishReason,
            geminiUsage: summarizeGeminiUsage(completion?.usage),
            dynamicRevisionCount: Object.keys(dynamicRevisions).length
        });

        send('done', {
            type: 'done',
            contentVersion: toolRegistry.contentVersion,
            dynamicRevisions
        });
    } catch (error) {
        if (signal?.aborted) throw error;
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
