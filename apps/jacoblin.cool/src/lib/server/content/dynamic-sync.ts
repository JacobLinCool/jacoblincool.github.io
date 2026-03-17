import {
    createFirestoreSnapshotStore,
    type DynamicSnapshotRecord,
    type DynamicSource
} from '$lib/server/repos/dynamic-snapshot-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import type { ProfileMetricsSnapshot } from '$lib/types/home';
import {
    buildProfileMetrics,
    getEntityKeyFromGithubUrl,
    getEntityKeyFromHuggingFaceUrl,
    getHomeDynamicTargets,
    resolveDynamicTarget as resolveAgentDynamicTarget,
    type DynamicTarget,
    type DynamicTargetKind
} from '@jacoblincool/agent';
import type { Firestore } from 'fires2rest';

type ToolEventHandler = (event: {
    type: 'tool_call_started' | 'tool_call_succeeded' | 'tool_call_failed';
    tool: 'github' | 'huggingface';
    entityKey: string;
    revision?: string;
    error?: string;
}) => Promise<void>;

type ResolveTargetOptions = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
    target: DynamicTarget;
    forceRefresh?: boolean;
    onToolEvent?: ToolEventHandler;
};

export {
    buildProfileMetrics,
    getEntityKeyFromGithubUrl,
    getEntityKeyFromHuggingFaceUrl,
    getHomeDynamicTargets
};
export type {
    DynamicSnapshotRecord,
    DynamicSource,
    DynamicTarget,
    DynamicTargetKind,
    ProfileMetricsSnapshot
};

export const resolveDynamicTarget = (options: ResolveTargetOptions) =>
    resolveAgentDynamicTarget({
        snapshotStore: createFirestoreSnapshotStore(options.db),
        fetchFn: options.fetchFn,
        config: {
            githubToken: options.config.githubToken,
            githubUser: options.config.githubUser,
            huggingfaceUser: options.config.huggingfaceUser
        },
        externalToolConfig: options.externalToolConfig,
        target: options.target,
        forceRefresh: options.forceRefresh,
        onToolEvent: options.onToolEvent
    });
