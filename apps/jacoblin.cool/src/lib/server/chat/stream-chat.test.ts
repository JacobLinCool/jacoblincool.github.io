import { streamChatTurn } from '$lib/server/chat/stream-chat';
import type { ToolPolicy } from '$lib/server/repos/tool-policy-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import { describe, expect, it, vi } from 'vitest';

const config: RuntimeConfig = {
    firestoreProjectId: 'demo-test',
    firestoreDatabaseId: '(default)',
    firestoreClientEmail: null,
    firestorePrivateKey: null,
    firestoreEmulatorHost: '127.0.0.1:8080',
    ownerUid: null,
    geminiApiBaseUrl: 'https://example.invalid/v1beta',
    geminiApiKey: 'test-key',
    geminiModel: 'gemini-3.1-flash-lite-preview',
    geminiMaxOutputTokens: 512,
    githubUser: 'JacobLinCool',
    huggingfaceUser: 'JacobLinCool'
};

const policy: ToolPolicy = {
    maxCallsPerTurn: 2,
    timeoutMs: 1000,
    enabledTools: ['github', 'huggingface'],
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
                                                name: 'get_research_interests',
                                                args: {}
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
            policy,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            requestedConversationId: null,
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
            label: 'Reading research interests'
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

    it('replays prior conversation history on the next turn', async () => {
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
            policy,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            requestedConversationId: 'conversation-1',
            message: 'First question',
            send
        });

        await streamChatTurn({
            db: db as never,
            fetchFn,
            config,
            policy,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            requestedConversationId: 'conversation-1',
            message: 'Second question',
            send
        });

        const secondGenerateRequest = capturedBodies.filter((body) =>
            Array.isArray(body.contents)
        )[2];
        expect(JSON.stringify(secondGenerateRequest.contents)).toContain('First question');
        expect(JSON.stringify(secondGenerateRequest.contents)).toContain('First answer.');
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
                                            name: 'get_site_overview',
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
            policy,
            user: {
                uid: 'user-1',
                isAnonymous: true
            },
            locale: 'en',
            requestedConversationId: 'conversation-limit',
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
