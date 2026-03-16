import { FieldValue, type Firestore } from 'fires2rest';

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
    status?: 'pending' | 'streaming' | 'done' | 'error';
    lastTurnSeq?: number;
    contextTokenCount?: number;
    carryoverSummary?: string | null;
    continuedFromConversationId?: string | null;
    continuedToConversationId?: string | null;
    archivedAt?: string | null;
    archivedReason?: 'context_limit' | 'manual_reset' | null;
};

export type ConversationHandle = {
    conversationId: string;
    seq: number;
    carryoverSummary: string | null;
    contextTokenCount: number;
    continuedFromConversationId: string | null;
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

type RolloverConversationInput = ResolveCurrentConversationInput & {
    currentConversationId: string;
    carryoverSummary: string | null;
    archivedReason: 'context_limit' | 'manual_reset';
    initialContextTokenCount: number;
};

const nowIso = () => new Date().toISOString();

const conversationHeadPath = (ownerUid: string) => `conversation_heads/${ownerUid}`;
const conversationPath = (conversationId: string) => `conversations/${conversationId}`;

const createConversationHandle = (
    conversationId: string,
    raw: ConversationDoc | undefined
): ConversationHandle => ({
    conversationId,
    seq: typeof raw?.lastTurnSeq === 'number' ? raw.lastTurnSeq : 0,
    carryoverSummary: typeof raw?.carryoverSummary === 'string' ? raw.carryoverSummary : null,
    contextTokenCount: typeof raw?.contextTokenCount === 'number' ? raw.contextTokenCount : 0,
    continuedFromConversationId:
        typeof raw?.continuedFromConversationId === 'string'
            ? raw.continuedFromConversationId
            : null
});

const createConversationDoc = ({
    ownerUid,
    ownerType,
    locale,
    carryoverSummary,
    continuedFromConversationId,
    contextTokenCount
}: {
    ownerUid: string;
    ownerType: 'anonymous' | 'google';
    locale: string;
    carryoverSummary: string | null;
    continuedFromConversationId: string | null;
    contextTokenCount: number;
}): ConversationDoc & {
    createdAt: string;
    updatedAt: string;
} => {
    const timestamp = nowIso();
    return {
        ownerUid,
        ownerType,
        locale,
        lifecycle: 'current',
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastTurnSeq: 0,
        contextTokenCount,
        carryoverSummary,
        continuedFromConversationId,
        continuedToConversationId: null,
        archivedAt: null,
        archivedReason: null
    };
};

const getConversationHandleFromHead = async (
    db: Firestore,
    ownerUid: string
): Promise<ConversationHandle | null> => {
    const headSnapshot = await db.doc(conversationHeadPath(ownerUid)).get();
    if (!headSnapshot.exists) {
        return null;
    }

    const head = headSnapshot.data() as ConversationHeadDoc | undefined;
    if (typeof head?.currentConversationId !== 'string' || !head.currentConversationId) {
        return null;
    }

    const conversationSnapshot = await db.doc(conversationPath(head.currentConversationId)).get();
    if (!conversationSnapshot.exists) {
        return null;
    }

    const raw = conversationSnapshot.data() as ConversationDoc | undefined;
    if (raw?.ownerUid !== ownerUid || raw?.lifecycle === 'archived') {
        return null;
    }

    return createConversationHandle(head.currentConversationId, raw);
};

export const resolveCurrentConversation = async (
    db: Firestore,
    input: ResolveCurrentConversationInput
): Promise<ConversationHandle> => {
    const existing = await getConversationHandleFromHead(db, input.ownerUid);
    if (existing) {
        return existing;
    }

    const headRef = db.doc(conversationHeadPath(input.ownerUid));
    const conversationId = db.collection('conversations').doc().id;
    const conversationRef = db.doc(conversationPath(conversationId));

    return db.runTransaction(async (transaction) => {
        const headSnapshot = await transaction.get(headRef);
        const head = headSnapshot.exists
            ? ((headSnapshot.data() as ConversationHeadDoc) ?? {})
            : {};
        const currentConversationId =
            typeof head.currentConversationId === 'string' ? head.currentConversationId : null;

        if (currentConversationId) {
            const currentSnapshot = await transaction.get(
                db.doc(conversationPath(currentConversationId))
            );
            if (currentSnapshot.exists) {
                const raw = (currentSnapshot.data() as ConversationDoc | undefined) ?? {};
                if (raw.ownerUid !== input.ownerUid) {
                    throw new Error('Current conversation does not belong to this user.');
                }

                if (raw.lifecycle !== 'archived') {
                    return createConversationHandle(currentConversationId, raw);
                }
            }
        }

        const createdDoc = createConversationDoc({
            ownerUid: input.ownerUid,
            ownerType: input.ownerType,
            locale: input.locale,
            carryoverSummary: null,
            continuedFromConversationId: null,
            contextTokenCount: 0
        });

        transaction.set(conversationRef, createdDoc);
        transaction.set(
            headRef,
            {
                currentConversationId: conversationId,
                rolloverCount: typeof head.rolloverCount === 'number' ? head.rolloverCount : 0,
                updatedAt: createdDoc.updatedAt
            },
            { merge: true }
        );

        return createConversationHandle(conversationId, createdDoc);
    });
};

export const rolloverCurrentConversation = async (
    db: Firestore,
    input: RolloverConversationInput
): Promise<ConversationHandle> => {
    const headRef = db.doc(conversationHeadPath(input.ownerUid));
    const currentRef = db.doc(conversationPath(input.currentConversationId));
    const nextConversationId = db.collection('conversations').doc().id;
    const nextConversationRef = db.doc(conversationPath(nextConversationId));

    return db.runTransaction(async (transaction) => {
        const headSnapshot = await transaction.get(headRef);
        const currentSnapshot = await transaction.get(currentRef);

        if (!currentSnapshot.exists) {
            throw new Error('Current conversation is missing.');
        }

        const current = (currentSnapshot.data() as ConversationDoc | undefined) ?? {};
        if (current.ownerUid !== input.ownerUid) {
            throw new Error('Current conversation does not belong to this user.');
        }

        const head = headSnapshot.exists
            ? ((headSnapshot.data() as ConversationHeadDoc) ?? {})
            : {};
        const headConversationId =
            typeof head.currentConversationId === 'string' ? head.currentConversationId : null;

        if (headConversationId && headConversationId !== input.currentConversationId) {
            const activeSnapshot = await transaction.get(
                db.doc(conversationPath(headConversationId))
            );
            if (activeSnapshot.exists) {
                const active = (activeSnapshot.data() as ConversationDoc | undefined) ?? {};
                if (active.ownerUid === input.ownerUid && active.lifecycle !== 'archived') {
                    return createConversationHandle(headConversationId, active);
                }
            }
        }

        const nextConversationDoc = createConversationDoc({
            ownerUid: input.ownerUid,
            ownerType: input.ownerType,
            locale: input.locale,
            carryoverSummary: input.carryoverSummary,
            continuedFromConversationId: input.currentConversationId,
            contextTokenCount: input.initialContextTokenCount
        });

        transaction.set(
            currentRef,
            {
                lifecycle: 'archived',
                archivedAt: nowIso(),
                archivedReason: input.archivedReason,
                continuedToConversationId: nextConversationId,
                updatedAt: nowIso()
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

        return createConversationHandle(nextConversationId, nextConversationDoc);
    });
};

export const persistConversationMessage = async (
    db: Firestore,
    conversationId: string,
    seq: number,
    turnId: string,
    role: 'user' | 'assistant',
    content: string,
    final: boolean,
    contextTokenDelta: number,
    meta?: {
        model?: string;
        usage?: Record<string, unknown>;
        parts?: unknown[];
    }
) => {
    await db.runTransaction(async (transaction) => {
        const conversationRef = db.doc(conversationPath(conversationId));
        const messageRef = db.doc(
            `conversations/${conversationId}/messages/${role}-${turnId}-${String(seq).padStart(6, '0')}`
        );
        const conversationSnapshot = await transaction.get(conversationRef);
        if (!conversationSnapshot.exists) {
            throw new Error('Conversation is missing.');
        }

        const raw = (conversationSnapshot.data() as ConversationDoc | undefined) ?? {};
        const nextContextTokenCount =
            (typeof raw.contextTokenCount === 'number' ? raw.contextTokenCount : 0) +
            Math.max(0, contextTokenDelta);

        transaction.set(messageRef, {
            seq,
            turnId,
            role,
            content,
            final,
            model: meta?.model ?? null,
            usage: meta?.usage ?? null,
            parts: Array.isArray(meta?.parts) ? meta?.parts : null,
            createdAt: nowIso()
        });
        transaction.set(
            conversationRef,
            {
                contextTokenCount: nextContextTokenCount,
                updatedAt: nowIso()
            },
            { merge: true }
        );
    });
};

export const persistConversationEvent = async (
    db: Firestore,
    conversationId: string,
    seq: number,
    turnId: string,
    type: string,
    data: Record<string, unknown>
) => {
    await db
        .doc(`conversations/${conversationId}/events/${String(seq).padStart(6, '0')}-${turnId}`)
        .set({
            seq,
            turnId,
            type,
            data,
            createdAt: nowIso()
        });
};

export const updateConversationStatus = async (
    db: Firestore,
    conversationId: string,
    status: 'pending' | 'streaming' | 'done' | 'error',
    lastTurnSeq: number
) => {
    await db.doc(conversationPath(conversationId)).set(
        {
            status,
            updatedAt: nowIso(),
            lastTurnSeq,
            lastEventAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );
};

export const listConversationMessages = async (
    db: Firestore,
    conversationId: string
): Promise<StoredConversationMessage[]> => {
    const snapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy('seq', 'asc')
        .get();

    return snapshot.docs.map((doc) => {
        const raw = doc.data() as Partial<StoredConversationMessage>;
        return {
            id: doc.id,
            seq: typeof raw.seq === 'number' ? raw.seq : 0,
            turnId: typeof raw.turnId === 'string' ? raw.turnId : '',
            role: raw.role === 'assistant' ? 'assistant' : 'user',
            content: typeof raw.content === 'string' ? raw.content : '',
            final: raw.final !== false,
            model: typeof raw.model === 'string' ? raw.model : null,
            usage: raw.usage && typeof raw.usage === 'object' ? raw.usage : null,
            parts: Array.isArray(raw.parts) ? raw.parts : null,
            createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : ''
        };
    });
};
