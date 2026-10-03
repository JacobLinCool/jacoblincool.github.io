import { describe, expect, it } from 'vitest';
import { chatErrorMessage } from './chat-errors';

describe('chat recovery copy', () => {
    it('replaces Firebase network internals with an actionable connection message', () => {
        const error = Object.assign(new Error('Firebase: Error (auth/network-request-failed).'), {
            code: 'auth/network-request-failed'
        });
        expect(chatErrorMessage(error)).toBe(
            'Could not connect to the chat service. Check your connection and retry.'
        );
    });
    it('keeps raw authentication configuration errors out of the conversation', () => {
        const error = Object.assign(new Error('Firebase: Error (auth/invalid-api-key).'), {
            code: 'auth/invalid-api-key'
        });
        expect(chatErrorMessage(error)).toBe(
            'Chat is currently unavailable. Please try again later.'
        );
    });
});
