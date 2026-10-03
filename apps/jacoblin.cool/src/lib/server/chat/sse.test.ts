import { createSseResponse } from '$lib/server/chat/sse';
import { describe, expect, it, vi } from 'vitest';

describe('createSseResponse', () => {
    it('streams SSE payloads for an active reader', async () => {
        const response = createSseResponse(async (send) => {
            send('status', { type: 'status', status: 'collecting_context' });
        });
        expect(await response.text()).toContain('"status":"collecting_context"');
    });
    it('aborts work and ignores late sends after reader cancellation', async () => {
        let release!: () => void;
        let signal!: AbortSignal;
        const response = createSseResponse(async (send, currentSignal) => {
            signal = currentSignal;
            await new Promise<void>((resolve) => {
                release = resolve;
            });
            send('done', { type: 'done' });
        });
        await Promise.resolve();
        const reader = response.body!.getReader();
        await reader.cancel();
        expect(signal.aborted).toBe(true);
        release();
        await Promise.resolve();
    });
    it('closes the response and clears keepalives on external cancellation', async () => {
        vi.useFakeTimers();
        try {
            const abort = new AbortController();
            let release!: () => void;
            const response = createSseResponse(
                async () =>
                    new Promise<void>((resolve) => {
                        release = resolve;
                    }),
                { signal: abort.signal }
            );
            await Promise.resolve();
            const reader = response.body!.getReader();
            abort.abort();
            expect(await reader.read()).toEqual({ done: true, value: undefined });
            expect(vi.getTimerCount()).toBe(0);
            release();
        } finally {
            vi.useRealTimers();
        }
    });
    it('does not start work for an already cancelled request', async () => {
        const abort = new AbortController();
        abort.abort();
        const execute = vi.fn(async () => {});
        expect(await createSseResponse(execute, { signal: abort.signal }).text()).toBe('');
        expect(execute).not.toHaveBeenCalled();
    });
});
