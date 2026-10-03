import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChat } from './chat-api';

const { ensureAuthToken } = vi.hoisted(() => ({ ensureAuthToken: vi.fn() }));
vi.mock('$lib/services/auth-session', () => ({ ensureAuthToken }));

const encoder = new TextEncoder();
const doneEvent = { type: 'done', contentVersion: 'v1', dynamicRevisions: {} };
const options = () => ({
    turnId: '12345678-1234-4123-8123-123456789abc',
    message: 'What does Jacob research?',
    locale: 'en',
    signal: new AbortController().signal,
    onEvent: vi.fn()
});
const response = (chunks: Uint8Array[]) =>
    new Response(
        new ReadableStream({
            start(controller) {
                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
            }
        })
    );
const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

beforeEach(() => {
    ensureAuthToken.mockReset().mockResolvedValue('test-token');
});
afterEach(() => vi.unstubAllGlobals());

describe('chat stream transport', () => {
    it('preserves UTF-8 and SSE frames split at arbitrary byte boundaries, including CRLF', async () => {
        const delta = { type: 'answer_delta', delta: '你好 👋' };
        const wire = encoder.encode(
            `: keepalive\r\n\r\n${sse(delta)}${sse(doneEvent)}`.replace(/(?<!\r)\n/g, '\r\n')
        );
        const fetchMock = vi
            .fn()
            .mockResolvedValue(response(Array.from(wire, (byte) => new Uint8Array([byte]))));
        vi.stubGlobal('fetch', fetchMock);
        const input = options();
        await streamChat(input);
        expect(input.onEvent.mock.calls.map(([event]) => event)).toEqual([delta, doneEvent]);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            turnId: input.turnId,
            message: input.message,
            locale: 'en'
        });
        expect(fetchMock.mock.calls[0][1].signal).toBe(input.signal);
    });

    it('rejects server error events rather than reporting a successful turn', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    response([
                        encoder.encode(sse({ type: 'error', message: 'Classifier unavailable' }))
                    ])
                )
        );
        await expect(streamChat(options())).rejects.toThrow('Classifier unavailable');
    });

    it('propagates application callback failures and cancels the open stream', async () => {
        const cancel = vi.fn();
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(sse({ type: 'answer_delta', delta: 'text' })));
            },
            cancel
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
        await expect(
            streamChat({
                ...options(),
                onEvent: () => {
                    throw new Error('render failure');
                }
            })
        ).rejects.toThrow('render failure');
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('rejects a truncated stream while preserving deltas already delivered', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    response([
                        encoder.encode(sse({ type: 'answer_delta', delta: 'partial answer' }))
                    ])
                )
        );
        const input = options();
        await expect(streamChat(input)).rejects.toThrow('connection ended');
        expect(input.onEvent).toHaveBeenCalledWith({
            type: 'answer_delta',
            delta: 'partial answer'
        });
    });

    it.each(['data: {broken}\n\n', 'data: {"type":"answer_delta","delta":null}\n\n'])(
        'rejects unreadable protocol data: %s',
        async (wire) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([encoder.encode(wire)])));
            await expect(streamChat(options())).rejects.toThrow('could not be read');
        }
    );

    it('stops promptly during authentication without sending the prompt', async () => {
        let resolveToken!: (value: string) => void;
        ensureAuthToken.mockReturnValue(
            new Promise<string>((resolve) => {
                resolveToken = resolve;
            })
        );
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const controller = new AbortController();
        const request = streamChat({ ...options(), signal: controller.signal });
        controller.abort();
        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        resolveToken('late-token');
        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not initialize auth or send a request after cancellation', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(streamChat({ ...options(), signal: controller.signal })).rejects.toMatchObject(
            { name: 'AbortError' }
        );
        expect(ensureAuthToken).not.toHaveBeenCalled();
    });
});

it('does not dispatch a completion delivered after stop while read is pending', async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            source = controller;
        }
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const input = { ...options(), signal: controller.signal };
    const request = streamChat(input);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    source.enqueue(encoder.encode(sse(doneEvent)));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(input.onEvent).not.toHaveBeenCalled();
});
