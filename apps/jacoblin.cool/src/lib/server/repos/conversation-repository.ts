import type { Firestore } from 'fires2rest';

type ConversationHeadDoc = {
    currentConversationId?: string;
    rolloverCount?: number;
    updatedAt?: string;
};

type ConversationDoc = {
    ownerUid?: string;
    ownerType?: 'anonymous' | 'google';
    locale?: string;
    lifecycle?: 'current' | 'archived';
    lastTurnSeq?: number;
    contextTokenCount?: number;
    carryoverSummary?: string | null;
    continuedFromConversationId?: string | null;
    continuedToConversationId?: string | null;
    archivedAt?: string | null;
    archivedReason?: 'context_limit' | 'manual_reset' | null;
    turns?: ConversationTurn[];
    createdAt?: string;
    updatedAt?: string;
};

export type ConversationTurn = {
    turnId: string;
    userText: string;
    assistantText: string;
    completedAt: string;
};

export type ConversationHandle = {
    conversationId: string;
    lastTurnSeq: number;
    carryoverSummary: string | null;
    contextTokenCount: number;
    continuedFromConversationId: string | null;
    exists: boolean;
};

export type CommittedConversationTurn = ConversationTurn & {
    conversation: ConversationHandle;
};

export type StoredConversationMessage = {
    id: string;
    seq: number;
    turnId: string;
    role: 'user' | 'assistant';
    content: string;
    final: boolean;
    model: string | null;
    usage: Record<string, unknown> | null;
    parts: unknown[] | null;
    createdAt: string;
};

export type ResolveCurrentConversationInput = {
    ownerUid: string;
    ownerType: 'anonymous' | 'google';
    locale: string;
};

type CommitConversationTurnInput = ResolveCurrentConversationInput & {
    baseConversation: ConversationHandle;
    turnId: string;
    userText: string;
    assistantText: string;
    turnContextTokenCount: number;
    signal?: AbortSignal;
    rollover?: {
        archivedReason: 'context_limit' | 'manual_reset';
        carryoverSummary: string | null;
        carryoverContextTokenCount: number;
    } | null;
};

const CONFLICT_MESSAGE = 'Conversation changed during generation. Please retry your message.';

const nowIso = () => new Date().toISOString();

const conversationHeadPath = (ownerUid: string) => `conversation_heads/${ownerUid}`;
const conversationPath = (conversationId: string) => `conversations/${conversationId}`;
const committedTurnPath = (ownerUid: string, turnId: string) => {
    if (!ownerUid || ownerUid.includes('/') || !turnId || turnId.includes('/')) {
        throw new Error('Conversation owner and turn ids must be valid document ids.');
    }
    return `${conversationHeadPath(ownerUid)}/turns/${turnId}`;
};

const toLastTurnSeq = (raw: ConversationDoc | undefined) =>
    typeof raw?.lastTurnSeq === 'number' ? raw.lastTurnSeq : 0;

const toContextTokenCount = (raw: ConversationDoc | undefined) =>
    typeof raw?.contextTokenCount === 'number' ? raw.contextTokenCount : 0;

const toCarryoverSummary = (raw: ConversationDoc | undefined) =>
    typeof raw?.carryoverSummary === 'string' ? raw.carryoverSummary : null;

const toContinuedFromConversationId = (raw: ConversationDoc | undefined) =>
    typeof raw?.continuedFromConversationId === 'string' ? raw.continuedFromConversationId : null;

const isConversationTurn = (value: unknown): value is ConversationTurn => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.turnId === 'string' &&
        typeof candidate.userText === 'string' &&
        typeof candidate.assistantText === 'string' &&
        typeof candidate.completedAt === 'string'
    );
};

const normalizeTurns = (value: unknown): ConversationTurn[] =>
    Array.isArray(value) ? value.filter(isConversationTurn) : [];

const hasReadableTurns = (raw: ConversationDoc | undefined) => Array.isArray(raw?.turns);

