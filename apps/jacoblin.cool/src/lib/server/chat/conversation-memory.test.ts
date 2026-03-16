import {
    DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
    estimateTextTokens,
    loadConversationMemory,
    shouldRollOverConversation
} from '$lib/server/chat/conversation-memory';
import { resolveCurrentConversation } from '$lib/server/repos/conversation-repository';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import { describe, expect, it } from 'vitest';

describe('conversation memory', () => {
    it('returns a transient handle without writing when no current conversation exists', async () => {
        const db = new FakeFirestore();

        const conversation = await resolveCurrentConversation(db as never, {
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });

        expect(conversation.exists).toBe(false);
        expect(conversation.lastTurnSeq).toBe(0);
        expect(db.dump().size).toBe(0);
    });

    it('replays embedded conversation turns from the current chapter', async () => {
        const db = new FakeFirestore();
        const conversationId = 'conversation-1';

        await db.doc('conversation_heads/user-1').set({
            currentConversationId: conversationId,
            rolloverCount: 0,
            updatedAt: '2026-03-17T00:00:00.000Z'
        });
        await db.doc(`conversations/${conversationId}`).set({
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en',
            lifecycle: 'current',
            lastTurnSeq: 1,
            contextTokenCount: estimateTextTokens('Question 1') + estimateTextTokens('Answer 1'),
            carryoverSummary: null,
            continuedFromConversationId: null,
            continuedToConversationId: null,
            archivedAt: null,
            archivedReason: null,
            turns: [
                {
                    turnId: 'turn-1',
                    userText: 'Question 1',
                    assistantText: 'Answer 1',
                    completedAt: '2026-03-17T00:00:01.000Z'
                }
            ],
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T00:00:01.000Z'
        });

        const reloaded = await resolveCurrentConversation(db as never, {
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });
        const memory = await loadConversationMemory(db as never, reloaded);

        expect(reloaded.exists).toBe(true);
        expect(reloaded.lastTurnSeq).toBe(1);
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
                lastTurnSeq: 12,
                carryoverSummary: null,
                contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS,
                continuedFromConversationId: null,
                exists: true
            })
        ).toBe(true);

        expect(
            shouldRollOverConversation({
                conversationId: 'conversation-b',
                lastTurnSeq: 3,
                carryoverSummary: null,
                contextTokenCount: DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS - 1,
                continuedFromConversationId: null,
                exists: true
            })
        ).toBe(false);
    });
});
