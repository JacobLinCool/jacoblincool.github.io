import { streamChatTurn } from '$lib/server/chat/stream-chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

vi.mock('$lib/server/auth/verify-firebase-token', () => ({
    requireFirebaseUser: vi.fn(async () => ({ uid: 'visitor', isAnonymous: true }))
}));
vi.mock('$lib/server/chat/stream-chat', () => ({ streamChatTurn: vi.fn() }));
vi.mock('$lib/server/firestore-admin', () => ({ getAdminDb: vi.fn(() => ({})) }));
vi.mock('$lib/server/posthog', () => ({ getPostHogClient: vi.fn(() => null) }));
vi.mock('$lib/server/runtime-env', () => ({
    readRuntimeConfig: vi.fn(() => ({ firestoreProjectId: 'test-project' }))
}));

const turnId = '8b6a7438-a8f4-4a21-854e-2fb8bd450869';
const requestId = 'request-error-boundary-test';
const post = (signal?: AbortSignal) => {
    const url = new URL('https://example.test/api/chat/stream');
    const span: Parameters<typeof POST>[0]['tracing']['root'] = {
        spanContext: () => ({ traceId: '0'.repeat(32), spanId: '0'.repeat(16), traceFlags: 0 }),
        setAttribute() {
            return this;
        },
        setAttributes() {
            return this;
        },
        addEvent() {
            return this;
        },
        addLink() {
            return this;
        },
        addLinks() {
            return this;
        },
        setStatus() {
            return this;
        },
        updateName() {
            return this;
        },
        end: vi.fn(),
        isRecording: () => false,
        recordException: vi.fn()
    };
    const event = {
        cookies: {
            get: vi.fn(() => undefined),
            getAll: vi.fn(() => []),
            set: vi.fn(),
            delete: vi.fn(),
            serialize: vi.fn(() => '')
        },
        request: new Request(url, {
            method: 'POST',
            signal,
            headers: { 'content-type': 'application/json', 'x-request-id': requestId },
            body: JSON.stringify({
                message: 'What have you been working on?',
                turnId,
                locale: 'en'
            })
        }),
        fetch: vi.fn<typeof fetch>(),
        getClientAddress: () => '127.0.0.1',
        locals: {},
        params: {},
        platform: undefined,
        route: { id: '/api/chat/stream' },
        setHeaders: vi.fn(),
        url,
        isDataRequest: false,
        isSubRequest: false,
        isRemoteRequest: false,
        tracing: { enabled: false, root: span, current: span }
    } satisfies Parameters<typeof POST>[0];
    return POST(event);
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(streamChatTurn).mockReset();
});

describe('POST /api/chat/stream', () => {
    it.each([
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        new Error('Gemini stream request failed (503).')
    ])(
        'keeps internal failure details in server logs and sends retry guidance: %s',
        async (error) => {
            const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(streamChatTurn).mockRejectedValueOnce(error);

            const response = await post();
            const body = await response.text();

            expect(response.headers.get('content-type')).toContain('text/event-stream');
            expect(response.headers.get('x-request-id')).toBe(requestId);
            expect(body).toBe(
                'event: error\ndata: {"type":"error","message":"The response could not be completed. Please retry."}\n\n'
            );
            expect(body).not.toContain(error.message);
            expect(errorLog).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    event: 'chat_stream_failed',
                    requestId,
                    turnId,
                    error: { name: error.name, message: error.message }
                })
            );
        }
    );

    it('closes an aborted request without reporting a stream failure', async () => {
        const controller = new AbortController();
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(streamChatTurn).mockImplementationOnce(async ({ signal }) => {
            controller.abort();
            expect(signal?.aborted).toBe(true);
            signal?.throwIfAborted();
        });

        const response = await post(controller.signal);

        expect(await response.text()).toBe('');
        expect(streamChatTurn).toHaveBeenCalledOnce();
        expect(errorLog).not.toHaveBeenCalled();
    });
});
