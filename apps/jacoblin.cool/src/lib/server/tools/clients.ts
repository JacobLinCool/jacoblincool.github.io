import type { RuntimeConfig } from '$lib/server/runtime-env';

type FetchLike = typeof fetch;

const withTimeout = async <T>(
    fetchFn: FetchLike,
    url: string,
    init: RequestInit,
    timeoutMs: number
): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchFn(url, {
            ...init,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Upstream request failed (${response.status}) for ${url}`);
        }

        return (await response.json()) as T;
    } finally {
        clearTimeout(timer);
    }
};

type GitHubRepo = {
    name?: string;
    full_name?: string;
    html_url?: string;
    description?: string;
    language?: string;
    stargazers_count?: number;
    forks_count?: number;
    open_issues_count?: number;
    updated_at?: string;
};

type GitHubUser = {
    login?: string;
    followers?: number;
    public_repos?: number;
};

type GitHubSearchResponse = {
    items?: GitHubRepo[];
};

type HuggingFaceModel = {
    id?: string;
    downloads?: number;
    likes?: number;
    pipeline_tag?: string;
    lastModified?: string;
};

type HuggingFaceSpace = {
    id?: string;
    likes?: number;
    sdk?: string;
    lastModified?: string;
};

const githubHeaders = {
    accept: 'application/vnd.github+json',
    'user-agent': 'jacoblin.cool-agent-tools'
};

const huggingFaceHeaders = {
    accept: 'application/json',
    'user-agent': 'jacoblin.cool-agent-tools'
};

export const fetchGithubUserSummary = async (
    fetchFn: FetchLike,
    config: RuntimeConfig,
    timeoutMs: number
) => {
    const [user, repos] = await Promise.all([
        withTimeout<GitHubUser>(
            fetchFn,
            `https://api.github.com/users/${config.githubUser}`,
            {
                headers: githubHeaders
            },
            timeoutMs
        ),
        withTimeout<GitHubSearchResponse>(
            fetchFn,
            `https://api.github.com/search/repositories?q=user:${config.githubUser}+fork:false&sort=stars&order=desc&per_page=100`,
            {
                headers: githubHeaders
            },
            timeoutMs
        )
    ]);

    const items = repos.items ?? [];
    const totalStars = items.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0);
    const topRepo = items[0] ?? null;

    return {
        login: user.login ?? config.githubUser,
        followers: user.followers ?? 0,
        publicRepos: user.public_repos ?? 0,
        totalStars,
        topRepo: topRepo
            ? {
                  name: topRepo.name ?? '',
                  stars: topRepo.stargazers_count ?? 0,
                  url: topRepo.html_url ?? ''
              }
            : null
    };
};

export const fetchGithubRepoDetail = async (
    fetchFn: FetchLike,
    repoFullName: string,
    timeoutMs: number
) => {
    const repo = await withTimeout<GitHubRepo>(
        fetchFn,
        `https://api.github.com/repos/${repoFullName}`,
        {
            headers: githubHeaders
        },
        timeoutMs
    );

    return {
        fullName: repo.full_name ?? repoFullName,
        name: repo.name ?? repoFullName.split('/').at(-1) ?? repoFullName,
        url: repo.html_url ?? `https://github.com/${repoFullName}`,
        description: repo.description ?? '',
        language: repo.language ?? 'Unknown',
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        updatedAt: repo.updated_at ?? null
    };
};

export const fetchHuggingFaceUserSummary = async (
    fetchFn: FetchLike,
    config: RuntimeConfig,
    timeoutMs: number
) => {
    const [models, spaces] = await Promise.all([
        withTimeout<HuggingFaceModel[]>(
            fetchFn,
            `https://huggingface.co/api/models?author=${config.huggingfaceUser}&limit=300&full=true`,
            {
                headers: huggingFaceHeaders
            },
            timeoutMs
        ),
        withTimeout<HuggingFaceSpace[]>(
            fetchFn,
            `https://huggingface.co/api/spaces?author=${config.huggingfaceUser}&limit=300&full=true`,
            {
                headers: huggingFaceHeaders
            },
            timeoutMs
        )
    ]);

    const safeModels = Array.isArray(models) ? models : [];
    const safeSpaces = Array.isArray(spaces) ? spaces : [];

    const totalModelDownloads = safeModels.reduce((sum, model) => sum + (model.downloads ?? 0), 0);
    const topModel = safeModels.reduce<HuggingFaceModel | null>((current, next) => {
        if (!current) {
            return next;
        }

        return (next.downloads ?? 0) > (current.downloads ?? 0) ? next : current;
    }, null);

    const topSpace = safeSpaces.reduce<HuggingFaceSpace | null>((current, next) => {
        if (!current) {
            return next;
        }

        return (next.likes ?? 0) > (current.likes ?? 0) ? next : current;
    }, null);

    return {
        author: config.huggingfaceUser,
        models: safeModels.length,
        spaces: safeSpaces.length,
        totalModelDownloads,
        topModel: topModel
            ? {
                  id: topModel.id ?? '',
                  downloads: topModel.downloads ?? 0,
                  likes: topModel.likes ?? 0,
                  pipelineTag: topModel.pipeline_tag ?? null,
                  lastModified: topModel.lastModified ?? null
              }
            : null,
        topSpace: topSpace
            ? {
                  id: topSpace.id ?? '',
                  likes: topSpace.likes ?? 0,
                  sdk: topSpace.sdk ?? null,
                  lastModified: topSpace.lastModified ?? null
              }
            : null
    };
};

export const fetchHuggingFaceModelDetail = async (
    fetchFn: FetchLike,
    modelId: string,
    timeoutMs: number
) => {
    const model = await withTimeout<HuggingFaceModel>(
        fetchFn,
        `https://huggingface.co/api/models/${encodeURIComponent(modelId)}`,
        {
            headers: huggingFaceHeaders
        },
        timeoutMs
    );

    return {
        id: model.id ?? modelId,
        downloads: model.downloads ?? 0,
        likes: model.likes ?? 0,
        pipelineTag: model.pipeline_tag ?? null,
        lastModified: model.lastModified ?? null
    };
};

export const fetchHuggingFaceSpaceDetail = async (
    fetchFn: FetchLike,
    spaceId: string,
    timeoutMs: number
) => {
    const space = await withTimeout<HuggingFaceSpace>(
        fetchFn,
        `https://huggingface.co/api/spaces/${encodeURIComponent(spaceId)}`,
        {
            headers: huggingFaceHeaders
        },
        timeoutMs
    );

    return {
        id: space.id ?? spaceId,
        likes: space.likes ?? 0,
        sdk: space.sdk ?? null,
        lastModified: space.lastModified ?? null
    };
};
