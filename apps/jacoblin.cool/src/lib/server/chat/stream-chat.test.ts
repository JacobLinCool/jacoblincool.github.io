import { DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS } from '$lib/server/chat/conversation-memory';
import { buildDynamicPrompt } from '$lib/server/chat/prompt-engine';
import { streamChatTurn } from '$lib/server/chat/stream-chat';
import * as chatTools from '$lib/server/chat/tool-registry';
import type { GeminiPart } from '$lib/server/llm/gemini';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/chat/prompt-engine', () => ({ buildDynamicPrompt: vi.fn() }));

const config: RuntimeConfig = {
    firestoreProjectId: 'demo-test',
    firestoreDatabaseId: '(default)',
    firestoreClientEmail: null,
    firestorePrivateKey: null,
    firestoreEmulatorHost: '127.0.0.1:8080',
    jevApiKey: 'test-jev-key',
    jevModel: 'jev-latest',
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
const sseResponse = (parts: GeminiPart[], finishReason = 'STOP') =>
    new Response(
        `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason }] })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
    );
const rootConversationDocs = (db: FakeFirestore) =>
    [...db.dump('conversations')].filter(([path]) => /^conversations\/[^/]+$/.test(path));
type DynamicPrompt = Awaited<ReturnType<typeof buildDynamicPrompt>>;
const createPrompt = (carryoverSummary: string | null = null): DynamicPrompt => ({
    systemInstruction: `Grounded dynamic prompt. ${carryoverSummary ?? ''}`,
    promptVersion: 'test',
    selectedItemIds: [],
    decisions: [],
    classification: { model: 'jev-test', usage: { inputTokens: 10, outputTokens: 2 } },
    responsePolicy: {
        mode: 'answer',
        includeKnowledge: true,
        allowTools: true,
        maxOutputTokens: null,
        humor: 'none'
    }
});
const selectResponsePolicy = (policy: Partial<DynamicPrompt['responsePolicy']>) => {
    const prompt = createPrompt();
    vi.mocked(buildDynamicPrompt).mockResolvedValueOnce({
        ...prompt,
        responsePolicy: { ...prompt.responsePolicy, ...policy }
    });
};
const setup = (fetchFn: typeof fetch, db = new FakeFirestore()) => {
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];
    return {
        db,
        events,
        input: {
            db: db as never,
            fetchFn,
            config,
            externalToolConfig,
            requestId: 'req-test',
            turnId: 'test-turn',
            user: { uid: 'user-1', isAnonymous: true },
            locale: 'en',
            message: 'Tell me about your research.',
            send: (event: string, data: unknown) =>
                events.push({ event, data: data as Record<string, unknown> })
        }
    };
};
const seedConversation = async (db: FakeFirestore, contextTokenCount = 32) => {
    await db
        .doc('conversation_heads/user-1')
        .set({ currentConversationId: 'old', rolloverCount: 0 });
    await db.doc('conversations/old').set({
        ownerUid: 'user-1',
        ownerType: 'anonymous',
        locale: 'en',
        lifecycle: 'current',
        lastTurnSeq: 1,
        contextTokenCount,
        carryoverSummary: 'Earlier research discussion.',
        continuedFromConversationId: null,
        turns: [
            {
                turnId: 'first-turn',
                userText: 'First question',
                assistantText: 'First answer',
                completedAt: '2026-10-04T00:00:00Z'
            }
        ]
    });
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(buildDynamicPrompt).mockReset();
    vi.mocked(buildDynamicPrompt).mockImplementation(async ({ carryoverSummary }) =>
        createPrompt(carryoverSummary)
    );
});

describe('streamChatTurn', () => {
    it('streams the first answer with one generation, then commits once', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () =>
            sseResponse([{ text: 'Grounded answer.' }])
        );
        const { db, events, input } = setup(fetchFn);
        await streamChatTurn({
            ...input,
            send: (event, data) => {
                if (event === 'answer_delta') expect(db.dump().size).toBe(0);
                input.send(event, data);
            }
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(String(fetchFn.mock.calls[0][0])).toContain(':streamGenerateContent');
        expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toMatchObject({
            tools: [{ functionDeclarations: expect.any(Array) }],
            toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            generationConfig: { maxOutputTokens: config.geminiMaxOutputTokens }
        });
        expect(buildDynamicPrompt).toHaveBeenCalledWith(
            expect.objectContaining({ message: input.message, recentMessages: [] })
        );
        expect(events[0].data.status).toBe('analyzing_request');
        expect(events.at(-1)?.event).toBe('done');
        expect(rootConversationDocs(db)[0][1]).toMatchObject({
            lastTurnSeq: 1,
            turns: [
                { turnId: 'test-turn', userText: input.message, assistantText: 'Grounded answer.' }
            ]
        });
    });

    it.each([
        { policyLimit: 160, expectedLimit: 160 },
        { policyLimit: 2048, expectedLimit: 512 }
    ])(
        'redirects without tools or context loading and bounds output to $expectedLimit tokens',
        async ({ policyLimit, expectedLimit }) => {
            selectResponsePolicy({
                mode: 'redirect',
                includeKnowledge: false,
                allowTools: false,
                maxOutputTokens: policyLimit,
                humor: 'light'
            });
            const fetchFn = vi.fn<typeof fetch>(async () =>
                sseResponse([{ text: 'I can help you explore Jacob’s projects instead.' }])
            );
            const { input, events } = setup(fetchFn);
            await streamChatTurn(input);
            const request = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
            expect(request.tools).toBeUndefined();
            expect(request.toolConfig).toBeUndefined();
            expect(request.generationConfig.maxOutputTokens).toBe(expectedLimit);
            expect(input.config.geminiMaxOutputTokens).toBe(512);
            expect(
                events.filter(({ event }) => event === 'status').map(({ data }) => data.status)
            ).toEqual(['analyzing_request', 'generating_answer', 'completed']);
        }
    );

    it.each([
        { name: 'get_github_repositories', args: {} },
        { name: 'fabricated_tool', args: {} },
        {}
    ])(
        'rejects a prohibited function call before executing or persisting anything: %j',
        async (call) => {
            selectResponsePolicy({
                mode: 'boundary',
                includeKnowledge: false,
                allowTools: false,
                maxOutputTokens: 160
            });
            const fetchFn = vi.fn<typeof fetch>(async () => sseResponse([{ functionCall: call }]));
            const { db, input, events } = setup(fetchFn);
            const registry = chatTools.createChatToolRegistry({
                db: input.db,
                fetchFn,
                config,
                externalToolConfig
            });
            const executeTool = vi.spyOn(registry, 'executeTool');
            vi.spyOn(chatTools, 'createChatToolRegistry').mockReturnValueOnce(registry);

            await expect(streamChatTurn(input)).rejects.toThrow('disabled by the response policy');
            expect(executeTool).not.toHaveBeenCalled();
            expect(fetchFn).toHaveBeenCalledTimes(1);
            expect(db.dump().size).toBe(0);
            expect(events.some(({ event }) => event === 'tool_call' || event === 'done')).toBe(
                false
            );
        }
    );

    it('replays a committed turn on retry without classifying or generating again', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => sseResponse([{ text: 'Answer.' }]));
        const { db, input, events } = setup(fetchFn);
        await streamChatTurn(input);
        await streamChatTurn(input);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(buildDynamicPrompt).toHaveBeenCalledTimes(1);
        expect(rootConversationDocs(db)[0][1]).toMatchObject({ lastTurnSeq: 1 });
        expect(events.filter(({ event }) => event === 'answer_delta')).toHaveLength(2);
        await expect(streamChatTurn({ ...input, message: 'Different message' })).rejects.toThrow(
            'another message'
        );
    });

    it.each(['answer', 'bridge', 'boundary'] as const)(
        'continues permitted tools in %s mode with matching response ids and grounded context',
        async (mode) => {
            selectResponsePolicy({ mode });
            const requests: Record<string, unknown>[] = [];
            const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
                requests.push(JSON.parse(String(init?.body)));
                if (requests.length === 1)
                    return sseResponse([
                        {
                            functionCall: {
                                id: 'call-1',
                                name: 'get_knowledge_node',
                                args: { id: 'research' }
                            },
                            thoughtSignature: 'signature'
                        },
                        { functionCall: { id: 'call-2', name: 'get_knowledge_root', args: {} } }
                    ]);
                return sseResponse([{ text: 'Research answer.' }]);
            });
            const { db, events, input } = setup(fetchFn);
            await streamChatTurn(input);
            expect(fetchFn).toHaveBeenCalledTimes(2);
            expect(events.filter(({ event }) => event === 'tool_result')).toHaveLength(2);
            const contents = JSON.stringify(requests[1].contents);
            expect(contents).toContain('signature');
            expect(contents).toContain('call-1');
            expect(contents).toContain('call-2');
            expect(contents).toContain('functionResponse');
            expect(rootConversationDocs(db)[0][1]).toMatchObject({ lastTurnSeq: 1 });
        }
    );

    it('supplies previous finalized messages to Jev and Gemini on a follow-up', async () => {
        let body: Record<string, unknown> = {};
        const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
            body = JSON.parse(String(init?.body));
            return sseResponse([{ text: 'Second answer.' }]);
        });
        const { db, input } = setup(fetchFn);
        await seedConversation(db);
        await streamChatTurn(input);
        expect(buildDynamicPrompt).toHaveBeenCalledWith(
            expect.objectContaining({
                recentMessages: expect.arrayContaining([
                    expect.objectContaining({ content: 'First answer' })
                ]),
                carryoverSummary: 'Earlier research discussion.'
            })
        );
        expect(JSON.stringify(body.contents)).toContain('First question');
        expect(JSON.stringify(body.contents)).toContain('First answer');
        expect(rootConversationDocs(db)[0][1]).toMatchObject({ lastTurnSeq: 2 });
    });

    it('rolls over only on successful completion and classifies using the new carryover', async () => {
        const fetchFn = vi.fn<typeof fetch>(async (url, init) => {
            if (String(url).includes(':generateContent'))
                return Response.json({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: 'Topics: research. Open threads: workflows.' }]
                            }
                        }
                    ]
                });
            expect(JSON.stringify(JSON.parse(String(init?.body)).contents)).not.toContain(
                'First question'
            );
            return sseResponse([{ text: 'New chapter answer.' }]);
        });
        const { db, input } = setup(fetchFn);
        await seedConversation(db, DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS + 1);
        await streamChatTurn(input);
        expect(buildDynamicPrompt).toHaveBeenCalledWith(
            expect.objectContaining({
                carryoverSummary: 'Topics: research. Open threads: workflows.'
            })
        );
        const docs = rootConversationDocs(db);
        expect(docs).toHaveLength(2);
        expect(docs.find(([path]) => path === 'conversations/old')?.[1].lifecycle).toBe('archived');
        expect(docs.find(([path]) => path !== 'conversations/old')?.[1]).toMatchObject({
            lifecycle: 'current',
            lastTurnSeq: 1,
            continuedFromConversationId: 'old'
        });
    });

    it('limits tools to eight rounds and explicitly requests a final answer', async () => {
        let calls = 0;
        const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
            calls++;
            const body = JSON.parse(String(init?.body));
            if (body.toolConfig.functionCallingConfig.mode === 'NONE')
                return sseResponse([{ text: 'Bounded answer.' }]);
            return sseResponse([{ functionCall: { name: 'get_knowledge_root', args: {} } }]);
        });
        const { input } = setup(fetchFn);
        await streamChatTurn(input);
        expect(calls).toBe(9);
    });

    it.each(['generation', 'classification', 'truncated'])(
        'does not persist a %s failure',
        async (failure) => {
            const fetchFn = vi.fn<typeof fetch>(async () =>
                failure === 'generation'
                    ? new Response('private upstream body', { status: 500 })
                    : sseResponse([{ text: 'Partial' }], 'MAX_TOKENS')
            );
            const { db, input, events } = setup(fetchFn);
            if (failure === 'classification')
                vi.mocked(buildDynamicPrompt).mockRejectedValueOnce(
                    new Error('Classification failed.')
                );
            await expect(streamChatTurn(input)).rejects.toThrow();
            expect(db.dump().size).toBe(0);
            expect(events.some(({ event }) => event === 'done')).toBe(false);
        }
    );

    it('aborts upstream work and never commits a cancelled answer', async () => {
        const controller = new AbortController();
        let upstreamSignal: AbortSignal | null | undefined;
        const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
            upstreamSignal = init?.signal;
            return sseResponse([{ text: 'Partial' }]);
        });
        const { db, input } = setup(fetchFn);
        await expect(
            streamChatTurn({
                ...input,
                signal: controller.signal,
                send: (event, data) => {
                    input.send(event, data);
                    if (event === 'answer_delta') controller.abort();
                }
            })
        ).rejects.toThrow();
        expect(upstreamSignal?.aborted).toBe(true);
        expect(db.dump().size).toBe(0);
    });

    it('rejects stale commits if another turn completes during generation', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => sseResponse([{ text: 'Stale answer.' }]));
        const { db, input, events } = setup(fetchFn);
        await seedConversation(db);
        await expect(
            streamChatTurn({
                ...input,
                send: (event, data) => {
                    input.send(event, data);
                    if (event === 'answer_delta')
                        void db.doc('conversations/old').set({ lastTurnSeq: 2 }, { merge: true });
                }
            })
        ).rejects.toThrow('Conversation changed');
        expect(events.some(({ event }) => event === 'done')).toBe(false);
        expect(rootConversationDocs(db)[0][1]).toMatchObject({
            lastTurnSeq: 2,
            turns: [{ turnId: 'first-turn' }]
        });
    });
});
