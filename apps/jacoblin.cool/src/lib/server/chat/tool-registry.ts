import { createSiteToolRegistry } from '$lib/server/content/context-builder';
import { getEntityKeyFromGithubUrl, resolveDynamicTarget } from '$lib/server/content/dynamic-sync';
import {
    getStaticKnowledgeRegistry,
    type KnowledgeItem
} from '$lib/server/content/knowledge-registry';
import type { GeminiFunctionDeclaration, GeminiFunctionResponse } from '$lib/server/llm/gemini';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import type { Firestore } from 'fires2rest';

export type ChatToolSource = 'site' | 'github' | 'huggingface';

export type ChatToolExecutionResult = {
    tool: ChatToolSource;
    target: string;
    label: string;
    refs: string[];
    payload: Record<string, unknown>;
    revision?: string;
};

type ChatToolDefinition = {
    source: ChatToolSource;
    name: string;
    declaration: GeminiFunctionDeclaration;
    execute: (args: Record<string, unknown>) => Promise<ChatToolExecutionResult>;
};

type ToolRegistryInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
};

export type ChatToolRegistry = {
    contentVersion: string;
    siteRefs: string[];
    siteIndexText: string;
    toolDeclarations: GeminiFunctionDeclaration[];
    executeTool: (
        name: string,
        args: Record<string, unknown>
    ) => Promise<ChatToolExecutionResult | null>;
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asBoolean = (value: unknown) => value === true;
const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const normalizeLimit = (value: unknown, fallback = 8, max = 25) => {
    const parsed = asNumber(value);
    if (!parsed) {
        return fallback;
    }

    return Math.max(1, Math.min(max, Math.floor(parsed)));
};

const buildFailurePayload = (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'Tool execution failed.'
});