const isReadableCurrentConversation = (raw: ConversationDoc | undefined, ownerUid: string) =>
    raw?.ownerUid === ownerUid && raw?.lifecycle !== 'archived' && hasReadableTurns(raw);

const createConversationHandle = (
    conversationId: string,
    raw: ConversationDoc | undefined,
    exists: boolean
): ConversationHandle => ({
    conversationId,
    lastTurnSeq: toLastTurnSeq(raw),
    carryoverSummary: toCarryoverSummary(raw),
    contextTokenCount: toContextTokenCount(raw),
    continuedFromConversationId: toContinuedFromConversationId(raw),
    exists
});

const createTransientConversationHandle = (db: Firestore): ConversationHandle => ({
    conversationId: db.collection('conversations').doc().id,
    lastTurnSeq: 0,
    carryoverSummary: null,
    contextTokenCount: 0,
    continuedFromConversationId: null,
    exists: false
});

const createConversationDoc = ({
    ownerUid,
    ownerType,
    locale,
    carryoverSummary,
    continuedFromConversationId,
    contextTokenCount,
    turns,
    lastTurnSeq
}: {
    ownerUid: string;
    ownerType: 'anonymous' | 'google';
    locale: string;
    carryoverSummary: string | null;
    continuedFromConversationId: string | null;
    contextTokenCount: number;
    turns: ConversationTurn[];
    lastTurnSeq: number;
}): ConversationDoc => {
    const timestamp = nowIso();
    return {
        ownerUid,
        ownerType,
        locale,
        lifecycle: 'current',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastTurnSeq,
        contextTokenCount,
        carryoverSummary,
        continuedFromConversationId,
        continuedToConversationId: null,
        archivedAt: null,
        archivedReason: null,
        turns
    };
};

const buildStoredMessages = (turns: ConversationTurn[]): StoredConversationMessage[] =>
    turns.flatMap((turn, index) => {
        const userSeq = index * 2 + 1;
        const assistantSeq = userSeq + 1;

        return [
            {
                id: `user-${turn.turnId}-${String(userSeq).padStart(6, '0')}`,
                seq: userSeq,
                turnId: turn.turnId,
                role: 'user' as const,
                content: turn.userText,
                final: true,
                model: null,
                usage: null,
                parts: null,
                createdAt: turn.completedAt
            },
            {
                id: `assistant-${turn.turnId}-${String(assistantSeq).padStart(6, '0')}`,
                seq: assistantSeq,
                turnId: turn.turnId,
                role: 'assistant' as const,
                content: turn.assistantText,
                final: true,
                model: null,
                usage: null,
                parts: null,
                createdAt: turn.completedAt
            }
        ];
    });

const assertCommitCondition = (condition: boolean) => {
    if (!condition) {
        throw new ConversationCommitConflictError();
    }
};

export class ConversationCommitConflictError extends Error {
    constructor(message = CONFLICT_MESSAGE) {
        super(message);
        this.name = 'ConversationCommitConflictError';
    }
}

type ReadDocument = (path: string) => Promise<{ exists: boolean; data: () => unknown }>;

const readCommittedTurn = async (
    read: ReadDocument,
    ownerUid: string,
    turnId: string
): Promise<CommittedConversationTurn | null> => {
    const receiptSnapshot = await read(committedTurnPath(ownerUid, turnId));
    if (!receiptSnapshot.exists) return null;

    const receipt = receiptSnapshot.data() as { conversationId?: unknown } | undefined;
    const conversationId = receipt?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId || conversationId.includes('/')) {
        throw new Error('Committed conversation turn has an invalid receipt.');
    }

    const snapshot = await read(conversationPath(conversationId));
    const conversation = snapshot.data() as ConversationDoc | undefined;
    if (!snapshot.exists || conversation?.ownerUid !== ownerUid) {
        throw new Error('Committed conversation turn could not be verified.');
    }
    const turns = normalizeTurns(conversation.turns).filter((turn) => turn.turnId === turnId);
    if (turns.length !== 1) {
        throw new Error('Committed conversation turn could not be verified.');
    }

    return {
        ...turns[0],
        conversation: createConversationHandle(conversationId, conversation, true)
    };
};

