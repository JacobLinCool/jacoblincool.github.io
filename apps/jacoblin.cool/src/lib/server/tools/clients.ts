import type { RuntimeConfig } from '$lib/server/runtime-env';
import { Octokit } from 'octokit';

type FetchLike = typeof fetch;

const withAbortSignal = async <T>(
    timeoutMs: number,
    run: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await run(controller.signal);
    } finally {
        clearTimeout(timer);
    }
};

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
    fork?: boolean;
    archived?: boolean;
    name?: string;
    full_name?: string;
    html_url?: string;
    description?: string | null;
    language?: string | null;
    stargazers_count?: number;
    forks_count?: number;
    open_issues_count?: number;
    updated_at?: string | null;
};

type GitHubUser = {
    login?: string;
    followers?: number;
    public_repos?: number;
};

type GitHubSearchResponse = {
    items?: GitHubRepo[];
};

type GitHubCatalogRepository = {
    fullName: string;
    name: string;
    url: string;
    description: string;
    language: string;
    stars: number;
    forks: number;
    archived: boolean;
    updatedAt: string | null;
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

const huggingFaceHeaders = {
    accept: 'application/json',
    'user-agent': 'jacoblin.cool-agent-tools'
};

const createGithubClient = (fetchFn: FetchLike, config: RuntimeConfig) =>
    new Octokit({
        auth: config.githubToken ?? undefined,
        userAgent: 'jacoblin.cool-agent-tools',
        request: {
            fetch: fetchFn
        }
    });

const compareByStarsThenName = (
    left: GitHubCatalogRepository,
    right: GitHubCatalogRepository
) =>
    right.stars - left.stars || left.fullName.localeCompare(right.fullName);

const toGithubCatalogRepository = (repo: GitHubRepo): GitHubCatalogRepository => ({
    fullName: repo.full_name ?? '',
    name: repo.name ?? '',
    url: repo.html_url ?? '',
    description: repo.description ?? '',
    language: repo.language ?? 'Unknown',
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    archived: repo.archived ?? false,
    updatedAt: repo.updated_at ?? null
});

export const fetchGithubUserSummary = async (
    fetchFn: FetchLike,
    config: RuntimeConfig,
    timeoutMs: number
) => {
    const client = createGithubClient(fetchFn, config);
    const [userResponse, reposResponse] = await Promise.all([
        withAbortSignal(timeoutMs, (signal) =>
            client.request('GET /users/{username}', {
                username: config.githubUser,
                request: { signal }
            })
        ),
        withAbortSignal(timeoutMs, (signal) =>
            client.request('GET /search/repositories', {
                q: `user:${config.githubUser} fork:false`,
                sort: 'stars',
                order: 'desc',
                per_page: 100,
                request: { signal }
            })
        )
    ]);

    const user = userResponse.data as GitHubUser;
    const repos = reposResponse.data as GitHubSearchResponse;
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

export const fetchGithubRepoCatalog = async (
    fetchFn: FetchLike,
    config: RuntimeConfig,
    timeoutMs: number
) => {
    const client = createGithubClient(fetchFn, config);
    const repos = (await withAbortSignal(timeoutMs, (signal) =>
        client.paginate(client.rest.repos.listForUser, {
            username: config.githubUser,
            type: 'owner',
            sort: 'updated',
            direction: 'desc',
            per_page: 100,
            request: { signal }
        })
    )) as GitHubRepo[];

    const repositories = repos
        .filter((repo) => !repo.fork)
        .map(toGithubCatalogRepository)
        .sort(compareByStarsThenName);

    const languages = [...repositories.reduce<Map<string, { repositories: number; stars: number }>>(
        (summary, repo) => {
            const current = summary.get(repo.language) ?? { repositories: 0, stars: 0 };
            summary.set(repo.language, {
                repositories: current.repositories + 1,
                stars: current.stars + repo.stars
            });
            return summary;
        },
        new Map()
    ).entries()]
        .map(([language, stats]) => ({
            language,
            repositories: stats.repositories,
            stars: stats.stars
        }))
        .sort(
            (left, right) =>
                right.repositories - left.repositories ||
                right.stars - left.stars ||
                left.language.localeCompare(right.language)
        );

    return {
        login: config.githubUser,
        totalRepositories: repositories.length,
        languages,
        repositories
    };
};

export const fetchGithubRepoDetail = async (
    fetchFn: FetchLike,
    config: RuntimeConfig,
    repoFullName: string,
    timeoutMs: number
) => {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid GitHub repository full name: ${repoFullName}`);
    }

    const client = createGithubClient(fetchFn, config);
    const response = await withAbortSignal(timeoutMs, (signal) =>
        client.request('GET /repos/{owner}/{repo}', {
            owner,
            repo,
            request: { signal }
        })
    );
    const repository = response.data as GitHubRepo;

    return {
        fullName: repository.full_name ?? repoFullName,
        name: repository.name ?? repo,
        url: repository.html_url ?? `https://github.com/${repoFullName}`,
        description: repository.description ?? '',
        language: repository.language ?? 'Unknown',
        stars: repository.stargazers_count ?? 0,
        forks: repository.forks_count ?? 0,
        openIssues: repository.open_issues_count ?? 0,
        archived: repository.archived ?? false,
        updatedAt: repository.updated_at ?? null
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
