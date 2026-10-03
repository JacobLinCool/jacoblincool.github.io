import {
    mergeGeminiContent,
    streamGeminiContent,
    type GeminiContent
} from '$lib/server/llm/gemini';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { describe, expect, it, vi } from 'vitest';

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

const createSseResponse = (blocks: string[]) =>
    new Response(
        new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                for (const block of blocks) {
                    controller.enqueue(encoder.encode(block));
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

describe('mergeGeminiContent', () => {
    it('preserves complete tool calls and signed text parts across chunks', () => {
        const base: GeminiContent = {
            role: 'model',
            parts: [
                { text: 'Thinking', thought: true, thoughtSignature: 'sig-a' },
                {
                    functionCall: { name: 'get_knowledge_item', args: { id: 'paper-a' } },
                    thoughtSignature: 'sig-b'
                }
            ]
        };
        const next: GeminiContent = {
            role: 'model',
            parts: [
                { functionCall: { name: 'get_knowledge_item', args: { id: 'paper-b' } } },
                { text: 'Answer', thoughtSignature: 'sig-c' },
                { text: 'more', thoughtSignature: 'sig-d' }
            ]
        };
        expect(mergeGeminiContent(base, next)?.parts).toEqual([...base.parts, ...next.parts]);
        expect(base.parts).toHaveLength(2);
    });
});

describe('streamGeminiContent', () => {
    it('parses SSE chunks and forwards text deltas', async () => {
        const onTextDelta = vi.fn(async () => {});
        const fetchFn: typeof fetch = vi.fn(async () =>
            createSseResponse([
                `data: ${JSON.stringify({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: 'Hello' }]
                            }
                        }
                    ]
                })}\n\n`,
                `data: ${JSON.stringify({
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ text: ' world' }]
                            },
                            finishReason: 'STOP'
                        }
                    ],
                    usageMetadata: {
                        outputTokenCount: 2
                    }
                })}\n\n`
            ])
        ) as typeof fetch;

        const response = await streamGeminiContent({
            fetchFn,
            config,
            systemInstruction: 'You are grounded.',
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            onTextDelta
        });

        expect(onTextDelta).toHaveBeenCalledTimes(2);
        expect(onTextDelta).toHaveBeenNthCalledWith(1, 'Hello');
        expect(onTextDelta).toHaveBeenNthCalledWith(2, ' world');
        expect(response.content?.parts[0]?.text).toBe('Hello world');
        expect(response.finishReason).toBe('STOP');
        expect(response.usage).toEqual({
            outputTokenCount: 2
        });
    });
});

describe('Gemini stream integrity', () => {
    const stream = (blocks: string[], onTextDelta = vi.fn(async () => {})) =>
        streamGeminiContent({
            fetchFn: vi.fn(async () => createSseResponse(blocks)) as typeof fetch,
            config,
            systemInstruction: 'Grounded.',
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            onTextDelta
        });
    it('preserves whitespace across deltas and flushes a final CRLF event without a blank line', async () => {
        const onTextDelta = vi.fn(async () => {});
        const chunk = (text: string, stop = false) =>
            `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...(stop ? { finishReason: 'STOP' } : {}) }] })}`;
        await stream([chunk('Hello ') + '\r', '\n\r\n' + chunk('world', true)], onTextDelta);
        expect(onTextDelta.mock.calls).toEqual([['Hello '], ['world']]);
    });
    it('never exposes thought parts', async () => {
        const onTextDelta = vi.fn(async () => {});
        await stream(
            [
                `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ thought: true, text: 'Private thought' }, { text: 'Answer' }] }, finishReason: 'STOP' }] })}\n\n`
            ],
            onTextDelta
        );
        expect(onTextDelta).toHaveBeenCalledExactlyOnceWith('Answer');
    });
    it('rejects malformed and incomplete streams instead of silently saving partial answers', async () => {
        await expect(stream(['data: {broken}\n\n'])).rejects.toThrow('malformed');
        await expect(stream(['data: {}\n\n'])).rejects.toThrow('before completion');
    });
    it('uses the API-key header and excludes secrets from error messages', async () => {
        const fetchFn = vi.fn<typeof fetch>(
            async () => new Response('private upstream details', { status: 503 })
        );
        await expect(
            streamGeminiContent({
                fetchFn,
                config,
                systemInstruction: '',
                contents: [],
                onTextDelta: async () => {}
            })
        ).rejects.toThrow('Gemini stream request failed (503).');
        expect(String(fetchFn.mock.calls[0][0])).not.toContain('test-key');
        expect(fetchFn.mock.calls[0][1]?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    });
});
