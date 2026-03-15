import { FieldValue, type Firestore } from 'fires2rest';

type ConversationDoc = {
    ownerUid?: string;
    ownerType?: 'anonymous' | 'google';
    locale?: string;
    status?: 'pending' | 'streaming' | 'done' | 'error';
    lastTurnSeq?: number;
};

export type ConversationHandle = {
    conversationId: string;
    seq: number;
};

export type EnsureConversationInput = {
    requestedConversationId: string | null;
    ownerUid: string;
    ownerType: 'anonymous' | 'google';
    locale: string;
};

const nowIso = () => new Date().toISOString();

export const ensureConversation = async (
    db: Firestore,
    input: EnsureConversationInput
): Promise<ConversationHandle> => {
    const conversationId =
        input.requestedConversationId ?? db.collection('conversations').doc().id;
    const ref = db.doc(`conversations/${conversationId}`);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
        await ref.set({
            ownerUid: input.ownerUid,
            ownerType: input.ownerType,
            locale: input.locale,
            status: 'pending',
            createdAt: nowIso(),
            updatedAt: nowIso(),
            lastTurnSeq: 0
        });

        return {
            conversationId,
            seq: 0
        };
    }

    const existing = snapshot.data() as ConversationDoc;
    if (existing.ownerUid !== input.ownerUid) {
        throw new Error('Conversation does not belong to this user.');
    }

    return {
        conversationId,
        seq: typeof existing.lastTurnSeq === 'number' ? existing.lastTurnSeq : 0
    };
};

export const persistConversationMessage = async (
    db: Firestore,
    conversationId: string,
    seq: number,
    turnId: string,
    role: 'user' | 'assistant',
    content: string,
    final: boolean,
    meta?: {
        model?: string;
        usage?: Record<string, unknown>;
    }
) => {
    await db
        .doc(`conversations/${conversationId}/messages/${role}-${turnId}-${String(seq).padStart(6, '0')}`)
        .set({
            seq,
            turnId,
            role,
            content,
            final,
            model: meta?.model ?? null,
            usage: meta?.usage ?? null,
            createdAt: nowIso()
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
    await db.doc(`conversations/${conversationId}`).set(
        {
            status,
            updatedAt: nowIso(),
            lastTurnSeq,
            lastEventAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );
};

export const listConversations = async (db: Firestore, limit = 100) => {
    const snapshot = await db
        .collection('conversations')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
