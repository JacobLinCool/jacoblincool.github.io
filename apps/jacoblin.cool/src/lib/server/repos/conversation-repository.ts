import { FieldValue, type Firestore } from 'fires2rest';

type ConversationDoc = {
    ownerUid?: string;
    ownerType?: 'anonymous' | 'google';
    locale?: string;
    status?: 'pending' | 'streaming' | 'done' | 'error';
    lastTurnSeq?: number;
    memorySummary?: string | null;
    summarySeq?: number | null;
};

export type ConversationHandle = {
    conversationId: string;
    seq: number;
    memorySummary: string | null;
    summarySeq: number;
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
    const conversationId = input.requestedConversationId ?? db.collection('conversations').doc().id;
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
            lastTurnSeq: 0,
            memorySummary: null,
            summarySeq: 0
        });

        return {
            conversationId,
            seq: 0,
            memorySummary: null,
            summarySeq: 0
        };
    }

    const existing = snapshot.data() as ConversationDoc;
    if (existing.ownerUid !== input.ownerUid) {
        throw new Error('Conversation does not belong to this user.');
    }

    return {
        conversationId,
        seq: typeof existing.lastTurnSeq === 'number' ? existing.lastTurnSeq : 0,
        memorySummary: typeof existing.memorySummary === 'string' ? existing.memorySummary : null,
        summarySeq: typeof existing.summarySeq === 'number' ? existing.summarySeq : 0
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
        parts?: unknown[];
    }
) => {
    await db
        .doc(
            `conversations/${conversationId}/messages/${role}-${turnId}-${String(seq).padStart(6, '0')}`
        )
        .set({
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

export const updateConversationMemorySummary = async (
    db: Firestore,
    conversationId: string,
    memorySummary: string | null,
    summarySeq: number
) => {
    await db.doc(`conversations/${conversationId}`).set(
        {
            memorySummary,
            summarySeq,
            updatedAt: nowIso()
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