type GithubCatalogRepository = {
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

type GithubLanguageSummary = {
    language: string;
    repositories: number;
    stars: number;
};

const toGithubCatalogRepository = (value: unknown): GithubCatalogRepository | null => {
    const record = asRecord(value);
    const fullName = asString(record.fullName);
    const name = asString(record.name);
    const url = asString(record.url);
    const language = asString(record.language) || 'Unknown';
    if (!fullName || !name || !url) {
        return null;
    }

    return {
        fullName,
        name,
        url,
        description: asString(record.description),
        language,
        stars: asNumber(record.stars) ?? 0,
        forks: asNumber(record.forks) ?? 0,
        archived: asBoolean(record.archived),
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null
    };
};

const toGithubLanguageSummary = (value: unknown): GithubLanguageSummary | null => {
    const record = asRecord(value);
    const language = asString(record.language);
    if (!language) {
        return null;
    }

    return {
        language,
        repositories: asNumber(record.repositories) ?? 0,
        stars: asNumber(record.stars) ?? 0
    };
};

const readGithubRepoCatalog = (payload: Record<string, unknown>) => ({
    login: asString(payload.login),
    totalRepositories: asNumber(payload.totalRepositories) ?? 0,
    repositories: Array.isArray(payload.repositories)
        ? payload.repositories.map(toGithubCatalogRepository).filter((repo): repo is GithubCatalogRepository => Boolean(repo))
        : [],
    languages: Array.isArray(payload.languages)
        ? payload.languages.map(toGithubLanguageSummary).filter((language): language is GithubLanguageSummary => Boolean(language))
        : []
});

const getProjectRepositoryFullName = (item: KnowledgeItem) => {
    const explicitRepository = item.attributes.repositoryFullName;
    if (typeof explicitRepository === 'string' && explicitRepository.trim()) {
        return explicitRepository.trim();
    }

    const repositoryUrl = item.links.find((link) => link.kind === 'repository')?.url;
    return repositoryUrl ? getEntityKeyFromGithubUrl(repositoryUrl) : null;
};

export const createChatToolRegistry = ({
    db,
    fetchFn,
    config,
    externalToolConfig
}: ToolRegistryInput): ChatToolRegistry => {
    const siteRegistry = createSiteToolRegistry();
    const knowledgeRegistry = getStaticKnowledgeRegistry();
    const projectRepoById = new Map(
        Object.values(knowledgeRegistry.itemsById)
            .filter((item) => item.type === 'project')
            .map((project) => [project.id, getProjectRepositoryFullName(project)] as const)
            .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );

    const tools: ChatToolDefinition[] = [
        ...siteRegistry.toolDeclarations.map((declaration) => ({
            source: 'site' as const,
            name: declaration.name,
            declaration,
            execute: async (args: Record<string, unknown>) => {
                const result = siteRegistry.executeTool(declaration.name, args);
                if (!result) {
                    throw new Error(`Unknown site tool: ${declaration.name}`);
                }

                return {
                    tool: 'site' as const,
                    ...result
                };
            }
        })),
        {
            source: 'github',
            name: 'get_github_profile',
            declaration: {
                name: 'get_github_profile',
                description:
                    'Read the latest cached GitHub profile summary for JacobLinCool, including followers, repo counts, and top repository.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: async () => {
                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'github_user_summary',
                        source: 'github',
                        entityKey: `user:${config.githubUser.toLowerCase()}`
                    }
                });

                return {
                    tool: 'github',
                    target: snapshot.entityKey,
                    label: 'Reading GitHub profile',
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        githubProfile: snapshot.payload,
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        },
        {
            source: 'github',
            name: 'get_github_repositories',
            declaration: {
                name: 'get_github_repositories',
                description:
                    'Read the latest cached GitHub repository catalog for JacobLinCool. Use this to discover repositories by language or keyword, for example to check whether any Rust repositories exist.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        language: {
                            type: 'STRING',
                            description:
                                'Optional primary language filter, for example Rust, TypeScript, or Python.'
                        },
                        query: {
                            type: 'STRING',
                            description:
                                'Optional case-insensitive keyword filter matched against repository name, full name, or description.'
                        },
                        limit: {
                            type: 'NUMBER',
                            description: 'Optional maximum repositories to return. Default 8, max 25.'
                        },
                        includeArchived: {
                            type: 'BOOLEAN',
                            description:
                                'Set true to include archived repositories. Default false.'
                        }
                    }
                }
            },
            execute: async (args) => {
                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'github_repo_catalog',
                        source: 'github',
                        entityKey: `user:${config.githubUser.toLowerCase()}:repositories`
                    }
                });

                const catalog = readGithubRepoCatalog(snapshot.payload);
                const language = asString(args.language);
                const languageFilter = language.toLowerCase();
                const query = asString(args.query);
                const queryFilter = query.toLowerCase();
                const includeArchived = asBoolean(args.includeArchived);
                const limit = normalizeLimit(args.limit);

                const repositories = catalog.repositories.filter((repo) => {
                    if (!includeArchived && repo.archived) {
                        return false;
                    }

                    if (languageFilter && repo.language.toLowerCase() !== languageFilter) {
                        return false;
                    }

                    if (!queryFilter) {
                        return true;
                    }

                    return [repo.fullName, repo.name, repo.description].some((field) =>
                        field.toLowerCase().includes(queryFilter)
                    );
                });

                return {
                    tool: 'github',
                    target:
                        language || query || `user:${config.githubUser.toLowerCase()}:repositories`,
                    label: 'Reading GitHub repositories',
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        login: catalog.login || config.githubUser,
                        totalRepositories: catalog.totalRepositories,
                        totalMatches: repositories.length,
                        filters: {
                            language: language || null,
                            query: query || null,
                            includeArchived,
                            limit
                        },
                        languages: catalog.languages,
                        repositories: repositories.slice(0, limit),
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        },
        {
            source: 'github',
            name: 'get_github_repo_detail',
            declaration: {
                name: 'get_github_repo_detail',
                description:
                    'Read the latest cached GitHub repository detail. Use either a published project id or a GitHub repo full name.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        projectId: {
                            type: 'STRING',
                            description: 'Project id from get_side_projects.'
                        },
                        repoFullName: {
                            type: 'STRING',
                            description:
                                'GitHub repository full name, for example JacobLinCool/d1-manager.'
                        }
                    }
                }
            },
            execute: async (args) => {
                const projectId = asString(args.projectId);
                const repoFullName = asString(args.repoFullName);
                const entityKey = projectId ? (projectRepoById.get(projectId) ?? '') : repoFullName;

                if (!entityKey) {
                    return {
                        tool: 'github',
                        target: projectId || repoFullName || 'github repo detail',
                        label: 'Reading GitHub repository details',
                        refs: projectId ? [`project:${projectId}`] : [],
                        payload: {
                            ok: false,
                            error: 'Provide a valid projectId or repoFullName.'
                        }
                    };
                }

                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'github_repo_detail',
                        source: 'github',
                        entityKey
                    }
                });

                return {
                    tool: 'github',
                    target: entityKey,
                    label: `Reading GitHub repository: ${entityKey}`,
                    refs: projectId ? [`project:${projectId}`] : [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        repository: snapshot.payload,
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        },
        {
            source: 'huggingface',
            name: 'get_huggingface_profile',
            declaration: {
                name: 'get_huggingface_profile',
                description:
                    'Read the latest cached Hugging Face profile summary for JacobLinCool, including models, spaces, and downloads.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: async () => {
                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'huggingface_user_summary',
                        source: 'huggingface',
                        entityKey: `user:${config.huggingfaceUser.toLowerCase()}`
                    }
                });

                return {
                    tool: 'huggingface',
                    target: snapshot.entityKey,
                    label: 'Reading Hugging Face profile',
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        huggingFaceProfile: snapshot.payload,
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        },
        {
            source: 'huggingface',
            name: 'get_huggingface_model_detail',
            declaration: {
                name: 'get_huggingface_model_detail',
                description: 'Read the latest cached Hugging Face model detail by model id.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: {
                            type: 'STRING',
                            description:
                                'Hugging Face model id, for example JacobLinCool/some-model.'
                        }
                    },
                    required: ['id']
                }
            },
            execute: async (args) => {
                const id = asString(args.id);
                if (!id) {
                    return {
                        tool: 'huggingface',
                        target: 'huggingface model detail',
                        label: 'Reading Hugging Face model details',
                        refs: [],
                        payload: {
                            ok: false,
                            error: 'Provide a valid Hugging Face model id.'
                        }
                    };
                }

                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'huggingface_model_detail',
                        source: 'huggingface',
                        entityKey: id
                    }
                });

                return {
                    tool: 'huggingface',
                    target: id,
                    label: `Reading Hugging Face model: ${id}`,
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        model: snapshot.payload,
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        },
        {
            source: 'huggingface',
            name: 'get_huggingface_space_detail',
            declaration: {
                name: 'get_huggingface_space_detail',
                description: 'Read the latest cached Hugging Face Space detail by space id.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: {
                            type: 'STRING',
                            description:
                                'Hugging Face space id, for example JacobLinCool/some-space.'
                        }
                    },
                    required: ['id']
                }
            },
            execute: async (args) => {
                const id = asString(args.id);
                if (!id) {
                    return {
                        tool: 'huggingface',
                        target: 'huggingface space detail',
                        label: 'Reading Hugging Face Space details',
                        refs: [],
                        payload: {
                            ok: false,
                            error: 'Provide a valid Hugging Face space id.'
                        }
                    };
                }

                const snapshot = await resolveDynamicTarget({
                    db,
                    fetchFn,
                    config,
                    externalToolConfig,
                    target: {
                        kind: 'huggingface_space_detail',
                        source: 'huggingface',
                        entityKey: id
                    }
                });

                return {
                    tool: 'huggingface',
                    target: id,
                    label: `Reading Hugging Face Space: ${id}`,
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        space: snapshot.payload,
                        revision: snapshot.revision,
                        refreshedAt: snapshot.refreshedAt
                    }
                };
            }
        }
    ];

    return {
        contentVersion: siteRegistry.contentVersion,
        siteRefs: siteRegistry.refs,
        siteIndexText: siteRegistry.siteIndexText,
        toolDeclarations: tools.map((tool) => tool.declaration),
        executeTool: async (name, args) => {
            const tool = tools.find((candidate) => candidate.name === name);
            if (!tool) {
                return null;
            }

            try {
                return await tool.execute(asRecord(args));
            } catch (error) {
                return {
                    tool: tool.source,
                    target: name,
                    label: `Reading ${name}`,
                    refs: [],
                    payload: buildFailurePayload(error)
                };
            }
        }
    };
};

export const toGeminiFunctionResponsePart = (
    name: string,
    payload: Record<string, unknown>
): GeminiFunctionResponse => ({
    name,
    response: payload
});
