import {
    fetchGithubRepoCatalog,
    fetchGithubRepoDetail,
    fetchGithubUserSummary,
    fetchHuggingFaceModelDetail,
    fetchHuggingFaceSpaceDetail,
    fetchHuggingFaceUserSummary,
    type ProviderRuntimeConfig
} from '../providers/clients.js';
import type { ExternalToolConfig } from './external-tool-config.js';
import { DEFAULT_EXTERNAL_TOOL_CONFIG } from './external-tool-config.js';
import {
    isSnapshotFresh,
    type DynamicSnapshotRecord,
    type DynamicSource,
    type SnapshotStore
} from './snapshot-store.js';

export type DynamicTargetKind =
    | 'github_user_summary'
    | 'github_repo_detail'
    | 'github_repo_catalog'
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
    snapshotStore: SnapshotStore;
    fetchFn: typeof fetch;
    config: ProviderRuntimeConfig;
    externalToolConfig?: ExternalToolConfig;
    target: DynamicTarget;
    forceRefresh?: boolean;
    onToolEvent?: ToolEventHandler;
};

export type ProfileMetricsSnapshot = {
    github: {
        followers: number;
        publicRepos: number;
        totalStars: number;
        topRepo: {
            name: string;
            stars: number;
            url: string;
        };
        refreshedAt: string;
    };
    huggingface: {
        models: number;
        spaces: number;
        totalModelDownloads: number;
        topModel: {
            id: string;
            downloads: number;
        };
        topSpace: {
            id: string;
            likes: number;
        };
        refreshedAt: string;
    };
    scholar: {
        profileUrl: string;
        citations: number;
        hIndex: number;
        i10Index: number;
        topics: string[];
    };
};

const getTtlForTarget = (target: DynamicTarget, externalToolConfig: ExternalToolConfig) => {
    switch (target.kind) {
        case 'github_user_summary':
            return externalToolConfig.freshnessBySource.githubUserSummaryMs;
        case 'github_repo_detail':
            return externalToolConfig.freshnessBySource.githubRepoDetailMs;
        case 'github_repo_catalog':
            return externalToolConfig.freshnessBySource.githubRepoCatalogMs;
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
    config: ProviderRuntimeConfig,
    target: DynamicTarget,
    timeoutMs: number
): Promise<Record<string, unknown>> => {
    switch (target.kind) {
        case 'github_user_summary':
            return fetchGithubUserSummary(fetchFn, config, timeoutMs);
        case 'github_repo_detail':
            return fetchGithubRepoDetail(fetchFn, config, target.entityKey, timeoutMs);
        case 'github_repo_catalog':
            return fetchGithubRepoCatalog(fetchFn, config, timeoutMs);
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
    const externalToolConfig = options.externalToolConfig ?? DEFAULT_EXTERNAL_TOOL_CONFIG;
    const ttlMs = getTtlForTarget(options.target, externalToolConfig);
    const existing = await options.snapshotStore.get(
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
            externalToolConfig.timeoutMs
        );

        const updated = await options.snapshotStore.set({
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
        await options.snapshotStore.markError(
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

export const getHomeDynamicTargets = (config: ProviderRuntimeConfig): DynamicTarget[] => [
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

export const getEntityKeyFromGithubUrl = (url: string): string | null => {
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

export const getEntityKeyFromHuggingFaceUrl = (
    url: string
): { type: 'space' | 'model'; id: string } | null => {
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
