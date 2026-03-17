import type { ZodType } from 'zod';

export type ToolSource = 'site' | 'github' | 'huggingface';

export type ToolExecutionResult = {
    tool: ToolSource;
    target: string;
    label: string;
    refs: string[];
    payload: Record<string, unknown>;
    revision?: string;
};

export type ToolDefinition = {
    source: ToolSource;
    name: string;
    description: string;
    inputSchema: ZodType<Record<string, unknown>>;
    inputJsonSchema: Record<string, unknown>;
};

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

export type SnapshotStore = {
    get: (source: DynamicSource, entityKey: string) => Promise<DynamicSnapshotRecord | null>;
    set: (input: {
        source: DynamicSource;
        entityKey: string;
        payload: Record<string, unknown>;
        ttlMs: number;
        etag?: string | null;
        lastError?: string | null;
    }) => Promise<DynamicSnapshotRecord>;
    markError: (source: DynamicSource, entityKey: string, error: string) => Promise<void>;
};