/** Durable lookup survives conversation rollover without copying message contents. */
export const findCommittedTurn = (
    db: Firestore,
    ownerUid: string,
    turnId: string
): Promise<CommittedConversationTurn | null> =>
    readCommittedTurn((path) => db.doc(path).get(), ownerUid, turnId);

export const resolveCurrentConversation = async (
    db: Firestore,
    input: ResolveCurrentConversationInput
): Promise<ConversationHandle> => {
    const headSnapshot = await db.doc(conversationHeadPath(input.ownerUid)).get();
    if (!headSnapshot.exists) {
        return createTransientConversationHandle(db);
    }

    const head = (headSnapshot.data() as ConversationHeadDoc | undefined) ?? {};
    const currentConversationId =
        typeof head.currentConversationId === 'string' ? head.currentConversationId : null;
    if (!currentConversationId) {
        return createTransientConversationHandle(db);
    }

    const conversationSnapshot = await db.doc(conversationPath(currentConversationId)).get();
    if (!conversationSnapshot.exists) {
        return createTransientConversationHandle(db);
    }

    const raw = conversationSnapshot.data() as ConversationDoc | undefined;
    if (!isReadableCurrentConversation(raw, input.ownerUid)) {
        return createTransientConversationHandle(db);
    }

    return createConversationHandle(currentConversationId, raw, true);
};

