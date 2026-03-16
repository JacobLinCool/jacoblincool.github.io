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
    it('merges text deltas and function call args across chunks', () => {
        const base: GeminiContent = {
            role: 'model',
            parts: [
                {
                    text: 'Hello',
                    functionCall: {
                        name: 'get_knowledge_item',
                        args: {
                            id: 'project-d1-manager'
                        }
                    }
                }
            ]
        };

        const merged = mergeGeminiContent(base, {
            role: 'model',
            parts: [
                {
                    text: ' world',
                    functionCall: {
                        args: {
                            includeStats: true
                        }
                    }
                }
            ]
        });

        expect(merged).toEqual({
            role: 'model',
            parts: [
                {
                    text: 'Hello world',
                    functionCall: {
                        name: 'get_knowledge_item',
                        args: {
                            id: 'project-d1-manager',
                            includeStats: true
                        }
                    }
                }
            ]
        });
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
