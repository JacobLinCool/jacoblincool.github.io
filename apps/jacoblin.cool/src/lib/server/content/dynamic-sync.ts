import {
    getDynamicSnapshot,
    isSnapshotFresh,
    markDynamicSnapshotError,
    upsertDynamicSnapshot,
    type DynamicSnapshotRecord,
    type DynamicSource
} from '$lib/server/repos/dynamic-snapshot-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import {
    fetchGithubRepoDetail,
    fetchGithubUserSummary,
    fetchHuggingFaceModelDetail,
    fetchHuggingFaceSpaceDetail,
    fetchHuggingFaceUserSummary
} from '$lib/server/tools/clients';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import type { ProfileMetricsSnapshot } from '$lib/types/home';
import type { Firestore } from 'fires2rest';

export type DynamicTargetKind =
    | 'github_user_summary'
    | 'github_repo_detail'
    | 'huggingface_user_summary'
    | 'huggingface_model_detail'
    | 'huggingface_space_detail';

export type DynamicTarget = {
    kind: DynamicTargetKind;
    source: DynamicSource;
    entityKey: string;
};

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

const getTtlForTarget = (target: DynamicTarget, externalToolConfig: ExternalToolConfig) => {
    switch (target.kind) {
        case 'github_user_summary':
            return externalToolConfig.freshnessBySource.githubUserSummaryMs;
        case 'github_repo_detail':
            return externalToolConfig.freshnessBySource.githubRepoDetailMs;
        case 'huggingface_user_summary':
            return externalToolConfig.freshnessBySource.huggingfaceUserSummaryMs;
        case 'huggingface_model_detail':
            return externalToolConfig.freshnessBySource.huggingfaceModelDetailMs;
        case 'huggingface_space_detail':
            return externalToolConfig.freshnessBySource.huggingfaceSpaceDetailMs;
        default:
            return 10 * 60 * 1000;
    }
};

const toolNameFromTarget = (target: DynamicTarget) =>
    target.source === 'github' ? 'github' : 'huggingface';

const fetchTargetPayload = async (
    fetchFn: typeof fetch,
    config: RuntimeConfig,
    target: DynamicTarget,
    timeoutMs: number
): Promise<Record<string, unknown>> => {
    switch (target.kind) {
        case 'github_user_summary':
            return fetchGithubUserSummary(fetchFn, config, timeoutMs);
        case 'github_repo_detail':
            return fetchGithubRepoDetail(fetchFn, target.entityKey, timeoutMs);
        case 'huggingface_user_summary':
            return fetchHuggingFaceUserSummary(fetchFn, config, timeoutMs);
        case 'huggingface_model_detail':
            return fetchHuggingFaceModelDetail(fetchFn, target.entityKey, timeoutMs);
        case 'huggingface_space_detail':
            return fetchHuggingFaceSpaceDetail(fetchFn, target.entityKey, timeoutMs);
        default:
            throw new Error(`Unsupported dynamic target kind: ${target.kind}`);
    }
};

export const resolveDynamicTarget = async (
    options: ResolveTargetOptions
): Promise<DynamicSnapshotRecord> => {
    const ttlMs = getTtlForTarget(options.target, options.externalToolConfig);
    const existing = await getDynamicSnapshot(
        options.db,
        options.target.source,
        options.target.entityKey
    );

    if (!options.forceRefresh && existing && isSnapshotFresh(existing)) {
        return existing;
    }

    const tool = toolNameFromTarget(options.target);
    await options.onToolEvent?.({
        type: 'tool_call_started',
        tool,
        entityKey: options.target.entityKey
    });

    try {
        const payload = await fetchTargetPayload(
            options.fetchFn,
            options.config,
            options.target,
            options.externalToolConfig.timeoutMs
        );

        const updated = await upsertDynamicSnapshot(options.db, {
            source: options.target.source,
            entityKey: options.target.entityKey,
            payload,
            ttlMs,
            lastError: null
        });

        await options.onToolEvent?.({
            type: 'tool_call_succeeded',
            tool,
            entityKey: options.target.entityKey,
            revision: updated.revision
        });

        return updated;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown tool failure';
        await markDynamicSnapshotError(
            options.db,
            options.target.source,
            options.target.entityKey,
            message
        );

        await options.onToolEvent?.({
            type: 'tool_call_failed',
            tool,
            entityKey: options.target.entityKey,
            error: message
        });

        if (existing) {
            return existing;
        }

        throw new Error(
            `Unable to resolve ${options.target.source}:${options.target.entityKey}. ${message}`,
            { cause: error }
        );
    }
};

const asNumber = (value: unknown) => (typeof value === 'number' ? value : 0);
const asString = (value: unknown) => (typeof value === 'string' ? value : '');

export const buildProfileMetrics = (
    githubSnapshot: DynamicSnapshotRecord,
    huggingfaceSnapshot: DynamicSnapshotRecord,
    scholar: ProfileMetricsSnapshot['scholar']
): ProfileMetricsSnapshot => {
    const github = githubSnapshot.payload;
    const huggingface = huggingfaceSnapshot.payload;

    return {
        github: {
            followers: asNumber(github.followers),
            publicRepos: asNumber(github.publicRepos),
            totalStars: asNumber(github.totalStars),
            topRepo: {
                name: asString((github.topRepo as { name?: string } | null)?.name),
                stars: asNumber((github.topRepo as { stars?: number } | null)?.stars),
                url: asString((github.topRepo as { url?: string } | null)?.url)
            },
            refreshedAt: githubSnapshot.refreshedAt
        },
        huggingface: {
            models: asNumber(huggingface.models),
            spaces: asNumber(huggingface.spaces),
            totalModelDownloads: asNumber(huggingface.totalModelDownloads),
            topModel: {
                id: asString((huggingface.topModel as { id?: string } | null)?.id),
                downloads: asNumber(
                    (huggingface.topModel as { downloads?: number } | null)?.downloads
                )
            },
            topSpace: {
                id: asString((huggingface.topSpace as { id?: string } | null)?.id),
                likes: asNumber((huggingface.topSpace as { likes?: number } | null)?.likes)
            },
            refreshedAt: huggingfaceSnapshot.refreshedAt
        },
        scholar
    };
};

export const getHomeDynamicTargets = (config: RuntimeConfig): DynamicTarget[] => [
    {
        kind: 'github_user_summary',
        source: 'github',
        entityKey: `user:${config.githubUser.toLowerCase()}`
    },
    {
        kind: 'huggingface_user_summary',
        source: 'huggingface',
        entityKey: `user:${config.huggingfaceUser.toLowerCase()}`
    }
];

export const getEntityKeyFromGithubUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'github.com') {
            return null;
        }

        const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
        if (!owner || !repo) {
            return null;
        }

        return `${owner}/${repo}`;
    } catch {
        return null;
    }
};

export const getEntityKeyFromHuggingFaceUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'huggingface.co') {
            return null;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) {
            return null;
        }

        if (parts[0] === 'spaces' && parts[1] && parts[2]) {
            return { type: 'space' as const, id: `${parts[1]}/${parts[2]}` };
        }

        if (parts[0] === 'models' && parts[1] && parts[2]) {
            return { type: 'model' as const, id: `${parts[1]}/${parts[2]}` };
        }

        if (parts[0] && parts[1]) {
            return { type: 'model' as const, id: `${parts[0]}/${parts[1]}` };
        }

        return null;
    } catch {
        return null;
    }
};
