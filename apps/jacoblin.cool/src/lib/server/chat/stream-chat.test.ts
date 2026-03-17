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
    githubToken: null,
    githubUser: 'JacobLinCool',
    huggingfaceUser: 'JacobLinCool'
};

const externalToolConfig: ExternalToolConfig = {
    timeoutMs: 1000,
    freshnessBySource: {
        githubUserSummaryMs: 1000,
        githubRepoDetailMs: 1000,
        githubRepoCatalogMs: 1000,
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

const rootConversationDocs = (db: FakeFirestore) =>
    [...db.dump('conversations')].filter(([path]) => /^conversations\/[^/]+$/.test(path));

describe('streamChatTurn', () => {
    it('runs site tools through Gemini orchestration and commits one embedded turn after streaming', async () => {
        const db = new FakeFirestore();
        const sentEvents: Array<{ event: string; data: Record<string, unknown> }> = [];
        const storageSnapshotsAtDelta: Array<{ heads: number; conversations: number }> = [];
        const capturedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
        let generateCall = 0;

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : {};
            capturedRequests.push({ url, body });
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
            requestId: 'req-1',
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'What are you studying now?',
            send: (event, data) => {
                if (event === 'answer_delta') {
                    storageSnapshotsAtDelta.push({
                        heads: db.dump('conversation_heads').size,
                        conversations: rootConversationDocs(db).length
                    });
                }
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
        expect(storageSnapshotsAtDelta).toEqual([{ heads: 0, conversations: 0 }]);
        expect(
            JSON.stringify(
                capturedRequests.find(({ url }) => url.includes(':generateContent'))?.body
                    .contents ?? []
            )
        ).toContain('What are you studying now?');
        const systemInstructionText = JSON.stringify(
            capturedRequests.find(({ url }) => url.includes(':generateContent'))?.body
                .systemInstruction ?? {}
        );
        expect(systemInstructionText).toContain(
            'Answer at the same level of abstraction as the user question.'
        );
        expect(systemInstructionText).toContain(
            'Do not answer with collection names, category names, or taxonomy labels'
        );
        expect(systemInstructionText).toContain(
            'When the user asks about what is recent, current, latest, or being worked on now'
        );
        expect(
            JSON.stringify(
                capturedRequests.find(({ url }) => url.includes(':streamGenerateContent'))?.body
                    .contents ?? []
            )
        ).toContain('What are you studying now?');

        const headDocs = [...db.dump('conversation_heads')];
        const conversationDocs = rootConversationDocs(db);
        expect(headDocs).toHaveLength(1);
        expect(conversationDocs).toHaveLength(1);
        expect(conversationDocs[0]?.[1]).toMatchObject({
            ownerUid: 'user-1',
            lifecycle: 'current',
            lastTurnSeq: 1,
            carryoverSummary: null,
            turns: [
                {
                    userText: 'What are you studying now?',
                    assistantText:
                        'You study HCI, multi-human steering, and agent-driven software engineering.'
                }
            ]
        });
        expect(
            [...db.dump('conversations')].filter(([path]) => path.includes('/messages/'))
        ).toHaveLength(0);
        expect(
            [...db.dump('conversations')].filter(([path]) => path.includes('/events/'))
        ).toHaveLength(0);
    });

    it('replays prior embedded turns on the next request in the same conversation', async () => {
        const db = new FakeFirestore();
        const capturedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : {};
            capturedRequests.push({ url, body });

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
            requestId: 'req-2',
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
            requestId: 'req-3',
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'Second question',
            send
        });

        const secondGenerateRequest = capturedRequests.filter(({ url }) =>
            url.includes(':generateContent')
        )[1];
        const secondGenerateContents = JSON.stringify(secondGenerateRequest?.body.contents ?? []);
        expect(secondGenerateContents).toContain('First question');
        expect(secondGenerateContents).toContain('First answer.');
        expect(secondGenerateContents).toContain('Second question');

        const secondStreamRequest = capturedRequests.filter(({ url }) =>
            url.includes(':streamGenerateContent')
        )[1];
        const secondStreamContents = JSON.stringify(secondStreamRequest?.body.contents ?? []);
        expect(secondStreamContents).toContain('First question');
        expect(secondStreamContents).toContain('First answer.');
        expect(secondStreamContents).toContain('Second question');

        const conversationDocs = rootConversationDocs(db);
        expect(conversationDocs).toHaveLength(1);
        expect(conversationDocs[0]?.[1]).toMatchObject({
            lastTurnSeq: 2,
            turns: [
                {
                    userText: 'First question',
                    assistantText: 'First answer.'
                },
                {
                    userText: 'Second question',
                    assistantText: 'Second answer with memory.'
                }
            ]
        });
    });

    it('rolls over into a new conversation only when the turn commit succeeds', async () => {
        const db = new FakeFirestore();
        const capturedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
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
            lastTurnSeq: 1,
            contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS + 10,
            carryoverSummary: 'Previous chapter focused on research positioning.',
            continuedFromConversationId: null,
            continuedToConversationId: null,
            archivedAt: null,
            archivedReason: null,
            turns: [
                {
                    turnId: 'turn-1',
                    userText: 'Tell me about your research agenda.',
                    assistantText: 'I focus on HCI, agents, and software engineering workflows.',
                    completedAt: '2026-03-17T00:00:02.000Z'
                }
            ],
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T00:00:02.000Z'
        });

        const fetchFn: typeof fetch = vi.fn(async (input, init) => {
            const url = String(input);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : {};
            capturedRequests.push({ url, body });
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
            requestId: 'req-4',
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

        const conversationDocs = rootConversationDocs(db);
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
            lastTurnSeq: 1,
            continuedFromConversationId: oldConversationId,
            carryoverSummary: 'Topics: research direction Open threads: workflow design',
            turns: [
                {
                    userText: 'Keep going.',
                    assistantText: 'New chapter answer.'
                }
            ]
        });
        expect(archivedConversation?.[1]).toMatchObject({
            continuedToConversationId: newConversation?.[0].split('/').at(-1)
        });

        const doneEvent = sentEvents.find((event) => event.event === 'done');
        expect(doneEvent?.data).toMatchObject({
            type: 'done',
            contentVersion: expect.any(String)
        });

        const mainStreamRequest = capturedRequests.find(
            ({ url, body }) =>
                url.includes(':streamGenerateContent') &&
                JSON.stringify(body.systemInstruction ?? {}).includes(
                    'Conversation carryover from earlier chapters'
                )
        );
        expect(JSON.stringify(mainStreamRequest?.body.systemInstruction ?? {})).toContain(
            'Topics: research direction Open threads: workflow design'
        );
        expect(JSON.stringify(mainStreamRequest?.body.contents ?? [])).toContain('Keep going.');
        expect(JSON.stringify(mainStreamRequest?.body.contents ?? [])).not.toContain(
            'Tell me about your research agenda.'
        );
    });

    it('stops tool planning after the configured limit without persisting streaming events', async () => {
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
            requestId: 'req-5',
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            message: 'Keep reading everything.',
            send: () => {}
        });

        expect(generateCalls).toBe(8);
        expect(
            [...db.dump('conversations')].filter(([path]) => path.includes('/events/'))
        ).toHaveLength(0);
        expect(
            [...db.dump('conversations')].filter(([path]) => path.includes('/messages/'))
        ).toHaveLength(0);
    });

    it('leaves Firestore unchanged when generation fails before commit', async () => {
        const db = new FakeFirestore();

        const fetchFn: typeof fetch = vi.fn(async (input) => {
            const url = String(input);
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
                return new Response('boom', { status: 500 });
            }

            throw new Error(`Unexpected fetch url: ${url}`);
        }) as typeof fetch;

        await expect(
            streamChatTurn({
                db: db as never,
                fetchFn,
                config,
                externalToolConfig,
                requestId: 'req-6',
                user: {
                    uid: 'user-1',
                    isAnonymous: true
                },
                locale: 'en',
                message: 'This should fail.',
                send: () => {}
            })
        ).rejects.toThrow('Gemini stream request failed (500): boom');

        expect(db.dump().size).toBe(0);
    });

    it('rejects stale commits when the conversation changed during streaming', async () => {
        const db = new FakeFirestore();
        const conversationId = 'conversation-concurrent';

        await db.doc('conversation_heads/user-1').set({
            currentConversationId: conversationId,
            rolloverCount: 0,
            updatedAt: '2026-03-17T00:00:00.000Z'
        });
        await db.doc(`conversations/${conversationId}`).set({
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en',
            lifecycle: 'current',
            lastTurnSeq: 1,
            contextTokenCount: 32,
            carryoverSummary: null,
            continuedFromConversationId: null,
            continuedToConversationId: null,
            archivedAt: null,
            archivedReason: null,
            turns: [
                {
                    turnId: 'turn-1',
                    userText: 'First question',
                    assistantText: 'First answer',
                    completedAt: '2026-03-17T00:00:01.000Z'
                }
            ],
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T00:00:01.000Z'
        });

        const fetchFn: typeof fetch = vi.fn(async (input) => {
            const url = String(input);
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
                return sseResponse([
                    {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [{ text: 'Outdated answer.' }]
                                }
                            }
                        ]
                    }
                ]);
            }

            throw new Error(`Unexpected fetch url: ${url}`);
        }) as typeof fetch;

        await expect(
            streamChatTurn({
                db: db as never,
                fetchFn,
                config,
                externalToolConfig,
                requestId: 'req-7',
                user: {
                    uid: 'user-1',
                    isAnonymous: true
                },
                locale: 'en',
                message: 'Second question',
                send: (event) => {
                    if (event !== 'answer_delta') {
                        return;
                    }

                    void db.doc(`conversations/${conversationId}`).set({
                        ownerUid: 'user-1',
                        ownerType: 'anonymous',
                        locale: 'en',
                        lifecycle: 'current',
                        lastTurnSeq: 2,
                        contextTokenCount: 64,
                        carryoverSummary: null,
                        continuedFromConversationId: null,
                        continuedToConversationId: null,
                        archivedAt: null,
                        archivedReason: null,
                        turns: [
                            {
                                turnId: 'turn-1',
                                userText: 'First question',
                                assistantText: 'First answer',
                                completedAt: '2026-03-17T00:00:01.000Z'
                            },
                            {
                                turnId: 'turn-competing',
                                userText: 'Competing question',
                                assistantText: 'Competing answer',
                                completedAt: '2026-03-17T00:00:02.000Z'
                            }
                        ],
                        createdAt: '2026-03-17T00:00:00.000Z',
                        updatedAt: '2026-03-17T00:00:02.000Z'
                    });
                }
            })
        ).rejects.toThrow('Conversation changed during generation. Please retry your message.');

        const finalConversation = db.dump('conversations').get(`conversations/${conversationId}`);
        expect(finalConversation).toMatchObject({
            lastTurnSeq: 2,
            turns: [
                {
                    userText: 'First question',
                    assistantText: 'First answer'
                },
                {
                    userText: 'Competing question',
                    assistantText: 'Competing answer'
                }
            ]
        });
        expect(JSON.stringify(finalConversation)).not.toContain('Outdated answer.');
    });
});
