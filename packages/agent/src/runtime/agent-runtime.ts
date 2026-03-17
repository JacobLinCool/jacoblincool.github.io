import { z } from 'zod';
import { createSiteToolRegistry } from '../content/context-builder.js';
import { getStaticKnowledgeRegistry, type KnowledgeItem } from '../content/knowledge-registry.js';
import {
    getEntityKeyFromGithubUrl,
    resolveDynamicTarget,
    type DynamicTarget
} from './dynamic-sync.js';
import { DEFAULT_EXTERNAL_TOOL_CONFIG, type ExternalToolConfig } from './external-tool-config.js';
import { createMemorySnapshotStore } from './snapshot-store.js';
import type { SnapshotStore, ToolDefinition, ToolExecutionResult, ToolSource } from './types.js';

export type { ToolDefinition, ToolExecutionResult, ToolSource } from './types.js';

export type JacobAgentRuntimeOptions = {
    fetchFn?: typeof fetch;
    githubToken?: string | null;
    githubUser?: string;
    huggingfaceUser?: string;
    externalToolConfig?: ExternalToolConfig;
    snapshotStore?: SnapshotStore;
};

export type JacobAgentRuntime = {
    contentVersion: string;
    siteRefs: string[];
    siteIndexText: string;
    listTools: () => ToolDefinition[];
    executeTool: (
        name: string,
        args: Record<string, unknown>
    ) => Promise<ToolExecutionResult | null>;
};

