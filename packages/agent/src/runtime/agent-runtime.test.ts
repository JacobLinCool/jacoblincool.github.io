import { describe, expect, it, vi } from 'vitest';
import { fetchGithubRepoCatalog } from '../providers/clients.js';
import { createJacobAgentRuntime } from './agent-runtime.js';
import { createMemorySnapshotStore } from './snapshot-store.js';

const jsonResponse = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });

const githubReposPayload = [
    {
        fork: false,
        archived: false,
        name: 'rust-agent',
        full_name: 'JacobLinCool/rust-agent',
        html_url: 'https://github.com/JacobLinCool/rust-agent',
        description: 'A Rust agent runtime for experiments.',
        language: 'Rust',
        stargazers_count: 42,
        forks_count: 7,
        open_issues_count: 1,
        updated_at: '2026-03-17T00:00:00Z'
    },
    {
        fork: false,
        archived: true,
        name: 'rust-archive',
        full_name: 'JacobLinCool/rust-archive',
        html_url: 'https://github.com/JacobLinCool/rust-archive',
        description: 'Archived Cargo tooling.',
        language: 'Rust',
        stargazers_count: 5,
        forks_count: 1,
        open_issues_count: 0,
        updated_at: '2025-10-01T00:00:00Z'
    },
    {
        fork: false,
        archived: false,
        name: 'ts-tooling',
        full_name: 'JacobLinCool/ts-tooling',
        html_url: 'https://github.com/JacobLinCool/ts-tooling',
        description: 'TypeScript utilities.',
        language: 'TypeScript',
        stargazers_count: 19,
        forks_count: 3,
        open_issues_count: 2,
        updated_at: '2026-03-16T00:00:00Z'
    },
    {
        fork: true,
        archived: false,
        name: 'forked-rust',
        full_name: 'JacobLinCool/forked-rust',
        html_url: 'https://github.com/JacobLinCool/forked-rust',
        description: 'Forked repo should be excluded.',
        language: 'Rust',
        stargazers_count: 100,
        forks_count: 20,
        open_issues_count: 0,
        updated_at: '2026-03-15T00:00:00Z'
    }
];

const createGithubFetch = () =>
    vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(input instanceof Request ? input.url : String(input));

        if (url.pathname === '/users/JacobLinCool/repos') {
            return jsonResponse(githubReposPayload);
        }

        throw new Error(`Unexpected fetch url: ${url.toString()}`);
    }) as typeof fetch;

describe('agent runtime', () => {
    it('builds a normalized GitHub repository catalog from Octokit responses', async () => {
        const fetchFn = createGithubFetch();

        const catalog = await fetchGithubRepoCatalog(
            fetchFn,
            {
                githubToken: null,
                githubUser: 'JacobLinCool',
                huggingfaceUser: 'JacobLinCool'
            },
            1000
        );

        expect(catalog).toMatchObject({
            login: 'JacobLinCool',
            totalRepositories: 3,
            languages: [
                {
                    language: 'Rust',
                    repositories: 2,
                    stars: 47
                },
                {
                    language: 'TypeScript',
                    repositories: 1,
                    stars: 19
                }
            ]
        });
        expect(catalog.repositories.map((repo) => repo.fullName)).toEqual([
            'JacobLinCool/rust-agent',
            'JacobLinCool/ts-tooling',
            'JacobLinCool/rust-archive'
        ]);
    });

    it('filters GitHub repositories by language and reuses the cached snapshot', async () => {
        const fetchFn = createGithubFetch();
        const runtime = createJacobAgentRuntime({
            fetchFn,
            snapshotStore: createMemorySnapshotStore()
        });

        const rustOnly = await runtime.executeTool('get_github_repositories', {
            language: 'Rust'
        });
        const archivedIncluded = await runtime.executeTool('get_github_repositories', {
            language: 'Rust',
            includeArchived: true,
            query: 'cargo'
        });

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(rustOnly).toMatchObject({
            tool: 'github',
            payload: {
                ok: true,
                totalMatches: 1,
                filters: {
                    language: 'Rust',
                    includeArchived: false
                },
                repositories: [
                    {
                        fullName: 'JacobLinCool/rust-agent',
                        language: 'Rust',
                        archived: false
                    }
                ]
            }
        });
        expect(archivedIncluded).toMatchObject({
            tool: 'github',
            payload: {
                ok: true,
                totalMatches: 1,
                filters: {
                    language: 'Rust',
                    query: 'cargo',
                    includeArchived: true
                },
                repositories: [
                    {
                        fullName: 'JacobLinCool/rust-archive',
                        archived: true
                    }
                ]
            }
        });
    });

    it('validates tool input and returns a tool failure payload', async () => {
        const runtime = createJacobAgentRuntime();

        const result = await runtime.executeTool('get_huggingface_model_detail', {});

        expect(result).toMatchObject({
            tool: 'huggingface',
            payload: {
                ok: false
            }
        });
    });
});
