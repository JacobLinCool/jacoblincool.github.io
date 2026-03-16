import {
    DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
    estimateTextTokens,
    loadConversationMemory,
    shouldRollOverConversation
} from '$lib/server/chat/conversation-memory';
import {
    persistConversationMessage,
    resolveCurrentConversation
} from '$lib/server/repos/conversation-repository';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import { describe, expect, it } from 'vitest';

describe('conversation memory', () => {
    it('replays all finalized messages from the current conversation chapter', async () => {
        const db = new FakeFirestore();
        const conversation = await resolveCurrentConversation(db as never, {
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });

        let seq = conversation.seq;
        seq += 1;
        await persistConversationMessage(
            db as never,
            conversation.conversationId,
            seq,
            'turn-1',
            'user',
            'Question 1',
            true,
            estimateTextTokens('Question 1')
        );
        seq += 1;
        await persistConversationMessage(
            db as never,
            conversation.conversationId,
            seq,
            'turn-1',
            'assistant',
            'Answer 1',
            true,
            estimateTextTokens('Answer 1')
        );

        const reloaded = await resolveCurrentConversation(db as never, {
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });
        const memory = await loadConversationMemory(db as never, reloaded);

        expect(memory.carryoverSummary).toBeNull();
        expect(memory.totalFinalizedMessages).toBe(2);
        expect(memory.contents).toHaveLength(2);
        expect(memory.contents.at(0)).toMatchObject({
            role: 'user',
            parts: [{ text: 'Question 1' }]
        });
        expect(memory.contents.at(-1)).toMatchObject({
            role: 'model',
            parts: [{ text: 'Answer 1' }]
        });
    });

    it('uses the stored context token count to decide when a rollover is required', () => {
        expect(
            shouldRollOverConversation({
                conversationId: 'conversation-a',
                seq: 12,
                carryoverSummary: null,
                contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
                continuedFromConversationId: null
            })
        ).toBe(true);

        expect(
            shouldRollOverConversation({
                conversationId: 'conversation-b',
                seq: 3,
                carryoverSummary: null,
                contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS - 1,
                continuedFromConversationId: null
            })
        ).toBe(false);
    });
});
