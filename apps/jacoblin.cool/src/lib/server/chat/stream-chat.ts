import type { Firestore } from 'fires2rest';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { ToolPolicy } from '$lib/server/repos/tool-policy-repository';
import { buildContextBundle } from '$lib/server/content/context-builder';
import {
    ensureConversation,
    persistConversationEvent,
    persistConversationMessage,
    updateConversationStatus
} from '$lib/server/repos/conversation-repository';
import { streamOpenAiChatCompletion } from '$lib/server/llm/openai-stream';

type SendSseFn = (event: string, data: unknown) => void;

type StreamChatInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    policy: ToolPolicy;
    user: {
        uid: string;
        isAnonymous: boolean;
    };
    locale: string;
    requestedConversationId: string | null;
    message: string;
    send: SendSseFn;
};

const createTurnId = () => `turn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const buildToolNotice = (
    tool: 'github' | 'huggingface',
    entityKey: string,
    result: 'success' | 'failed'
) => {
    const source = tool === 'github' ? 'GitHub' : 'Hugging Face';
    if (result === 'success') {
        return `Fetched latest ${source} data for ${entityKey}.`;
    }

    return `Failed to fetch ${source} data for ${entityKey}.`;
};

export const streamChatTurn = async ({
    db,
    fetchFn,
    config,
    policy,
    user,
    locale,
    requestedConversationId,
    message,
    send
}: StreamChatInput) => {
    const trimmed = message.trim();
    if (!trimmed) {
        throw new Error('Message cannot be empty.');
    }

    const turnId = createTurnId();
    const conversation = await ensureConversation(db, {
        requestedConversationId,
        ownerUid: user.uid,
        ownerType: user.isAnonymous ? 'anonymous' : 'google',
        locale
    });

    const conversationId = conversation.conversationId;
    let seq = conversation.seq;
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
            conversationId,
            detail: detail ?? null
        });

        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'status', {
            status,
            detail: detail ?? null
        });
    };

    try {
        await pushStatus('collecting_context');

        await persistConversationMessage(db, conversationId, nextSeq(), turnId, 'user', trimmed, true);

        const contextBundle = await buildContextBundle({
            db,
            fetchFn,
            config,
            policy,
            locale,
            query: trimmed,
            onToolEvent: async (event) => {
                if (event.type === 'tool_call_started') {
                    send('tool_call', {
                        type: 'tool_call',
                        tool: event.tool,
                        entityKey: event.entityKey
                    });

                    await persistConversationEvent(db, conversationId, nextSeq(), turnId, event.type, {
                        tool: event.tool,
                        entityKey: event.entityKey
                    });
                    return;
                }

                if (event.type === 'tool_call_succeeded') {
                    send('tool_result', {
                        type: 'tool_result',
                        tool: event.tool,
                        entityKey: event.entityKey,
                        result: 'success',
                        revision: event.revision
                    });

                    await persistConversationEvent(db, conversationId, nextSeq(), turnId, event.type, {
                        tool: event.tool,
                        entityKey: event.entityKey,
                        revision: event.revision,
                        message: buildToolNotice(event.tool, event.entityKey, 'success')
                    });
                    return;
                }

                send('tool_result', {
                    type: 'tool_result',
                    tool: event.tool,
                    entityKey: event.entityKey,
                    result: 'failed',
                    error: event.error ?? 'Unknown tool failure'
                });

                await persistConversationEvent(db, conversationId, nextSeq(), turnId, event.type, {
                    tool: event.tool,
                    entityKey: event.entityKey,
                    error: event.error ?? 'Unknown tool failure',
                    message: buildToolNotice(event.tool, event.entityKey, 'failed')
                });
            }
        });

        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'context_frozen', {
            bundleId: contextBundle.id,
            contentVersion: contextBundle.contentVersion,
            refs: contextBundle.refs,
            dynamicRevisions: contextBundle.dynamicRevisions
        });

        await pushStatus('generating_answer');

        let assistantText = '';

        const completion = await streamOpenAiChatCompletion({
            fetchFn,
            config,
            systemPrompt: contextBundle.contextText,
            userPrompt: trimmed,
            onDelta: async (delta) => {
                assistantText += delta;

                send('answer_delta', {
                    type: 'answer_delta',
                    delta
                });

                await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'answer_delta', {
                    delta
                });
            }
        });

        await persistConversationMessage(
            db,
            conversationId,
            nextSeq(),
            turnId,
            'assistant',
            assistantText,
            true,
            {
                model: config.openaiChatModel,
                usage: completion.usage ?? undefined
            }
        );

        await pushStatus('completed');
        await updateConversationStatus(db, conversationId, 'done', seq);

        send('done', {
            type: 'done',
            conversationId,
            contentVersion: contextBundle.contentVersion,
            dynamicRevisions: contextBundle.dynamicRevisions
        });
    } catch (error) {
        await persistConversationEvent(db, conversationId, nextSeq(), turnId, 'error', {
            message: error instanceof Error ? error.message : 'Unknown chat failure'
        });
        await updateConversationStatus(db, conversationId, 'error', seq);
        throw error;
    }
};
