import { createSseResponse } from '$lib/server/chat/sse';
import { describe, expect, it } from 'vitest';

describe('createSseResponse', () => {
    it('streams SSE payloads for an active reader', async () => {
        const response = createSseResponse(async (send) => {
            send('status', {
                type: 'status',
                status: 'collecting_context'
            });
        });

        const text = await response.text();

        expect(text).toContain('event: status');
        expect(text).toContain('"status":"collecting_context"');
    });

    it('ignores late sends and close after the reader cancels', async () => {
        let releaseExecute!: () => void;

        const response = createSseResponse(
            () =>
                new Promise<void>((resolve) => {
                    releaseExecute = resolve;
                })
        );

        const reader = response.body?.getReader();
        expect(reader).toBeTruthy();

        await reader?.cancel();
        releaseExecute();

        await Promise.resolve();
        await Promise.resolve();
    });
});
