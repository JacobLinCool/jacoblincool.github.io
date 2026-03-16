import { FieldValue, type Firestore } from 'fires2rest';

export type DynamicSource = 'github' | 'huggingface';

export type DynamicSnapshotRecord = {
    source: DynamicSource;
    entityKey: string;
    payload: Record<string, unknown>;
    revision: string;
    refreshedAt: string;
    staleAt: string;
    etag: string | null;
    lastError: string | null;
};

type CacheEntry = {
    expiresAt: number;
    value: DynamicSnapshotRecord;
};

const L1_TTL_MS = 60 * 1000;
const l1Cache = new Map<string, CacheEntry>();

const makeDocId = (source: DynamicSource, entityKey: string) =>
    `${source}_${entityKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');

const makeCacheKey = (source: DynamicSource, entityKey: string) => `${source}::${entityKey}`;

const nowIso = () => new Date().toISOString();

const toRecord = (
    raw: Partial<DynamicSnapshotRecord>,
    source: DynamicSource,
    entityKey: string
): DynamicSnapshotRecord | null => {
    if (!raw.payload || typeof raw.payload !== 'object') {
        return null;
    }

    if (typeof raw.revision !== 'string' || typeof raw.refreshedAt !== 'string') {
        return null;
    }

    return {
        source,
        entityKey,
        payload: raw.payload,
        revision: raw.revision,
        refreshedAt: raw.refreshedAt,
        staleAt: typeof raw.staleAt === 'string' ? raw.staleAt : raw.refreshedAt,
        etag: typeof raw.etag === 'string' ? raw.etag : null,
        lastError: typeof raw.lastError === 'string' ? raw.lastError : null
    };
};

export const getDynamicSnapshot = async (
    db: Firestore,
    source: DynamicSource,
    entityKey: string
): Promise<DynamicSnapshotRecord | null> => {
    const cacheKey = makeCacheKey(source, entityKey);
    const cached = l1Cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const docId = makeDocId(source, entityKey);
    const snapshot = await db.doc(`dynamic_snapshots/${docId}`).get();
    if (!snapshot.exists) {
        return null;
    }

    const record = toRecord(snapshot.data() as Partial<DynamicSnapshotRecord>, source, entityKey);
    if (!record) {
        return null;
    }

    l1Cache.set(cacheKey, {
        expiresAt: Date.now() + L1_TTL_MS,
        value: record
    });

    return record;
};

export const isSnapshotFresh = (snapshot: DynamicSnapshotRecord, now = Date.now()) => {
    const staleAt = Date.parse(snapshot.staleAt);
    return !Number.isNaN(staleAt) && staleAt > now;
};

export type UpsertDynamicSnapshotInput = {
    source: DynamicSource;
    entityKey: string;
    payload: Record<string, unknown>;
    ttlMs: number;
    etag?: string | null;
    lastError?: string | null;
};

export const upsertDynamicSnapshot = async (
    db: Firestore,
    input: UpsertDynamicSnapshotInput
): Promise<DynamicSnapshotRecord> => {
    const refreshedAt = nowIso();
    const staleAt = new Date(Date.now() + Math.max(1, input.ttlMs)).toISOString();
    const revision = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const docId = makeDocId(input.source, input.entityKey);

    const nextValue: DynamicSnapshotRecord = {
        source: input.source,
        entityKey: input.entityKey,
        payload: input.payload,
        revision,
        refreshedAt,
        staleAt,
        etag: input.etag ?? null,
        lastError: input.lastError ?? null
    };

    await db.doc(`dynamic_snapshots/${docId}`).set(
        {
            ...nextValue,
            updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );

    l1Cache.set(makeCacheKey(input.source, input.entityKey), {
        expiresAt: Date.now() + L1_TTL_MS,
        value: nextValue
    });

    return nextValue;
};

export const markDynamicSnapshotError = async (
    db: Firestore,
    source: DynamicSource,
    entityKey: string,
    error: string
) => {
    const docId = makeDocId(source, entityKey);
    await db.doc(`dynamic_snapshots/${docId}`).set(
        {
            source,
            entityKey,
            lastError: error,
            updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );
};

export const listDynamicSnapshots = async (db: Firestore, limit = 200) => {
    const snapshot = await db
        .collection('dynamic_snapshots')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
