import { describe, expect, it, vi } from 'vitest';
import {
    createChatErrorLogPayload,
    logChatInfo,
    summarizeGeminiUsage
} from '$lib/server/telemetry/chat-logger';

describe('chat logger helpers', () => {
    it('summarizes known Gemini usage counters', () => {
        expect(
            summarizeGeminiUsage({
                promptTokenCount: 120,
                candidatesTokenCount: 80,
                totalTokenCount: 200,
                thoughtsTokenCount: 12,
                toolUsePromptTokenCount: 15
            })
        ).toEqual({
            promptTokenCount: 120,
            candidatesTokenCount: 80,
            totalTokenCount: 200,
            thoughtsTokenCount: 12,
            toolUsePromptTokenCount: 15
        });
    });

    it('drops unknown or invalid Gemini usage counters', () => {
        expect(
            summarizeGeminiUsage({
                promptTokenCount: '120',
                candidatesTokenCount: NaN,
                totalTokenCount: 0
            })
        ).toEqual({
            promptTokenCount: null,
            candidatesTokenCount: null,
            totalTokenCount: 0,
            thoughtsTokenCount: null,
            toolUsePromptTokenCount: null
        });
    });

    it('normalizes errors into compact log payloads', () => {
        const payload = createChatErrorLogPayload(new Error('Boom'), { turnId: 'turn-1' });
        expect(payload).toEqual({
            turnId: 'turn-1',
            error: {
                name: 'Error',
                message: 'Boom'
            }
        });
    });

    it('writes structured objects instead of stringified JSON', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

        logChatInfo('chat_turn_started', {
            requestId: 'req-1',
            traceId: 'trace-1'
        });

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: 'chat',
                level: 'info',
                event: 'chat_turn_started',
                requestId: 'req-1',
                traceId: 'trace-1'
            })
        );

        spy.mockRestore();
    });
});
