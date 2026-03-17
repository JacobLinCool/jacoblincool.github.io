import type { DynamicSnapshotRecord, DynamicSource, SnapshotStore } from './types.js';

type CacheEntry = {
    expiresAt: number;
    value: DynamicSnapshotRecord;
};

const L1_TTL_MS = 60 * 1000;

const createRevision = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const isSnapshotFresh = (
    snapshot: DynamicSnapshotRecord,
    now: number = Date.now()
): boolean => {
    const staleAt = Date.parse(snapshot.staleAt);
    return !Number.isNaN(staleAt) && staleAt > now;
};

export const createMemorySnapshotStore = (): SnapshotStore => {
    const cache = new Map<string, CacheEntry>();

    const cacheKey = (source: DynamicSource, entityKey: string) => `${source}::${entityKey}`;

    return {
        async get(source, entityKey) {
            const entry = cache.get(cacheKey(source, entityKey));
            if (!entry || entry.expiresAt <= Date.now()) {
                return null;
            }

            return entry.value;
        },
        async set(input) {
            const refreshedAt = new Date().toISOString();
            const nextValue: DynamicSnapshotRecord = {
                source: input.source,
                entityKey: input.entityKey,
                payload: input.payload,
                revision: createRevision(),
                refreshedAt,
                staleAt: new Date(Date.now() + Math.max(1, input.ttlMs)).toISOString(),
                etag: input.etag ?? null,
                lastError: input.lastError ?? null
            };

            cache.set(cacheKey(input.source, input.entityKey), {
                expiresAt: Date.now() + L1_TTL_MS,
                value: nextValue
            });

            return nextValue;
        },
        async markError(source, entityKey, error) {
            const existing = cache.get(cacheKey(source, entityKey));
            if (!existing) {
                return;
            }

            cache.set(cacheKey(source, entityKey), {
                expiresAt: existing.expiresAt,
                value: {
                    ...existing.value,
                    lastError: error
                }
            });
        }
    };
};

export type { DynamicSnapshotRecord, DynamicSource, SnapshotStore } from './types.js';
