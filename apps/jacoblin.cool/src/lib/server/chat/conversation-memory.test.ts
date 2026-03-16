import {
    compactConversationMemory,
    loadConversationMemory
} from '$lib/server/chat/conversation-memory';
import {
    ensureConversation,
    persistConversationMessage
} from '$lib/server/repos/conversation-repository';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import { describe, expect, it } from 'vitest';

describe('conversation memory compaction', () => {
    it('summarizes older finalized messages and keeps only the latest eight for replay', async () => {
        const db = new FakeFirestore();
        const conversation = await ensureConversation(db as never, {
            requestedConversationId: 'conversation-memory',
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });

        let seq = conversation.seq;
        for (let index = 0; index < 7; index += 1) {
            seq += 1;
            await persistConversationMessage(
                db as never,
                conversation.conversationId,
                seq,
                `turn-${index}`,
                'user',
                `Question ${index + 1}`,
                true
            );
            seq += 1;
            await persistConversationMessage(
                db as never,
                conversation.conversationId,
                seq,
                `turn-${index}`,
                'assistant',
                `Answer ${index + 1}`,
                true
            );
        }

        const summary = await compactConversationMemory(db as never, conversation);
        expect(summary.summarySeq).toBeGreaterThan(0);
        expect(summary.memorySummary).toContain('Earlier conversation summary');
        expect(summary.memorySummary).toContain('Question 3');

        const reloaded = await ensureConversation(db as never, {
            requestedConversationId: conversation.conversationId,
            ownerUid: 'user-1',
            ownerType: 'anonymous',
            locale: 'en'
        });
        const memory = await loadConversationMemory(db as never, reloaded);

        expect(memory.memorySummary).toBeTruthy();
        expect(memory.recentContents).toHaveLength(8);
        expect(memory.recentContents.at(0)?.parts[0]).toMatchObject({
            text: 'Question 4'
        });
        expect(memory.recentContents.at(-1)?.parts[0]).toMatchObject({
            text: 'Answer 7'
        });
    });
});
