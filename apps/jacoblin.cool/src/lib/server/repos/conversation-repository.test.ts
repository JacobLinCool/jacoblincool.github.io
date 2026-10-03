import {
    commitConversationTurn,
    ConversationCommitConflictError,
    findCommittedTurn,
    resolveCurrentConversation,
    type ConversationHandle
} from '$lib/server/repos/conversation-repository';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import type { Firestore } from 'fires2rest';
import { describe, expect, it } from 'vitest';

type FakeTransaction = Parameters<Parameters<FakeFirestore['runTransaction']>[0]>[0];

/** Model Firestore's serializable commits; the shared fake does not isolate concurrent writes. */
class TransactionalFirestore extends FakeFirestore {
    private previous: Promise<void> = Promise.resolve();
    afterRead?: (path: string) => void;

    override async runTransaction<R>(update: (transaction: FakeTransaction) => Promise<R>) {
        const previous = this.previous;
        let release!: () => void;
        this.previous = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;
        try {
            return await super.runTransaction(async (transaction) => {
                const get = transaction.get.bind(transaction);
                transaction.get = async (ref) => {
                    const snapshot = await get(ref);
                    this.afterRead?.(ref.path);
                    return snapshot;
                };
                return update(transaction);
            });
        } finally {
            release();
        }
    }
}

const owner = { ownerUid: 'user-1', ownerType: 'anonymous' as const, locale: 'en' };
const asDb = (db: FakeFirestore) => db as unknown as Firestore;
const resolve = (db: FakeFirestore, ownerUid = owner.ownerUid) =>
    resolveCurrentConversation(asDb(db), { ...owner, ownerUid });
const input = (baseConversation: ConversationHandle, turnId = 'turn-1') => ({
    ...owner,
    baseConversation,
    turnId,
    userText: 'What is your research about?',
    assistantText: 'Grounded answer.',
    turnContextTokenCount: 20
});
const conversations = (db: FakeFirestore) =>
    [...db.dump('conversations/')].filter(([path]) => /^conversations\/[^/]+$/.test(path));