export const commitConversationTurn = async (
    db: Firestore,
    input: CommitConversationTurnInput
): Promise<ConversationHandle & { assistantText: string }> => {
    input.signal?.throwIfAborted();
    const headRef = db.doc(conversationHeadPath(input.ownerUid));
    const receiptRef = db.doc(committedTurnPath(input.ownerUid, input.turnId));
    const createNewConversation = !input.baseConversation.exists || Boolean(input.rollover);
    const nextConversationId =
        createNewConversation && input.baseConversation.exists
            ? db.collection('conversations').doc().id
            : input.baseConversation.conversationId;

    return db.runTransaction(async (transaction) => {
        input.signal?.throwIfAborted();
        const committed = await readCommittedTurn(
            (path) => transaction.get(db.doc(path)),
            input.ownerUid,
            input.turnId
        );
        input.signal?.throwIfAborted();
        if (committed) {
            if (committed.userText !== input.userText) {
                throw new ConversationCommitConflictError(
                    'This turn id belongs to another message.'
                );
            }
            return { ...committed.conversation, assistantText: committed.assistantText };
        }

        const timestamp = nowIso();
        const turn: ConversationTurn = {
            turnId: input.turnId,
            userText: input.userText,
            assistantText: input.assistantText,
            completedAt: timestamp
        };

        const headSnapshot = await transaction.get(headRef);
        const head = headSnapshot.exists
            ? ((headSnapshot.data() as ConversationHeadDoc | undefined) ?? {})
            : {};
        const headConversationId =
            typeof head.currentConversationId === 'string' ? head.currentConversationId : null;

        if (!input.baseConversation.exists) {
            if (headConversationId) {
                const activeSnapshot = await transaction.get(
                    db.doc(conversationPath(headConversationId))
                );
                if (activeSnapshot.exists) {
                    const active = activeSnapshot.data() as ConversationDoc | undefined;
                    assertCommitCondition(
                        !hasReadableTurns(active) || active?.lifecycle === 'archived'
                    );
                }
            }

            const createdDoc = createConversationDoc({
                ownerUid: input.ownerUid,
                ownerType: input.ownerType,
                locale: input.locale,
                carryoverSummary: null,
                continuedFromConversationId: null,
                contextTokenCount: input.turnContextTokenCount,
                turns: [turn],
                lastTurnSeq: 1
            });

            input.signal?.throwIfAborted();
            transaction.set(receiptRef, { conversationId: nextConversationId });
            transaction.set(db.doc(conversationPath(nextConversationId)), createdDoc);
            transaction.set(
                headRef,
                {
                    currentConversationId: nextConversationId,
                    rolloverCount: typeof head.rolloverCount === 'number' ? head.rolloverCount : 0,
                    updatedAt: createdDoc.updatedAt
                },
                { merge: true }
            );

            return {
                ...createConversationHandle(nextConversationId, createdDoc, true),
                assistantText: turn.assistantText
            };
        }

        const currentConversationRef = db.doc(
            conversationPath(input.baseConversation.conversationId)
        );
        const currentSnapshot = await transaction.get(currentConversationRef);
        assertCommitCondition(currentSnapshot.exists);

        const current = currentSnapshot.data() as ConversationDoc | undefined;
        assertCommitCondition(headConversationId === input.baseConversation.conversationId);
        assertCommitCondition(isReadableCurrentConversation(current, input.ownerUid));
        assertCommitCondition(toLastTurnSeq(current) === input.baseConversation.lastTurnSeq);

        const currentTurns = normalizeTurns(current?.turns);

        if (!input.rollover) {
            const updatedDoc: ConversationDoc = {
                turns: [...currentTurns, turn],
                lastTurnSeq: input.baseConversation.lastTurnSeq + 1,
                contextTokenCount: toContextTokenCount(current) + input.turnContextTokenCount,
                updatedAt: timestamp
            };

            input.signal?.throwIfAborted();
            transaction.set(receiptRef, { conversationId: input.baseConversation.conversationId });
            transaction.set(currentConversationRef, updatedDoc, { merge: true });

            return {
                ...createConversationHandle(
                    input.baseConversation.conversationId,
                    {
                        ...current,
                        ...updatedDoc
                    },
                    true
                ),
                assistantText: turn.assistantText
            };
        }

        const nextConversationRef = db.doc(conversationPath(nextConversationId));
        const nextConversationDoc = createConversationDoc({
            ownerUid: input.ownerUid,
            ownerType: input.ownerType,
            locale: input.locale,
            carryoverSummary: input.rollover.carryoverSummary,
            continuedFromConversationId: input.baseConversation.conversationId,
            contextTokenCount:
                input.rollover.carryoverContextTokenCount + input.turnContextTokenCount,
            turns: [turn],
            lastTurnSeq: 1
        });

        input.signal?.throwIfAborted();
        transaction.set(receiptRef, { conversationId: nextConversationId });
        transaction.set(
            currentConversationRef,
            {
                lifecycle: 'archived',
                archivedAt: timestamp,
                archivedReason: input.rollover.archivedReason,
                continuedToConversationId: nextConversationId,
                updatedAt: timestamp
            },
            { merge: true }
        );
        transaction.set(nextConversationRef, nextConversationDoc);
        transaction.set(
            headRef,
            {
                currentConversationId: nextConversationId,
                rolloverCount:
                    (typeof head.rolloverCount === 'number' ? head.rolloverCount : 0) + 1,
                updatedAt: nextConversationDoc.updatedAt
            },
            { merge: true }
        );

        return {
            ...createConversationHandle(nextConversationId, nextConversationDoc, true),
            assistantText: turn.assistantText
        };
    });
};

export const listConversationMessages = async (
    db: Firestore,
    conversationId: string
): Promise<StoredConversationMessage[]> => {
    const snapshot = await db.doc(conversationPath(conversationId)).get();
    if (!snapshot.exists) {
        return [];
    }

    const raw = snapshot.data() as ConversationDoc | undefined;
    if (!hasReadableTurns(raw)) {
        return [];
    }

    return buildStoredMessages(normalizeTurns(raw?.turns));
};
