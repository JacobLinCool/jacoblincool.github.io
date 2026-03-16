import { DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS } from '$lib/server/chat/conversation-memory';
import { streamChatTurn } from '$lib/server/chat/stream-chat';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import { describe, expect, it, vi } from 'vitest';

const config: RuntimeConfig = {
    firestoreProjectId: 'demo-test',
    firestoreDatabaseId: '(default)',
    firestoreClientEmail: null,
    firestorePrivateKey: null,
    firestoreEmulatorHost: '127.0.0.1:8080',
    geminiApiBaseUrl: 'https://example.invalid/v1beta',
    geminiApiKey: 'test-key',
    geminiModel: 'gemini-3.1-flash-lite-preview',
    geminiMaxOutputTokens: 512,
    githubUser: 'JacobLinCool',
    huggingfaceUser: 'JacobLinCool'
};

const externalToolConfig: ExternalToolConfig = {
    timeoutMs: 1000,
    freshnessBySource: {
        githubUserSummaryMs: 1000,
        githubRepoDetailMs: 1000,
        huggingfaceUserSummaryMs: 1000,
        huggingfaceModelDetailMs: 1000,
        huggingfaceSpaceDetailMs: 1000
    }
};

const jsonResponse = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });

const sseResponse = (blocks: Array<Record<string, unknown>>) =>
    new Response(
        new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                for (const block of blocks) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(block)}\n\n`));
                }
                controller.close();
            }
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream'
            }
        }
    );

describe('streamChatTurn', () => {
    it('runs site tools through Gemini orchestration and streams the final answer', async () => {
        const db = new FakeFirestore();
        const sentEvents: Array<{ event: string; data: Record<string, unknown> }> = [];
        let generateCall = 0;

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            if (url.includes(':generateContent')) {
                generateCall += 1;
                if (generateCall === 1) {
                    return jsonResponse({
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        {
                                            functionCall: {
                                                name: 'get_knowledge_node',
                                                args: {
                                                    id: 'research'
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    });
                }

                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: 'Ready to answer.' }]
                            }
                        }
                    ]
                });
            }

            if (url.includes(':streamGenerateContent')) {
                return sseResponse([
                    {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        {
                                            text: 'You study HCI, multi-human steering, and agent-driven software engineering.'
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]);
            }

            throw new Error(`Unexpected fetch url: ${url} ${init?.method ?? 'GET'}`);
        }) as typeof fetch;

        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'What are you studying now?',
            send: (event, data) => {
                sentEvents.push({ event, data: data as Record<string, unknown> });
            }
        });

        expect(sentEvents.map((event) => event.event)).toEqual(
            expect.arrayContaining(['status', 'tool_call', 'tool_result', 'answer_delta', 'done'])
        );
        expect(sentEvents.find((event) => event.event === 'tool_call')?.data).toMatchObject({
            tool: 'site',
            label: 'Reading knowledge node'
        });

        const messages = [...db.dump('conversations')]
            .filter(([path]) => path.includes('/messages/'))
            .map(([, value]) => value);
        expect(messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: 'assistant',
                    content:
                        'You study HCI, multi-human steering, and agent-driven software engineering.',
                    model: 'gemini-3.1-flash-lite-preview'
                })
            ])
        );
    });

    it('replays prior conversation history on the next turn of the same current conversation', async () => {
        const db = new FakeFirestore();
        const capturedBodies: Array<Record<string, unknown>> = [];

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : {};
            capturedBodies.push(body);

            if (url.includes(':generateContent')) {
                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: 'No tools needed.' }]
                            }
                        }
                    ]
                });
            }

            if (url.includes(':streamGenerateContent')) {
                const contents = Array.isArray(body.contents) ? body.contents : [];
                const hasFirstTurnHistory = JSON.stringify(contents).includes('First answer.');

                return sseResponse([
                    {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        {
                                            text: hasFirstTurnHistory
                                                ? 'Second answer with memory.'
                                                : 'First answer.'
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]);
            }

            throw new Error(`Unexpected fetch url: ${url}`);
        }) as typeof fetch;

        const send = () => {};

        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'First question',
            send
        });

        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'Second question',
            send
        });

        const secondGenerateRequest = capturedBodies.filter((body) =>
            Array.isArray(body.contents)
        )[2];
        expect(JSON.stringify(secondGenerateRequest.contents)).toContain('First question');
        expect(JSON.stringify(secondGenerateRequest.contents)).toContain('First answer.');
    });

    it('rolls over into a new current conversation when the stored context limit has already been reached', async () => {
        const db = new FakeFirestore();
        const capturedBodies: Array<Record<string, unknown>> = [];
        const oldConversationId = 'conversation-old';

        await db.doc('conversation_heads/user-1').set({
            currentConversationId: oldConversationId,
            rolloverCount: 0,
            updatedAt: '2026-03-17T00:00:00.000Z'
        });
        await db.doc(`conversations/${oldConversationId}`).set({
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en',
            lifecycle: 'current',
            status: 'done',
            lastTurnSeq: 2,
            contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS + 10,
            carryoverSummary: 'Previous chapter focused on research positioning.',
            continuedFromConversationId: null,
            continuedToConversationId: null,
            archivedAt: null,
            archivedReason: null,
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T00:00:00.000Z'
        });
        await db.doc(`conversations/${oldConversationId}/messages/user-turn-1-000001`).set({
            seq: 1,
            turnId: 'turn-1',
            role: 'user',
            content: 'Tell me about your research agenda.',
            final: true,
            model: null,
            usage: null,
            parts: null,
            createdAt: '2026-03-17T00:00:01.000Z'
        });
        await db.doc(`conversations/${oldConversationId}/messages/assistant-turn-1-000002`).set({
            seq: 2,
            turnId: 'turn-1',
            role: 'assistant',
            content: 'I focus on HCI, agents, and software engineering workflows.',
            final: true,
            model: 'gemini-3.1-flash-lite-preview',
            usage: null,
            parts: null,
            createdAt: '2026-03-17T00:00:02.000Z'
        });

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : {};
            capturedBodies.push(body);
            const systemInstructionText = JSON.stringify(body.systemInstruction ?? {});

            if (url.includes(':generateContent')) {
                if (
                    systemInstructionText.includes(
                        'You write precise carryover notes for multi-turn conversations'
                    )
                ) {
                    return jsonResponse({
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        {
                                            text: 'Topics: research direction\nOpen threads: workflow design'
                                        }
                                    ]
                                }
                            }
                        ]
                    });
                }

                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: 'No tools needed.' }]
                            }
                        }
                    ]
                });
            }

            if (url.includes(':streamGenerateContent')) {
                return sseResponse([
                    {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [{ text: 'New chapter answer.' }]
                                }
                            }
                        ]
                    }
                ]);
            }

            throw new Error(`Unexpected fetch url: ${url}`);
        }) as typeof fetch;

        const sentEvents: Array<{ event: string; data: Record<string, unknown> }> = [];
        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'Keep going.',
            send: (event, data) => {
                sentEvents.push({ event, data: data as Record<string, unknown> });
            }
        });

        const conversationDocs = [...db.dump('conversations')].filter(([path]) =>
            /^conversations\/[^/]+$/.test(path)
        );
        expect(conversationDocs).toHaveLength(2);

        const archivedConversation = conversationDocs.find(([path]) =>
            path.endsWith(oldConversationId)
        );
        const newConversation = conversationDocs.find(
            ([path]) => !path.endsWith(oldConversationId)
        );

        expect(archivedConversation?.[1]).toMatchObject({
            lifecycle: 'archived',
            archivedReason: 'context_limit'
        });
        expect(newConversation?.[1]).toMatchObject({
            lifecycle: 'current',
            continuedFromConversationId: oldConversationId,
            carryoverSummary: 'Topics: research direction Open threads: workflow design'
        });
        expect(archivedConversation?.[1]).toMatchObject({
            continuedToConversationId: newConversation?.[0].split('/').at(-1)
        });

        const doneEvent = sentEvents.find((event) => event.event === 'done');
        expect(doneEvent?.data).toMatchObject({
            type: 'done',
            contentVersion: expect.any(String)
        });

        const mainStreamRequest = capturedBodies.find(
            (body) =>
                Array.isArray(body.contents) &&
                JSON.stringify(body.systemInstruction ?? {}).includes(
                    'Conversation carryover from earlier chapters'
                )
        );
        expect(JSON.stringify(mainStreamRequest?.systemInstruction ?? {})).toContain(
            'Topics: research direction Open threads: workflow design'
        );
    });

    it('stops tool planning after the configured limit and records the limit event', async () => {
        const db = new FakeFirestore();
        let generateCalls = 0;

        const fetchFn: typeof fetch = vi.fn(async (input) => {
            const url = String(input);
            if (url.includes(':generateContent')) {
                generateCalls += 1;
                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [
                                    {
                                        functionCall: {
                                            name: 'get_knowledge_root',
                                            args: {}
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                });
            }

            if (url.includes(':streamGenerateContent')) {
                return sseResponse([
                    {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        {
                                            text: 'I used the available verified information and stopped requesting more tools.'
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]);
            }

            throw new Error(`Unexpected fetch url: ${url}`);
        }) as typeof fetch;

        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'Keep reading everything.',
            send: () => {}
        });

        expect(generateCalls).toBe(8);

        const events = [...db.dump('conversations')]
            .filter(([path]) => path.includes('/events/'))
            .map(([, value]) => value);
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'tool_round_limit',
                    data: {
                        maxToolRoundsPerTurn: 8
                    }
                })
            ])
        );
    });
});