describe('durable conversation turn receipts', () => {
    it('returns null for an uncommitted turn without writing', async () => {
        const db = new TransactionalFirestore();
        expect(await findCommittedTurn(asDb(db), owner.ownerUid, 'turn-1')).toBeNull();
        expect(db.dump().size).toBe(0);
    });

    it('atomically stores a minimal receipt and keeps the first answer on repeated commit', async () => {
        const db = new TransactionalFirestore();
        const pending = input(await resolve(db));
        const first = await commitConversationTurn(asDb(db), pending);
        const snapshot = db.dump();
        const repeated = await commitConversationTurn(asDb(db), {
            ...pending,
            assistantText: 'An answer from a duplicate generation.'
        });

        expect(repeated).toEqual(first);
        expect(repeated.assistantText).toBe(pending.assistantText);
        expect(db.dump()).toEqual(snapshot);
        expect(db.dump().get('conversation_heads/user-1/turns/turn-1')).toEqual({
            conversationId: first.conversationId
        });
        expect(await findCommittedTurn(asDb(db), owner.ownerUid, 'turn-1')).toMatchObject({
            userText: pending.userText,
            assistantText: pending.assistantText,
            conversation: { conversationId: first.conversationId, lastTurnSeq: first.lastTurnSeq }
        });
    });

    it('commits one turn when duplicate requests race with different provisional conversation ids', async () => {
        const db = new TransactionalFirestore();
        const [baseA, baseB] = await Promise.all([resolve(db), resolve(db)]);
        expect(baseA.conversationId).not.toBe(baseB.conversationId);

        const [first, second] = await Promise.all([
            commitConversationTurn(asDb(db), input(baseA)),
            commitConversationTurn(asDb(db), {
                ...input(baseB),
                assistantText: 'Duplicate answer.'
            })
        ]);

        expect(first).toEqual(second);
        expect(second.assistantText).toBe('Grounded answer.');
        expect(conversations(db)).toHaveLength(1);
        expect(conversations(db)[0][1]).toMatchObject({
            lastTurnSeq: 1,
            contextTokenCount: 20,
            turns: [{ turnId: 'turn-1', assistantText: 'Grounded answer.' }]
        });
    });

    it('deduplicates a current-conversation turn even after a newer turn is committed', async () => {
        const db = new TransactionalFirestore();
        const first = await commitConversationTurn(asDb(db), input(await resolve(db)));
        const secondInput = input(first, 'turn-2');
        const second = await commitConversationTurn(asDb(db), secondInput);
        const third = await commitConversationTurn(asDb(db), {
            ...input(second, 'turn-3'),
            assistantText: 'A distinct third answer.'
        });
        const snapshot = db.dump();

        expect(await commitConversationTurn(asDb(db), secondInput)).toEqual({
            ...third,
            assistantText: secondInput.assistantText
        });
        expect(db.dump()).toEqual(snapshot);
        expect(
            (await findCommittedTurn(asDb(db), owner.ownerUid, 'turn-2'))?.conversation
                .conversationId
        ).toBe(first.conversationId);
    });

    it('replays archived turns and deduplicates the rollover itself without moving the head', async () => {
        const db = new TransactionalFirestore();
        const firstInput = input(await resolve(db));
        const first = await commitConversationTurn(asDb(db), firstInput);
        const rolloverInput = {
            ...input(first, 'turn-2'),
            rollover: {
                archivedReason: 'context_limit' as const,
                carryoverSummary: 'Earlier discussion.',
                carryoverContextTokenCount: 5
            }
        };
        const current = await commitConversationTurn(asDb(db), rolloverInput);
        const snapshot = db.dump();

        expect(current.conversationId).not.toBe(first.conversationId);
        expect(await commitConversationTurn(asDb(db), rolloverInput)).toEqual(current);
        expect(await commitConversationTurn(asDb(db), firstInput)).toEqual(first);
        expect(db.dump()).toEqual(snapshot);
        expect(await findCommittedTurn(asDb(db), owner.ownerUid, 'turn-1')).toMatchObject({
            assistantText: firstInput.assistantText,
            conversation: { conversationId: first.conversationId }
        });
        expect((await resolve(db)).conversationId).toBe(current.conversationId);
        expect(db.dump().get('conversation_heads/user-1')).toMatchObject({ rolloverCount: 1 });
        expect(conversations(db)).toHaveLength(2);
    });

    it('rejects concurrent reuse of a turn id for another message', async () => {
        const db = new TransactionalFirestore();
        const base = await resolve(db);
        const outcomes = await Promise.allSettled([
            commitConversationTurn(asDb(db), input(base)),
            commitConversationTurn(asDb(db), { ...input(base), userText: 'Another question.' })
        ]);

        expect(outcomes[0].status).toBe('fulfilled');
        expect(outcomes[1]).toMatchObject({
            status: 'rejected',
            reason: new ConversationCommitConflictError('This turn id belongs to another message.')
        });
        expect(conversations(db)).toHaveLength(1);
        expect(conversations(db)[0][1].lastTurnSeq).toBe(1);
    });

    it('scopes the same turn id independently to each owner', async () => {
        const db = new TransactionalFirestore();
        const first = await commitConversationTurn(asDb(db), input(await resolve(db)));
        const second = await commitConversationTurn(asDb(db), {
            ...input(await resolve(db, 'user-2')),
            ownerUid: 'user-2',
            assistantText: 'Another owner’s answer.'
        });

        expect(first.conversationId).not.toBe(second.conversationId);
        expect((await findCommittedTurn(asDb(db), 'user-1', 'turn-1'))?.assistantText).toBe(
            'Grounded answer.'
        );
        expect((await findCommittedTurn(asDb(db), 'user-2', 'turn-1'))?.assistantText).toBe(
            'Another owner’s answer.'
        );
    });

    it('rejects a receipt pointing to another owner instead of exposing their message', async () => {
        const db = new TransactionalFirestore();
        const first = await commitConversationTurn(asDb(db), input(await resolve(db)));
        await db
            .doc('conversation_heads/user-2/turns/turn-1')
            .set({ conversationId: first.conversationId });

        await expect(findCommittedTurn(asDb(db), 'user-2', 'turn-1')).rejects.toThrow(
            'could not be verified'
        );
        const snapshot = db.dump();
        await expect(
            commitConversationTurn(asDb(db), {
                ...input(await resolve(db, 'user-2')),
                ownerUid: 'user-2'
            })
        ).rejects.toThrow('could not be verified');
        expect(db.dump()).toEqual(snapshot);
    });

    it('fails explicitly for a broken receipt and never regenerates a missing committed turn', async () => {
        const db = new TransactionalFirestore();
        await db.doc('conversation_heads/user-1/turns/turn-1').set({ conversationId: 'missing' });
        await expect(findCommittedTurn(asDb(db), 'user-1', 'turn-1')).rejects.toThrow(
            'could not be verified'
        );
    });

    it('leaves no receipt when the conversation sequence has changed', async () => {
        const db = new TransactionalFirestore();
        const stale = await commitConversationTurn(asDb(db), input(await resolve(db)));
        await commitConversationTurn(asDb(db), input(stale, 'turn-2'));
        const snapshot = db.dump();

        await expect(
            commitConversationTurn(asDb(db), input(stale, 'turn-3'))
        ).rejects.toBeInstanceOf(ConversationCommitConflictError);
        expect(db.dump()).toEqual(snapshot);
        expect(await findCommittedTurn(asDb(db), 'user-1', 'turn-3')).toBeNull();
    });

    it('does not enter a transaction for a request that is already cancelled', async () => {
        const db = new TransactionalFirestore();
        const controller = new AbortController();
        const pending = input(await resolve(db));
        controller.abort();

        await expect(
            commitConversationTurn(asDb(db), { ...pending, signal: controller.signal })
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(db.dump().size).toBe(0);
    });

    it.each(['new', 'current', 'rollover'] as const)(
        'does not write after cancellation during %s transaction reads',
        async (mode) => {
            const db = new TransactionalFirestore();
            let base = await resolve(db);
            if (mode !== 'new') base = await commitConversationTurn(asDb(db), input(base));
            const snapshot = db.dump();
            const controller = new AbortController();
            db.afterRead = (path) => {
                if (path === 'conversation_heads/user-1') controller.abort();
            };

            await expect(
                commitConversationTurn(asDb(db), {
                    ...input(base, 'turn-2'),
                    signal: controller.signal,
                    ...(mode === 'rollover'
                        ? {
                              rollover: {
                                  archivedReason: 'context_limit' as const,
                                  carryoverSummary: 'Summary.',
                                  carryoverContextTokenCount: 3
                              }
                          }
                        : {})
                })
            ).rejects.toMatchObject({ name: 'AbortError' });
            expect(db.dump()).toEqual(snapshot);
        }
    );
});