type RuntimeToolDefinition = ToolDefinition & {
    execute: (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
};

const DEFAULT_GITHUB_USER = 'JacobLinCool';
const DEFAULT_HUGGINGFACE_USER = 'JacobLinCool';

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asBoolean = (value: unknown) => value === true;
const asNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

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

const emptyObjectSchema = z.object({}).strict();

const toToolDefinition = (
    source: ToolSource,
    name: string,
    description: string,
    inputSchema: z.ZodObject<any>
): Omit<ToolDefinition, 'inputSchema'> & { inputSchema: z.ZodObject<any> } => ({
    source,
    name,
    description,
    inputSchema,
    inputJsonSchema: z.toJSONSchema(inputSchema)
});

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
        ? payload.repositories
              .map(toGithubCatalogRepository)
              .filter((repo): repo is GithubCatalogRepository => Boolean(repo))
        : [],
    languages: Array.isArray(payload.languages)
        ? payload.languages
              .map(toGithubLanguageSummary)
              .filter((language): language is GithubLanguageSummary => Boolean(language))
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

const validateToolArgs = (definition: ToolDefinition, args: Record<string, unknown>) => {
    const parsed = definition.inputSchema.safeParse(args);
    if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return parsed.data as Record<string, unknown>;
};

const createDynamicTarget = (
    target: DynamicTarget,
    runtimeOptions: Required<JacobAgentRuntimeOptions>
) =>
    resolveDynamicTarget({
        snapshotStore: runtimeOptions.snapshotStore,
        fetchFn: runtimeOptions.fetchFn,
        config: {
            githubToken: runtimeOptions.githubToken,
            githubUser: runtimeOptions.githubUser,
            huggingfaceUser: runtimeOptions.huggingfaceUser
        },
        externalToolConfig: runtimeOptions.externalToolConfig,
        target
    });

const buildRuntimeOptions = (
    options: JacobAgentRuntimeOptions
): Required<JacobAgentRuntimeOptions> => ({
    fetchFn: options.fetchFn ?? globalThis.fetch,
    githubToken: options.githubToken ?? null,
    githubUser: options.githubUser ?? DEFAULT_GITHUB_USER,
    huggingfaceUser: options.huggingfaceUser ?? DEFAULT_HUGGINGFACE_USER,
    externalToolConfig: options.externalToolConfig ?? DEFAULT_EXTERNAL_TOOL_CONFIG,
    snapshotStore: options.snapshotStore ?? createMemorySnapshotStore()
});

export const createJacobAgentRuntime = (
    options: JacobAgentRuntimeOptions = {}
): JacobAgentRuntime => {
    const runtimeOptions = buildRuntimeOptions(options);
    const siteRegistry = createSiteToolRegistry();
    const knowledgeRegistry = getStaticKnowledgeRegistry();
    const projectRepoById = new Map(
        Object.values(knowledgeRegistry.itemsById)
            .filter((item) => item.type === 'project')
            .map((project) => [project.id, getProjectRepositoryFullName(project)] as const)
            .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );

    const tools: RuntimeToolDefinition[] = [
        ...siteRegistry.toolDefinitions.map((definition) => ({
            ...definition,
            execute: async (args) => {
                const result = siteRegistry.executeTool(definition.name, args);
                if (!result) {
                    throw new Error(`Unknown site tool: ${definition.name}`);
                }

                return {
                    tool: 'site' as const,
                    ...result
                };
            }
        })),
        {
            ...toToolDefinition(
                'github',
                'get_github_profile',
                'Read the latest cached GitHub profile summary for JacobLinCool, including followers, repo counts, and top repository.',
                emptyObjectSchema
            ),
            execute: async () => {
                const snapshot = await createDynamicTarget(
                    {
                        kind: 'github_user_summary',
                        source: 'github',
                        entityKey: `user:${runtimeOptions.githubUser.toLowerCase()}`
                    },
                    runtimeOptions
                );

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
            ...toToolDefinition(
                'github',
                'get_github_repositories',
                'Read the latest cached GitHub repository catalog for JacobLinCool. Use this to discover repositories by language or keyword, for example to check whether any Rust repositories exist.',
                z
                    .object({
                        language: z.string().min(1).optional(),
                        query: z.string().min(1).optional(),
                        limit: z.number().int().positive().optional(),
                        includeArchived: z.boolean().optional()
                    })
                    .strict()
            ),
            execute: async (args) => {
                const snapshot = await createDynamicTarget(
                    {
                        kind: 'github_repo_catalog',
                        source: 'github',
                        entityKey: `user:${runtimeOptions.githubUser.toLowerCase()}:repositories`
                    },
                    runtimeOptions
                );

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
                        language ||
                        query ||
                        `user:${runtimeOptions.githubUser.toLowerCase()}:repositories`,
                    label: 'Reading GitHub repositories',
                    refs: [],
                    revision: snapshot.revision,
                    payload: {
                        ok: true,
                        login: catalog.login || runtimeOptions.githubUser,
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
            ...toToolDefinition(
                'github',
                'get_github_repo_detail',
                'Read the latest cached GitHub repository detail. Use either a published project id or a GitHub repo full name.',
                z
                    .object({
                        projectId: z.string().min(1).optional(),
                        repoFullName: z.string().min(1).optional()
                    })
                    .strict()
            ),
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

                const snapshot = await createDynamicTarget(
                    {
                        kind: 'github_repo_detail',
                        source: 'github',
                        entityKey
                    },
                    runtimeOptions
                );

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
            ...toToolDefinition(
                'huggingface',
                'get_huggingface_profile',
                'Read the latest cached Hugging Face profile summary for JacobLinCool, including models, spaces, and downloads.',
                emptyObjectSchema
            ),
            execute: async () => {
                const snapshot = await createDynamicTarget(
                    {
                        kind: 'huggingface_user_summary',
                        source: 'huggingface',
                        entityKey: `user:${runtimeOptions.huggingfaceUser.toLowerCase()}`
                    },
                    runtimeOptions
                );

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
            ...toToolDefinition(
                'huggingface',
                'get_huggingface_model_detail',
                'Read the latest cached Hugging Face model detail by model id.',
                z
                    .object({
                        id: z.string().min(1)
                    })
                    .strict()
            ),
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

                const snapshot = await createDynamicTarget(
                    {
                        kind: 'huggingface_model_detail',
                        source: 'huggingface',
                        entityKey: id
                    },
                    runtimeOptions
                );

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
            ...toToolDefinition(
                'huggingface',
                'get_huggingface_space_detail',
                'Read the latest cached Hugging Face Space detail by space id.',
                z
                    .object({
                        id: z.string().min(1)
                    })
                    .strict()
            ),
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

                const snapshot = await createDynamicTarget(
                    {
                        kind: 'huggingface_space_detail',
                        source: 'huggingface',
                        entityKey: id
                    },
                    runtimeOptions
                );

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
        listTools: () =>
            tools.map((tool) => ({
                source: tool.source,
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                inputJsonSchema: tool.inputJsonSchema
            })),
        executeTool: async (name, args) => {
            const tool = tools.find((candidate) => candidate.name === name);
            if (!tool) {
                return null;
            }

            try {
                const validatedArgs = validateToolArgs(tool, asRecord(args));
                return await tool.execute(validatedArgs);
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

export const listTools = (options: JacobAgentRuntimeOptions = {}): ToolDefinition[] =>
    createJacobAgentRuntime(options).listTools();

export const executeTool = (
    name: string,
    args: Record<string, unknown>,
    options: JacobAgentRuntimeOptions = {}
): Promise<ToolExecutionResult | null> => createJacobAgentRuntime(options).executeTool(name, args);
