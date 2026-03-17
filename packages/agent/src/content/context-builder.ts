import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types.js';
import {
    countDescendantItems,
    getStaticKnowledgeRegistry,
    type KnowledgeItem,
    type KnowledgeNode,
    type KnowledgeRegistry
} from './knowledge-registry.js';

export type SiteToolName = 'get_knowledge_root' | 'get_knowledge_node' | 'get_knowledge_item';

export type SiteToolExecutionResult = {
    label: string;
    target: string;
    refs: string[];
    payload: Record<string, unknown>;
};

type SiteToolDefinition = {
    name: SiteToolName;
    definition: ToolDefinition;
    execute: (args: Record<string, unknown>) => SiteToolExecutionResult;
};

export type SiteToolRegistry = {
    contentVersion: string;
    refs: string[];
    siteIndexText: string;
    toolDefinitions: ToolDefinition[];
    executeTool: (name: string, args: Record<string, unknown>) => SiteToolExecutionResult | null;
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const nodeRef = (id: string) => `node:${id}`;
const itemRef = (id: string) => `item:${id}`;

const toItemSummary = (item: KnowledgeItem) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    tags: item.tags
});

const toNodeSummary = (node: KnowledgeNode, descendantItemCount: number) => ({
    id: node.id,
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary,
    childNodeCount: node.childNodeIds.length,
    childItemCount: node.childItemIds.length,
    descendantItemCount
});

const buildSiteIndexText = (registry: KnowledgeRegistry) => {
    const collectionLines = registry.rootNodeIds.map((rootNodeId) => {
        const node = registry.nodesById[rootNodeId];
        const childLines = node.childNodeIds
            .map((childNodeId) => {
                const child = registry.nodesById[childNodeId];
                return `    - [${child.id}] ${child.title} (${countDescendantItems(registry, child.id)} items)`;
            })
            .join('\n');

        return [
            `  - [${node.id}] ${node.title} (${countDescendantItems(registry, node.id)} items)`,
            childLines
        ]
            .filter(Boolean)
            .join('\n');
    });

    return [
        `Published site knowledge index (version=${registry.version}, language=${registry.language}):`,
        '- Root collections:',
        ...collectionLines,
        'The index and node titles are navigation metadata, not a user-facing answer format.',
        'Do not answer from collection names or category labels alone when the user asks for concrete items such as projects, papers, tools, repositories, or examples.',
        'Use get_knowledge_node(id) for category-level detail and get_knowledge_item(id) for full item detail.'
    ].join('\n');
};

const buildErrorPayload = (message: string) => ({
    ok: false,
    error: message
});

const buildKnowledgeRootPayload = (registry: KnowledgeRegistry) => {
    return {
        ok: true,
        root: {
            version: registry.version,
            language: registry.language,
            updatedAt: registry.updatedAt,
            collections: registry.rootNodeIds.map((rootNodeId) =>
                toNodeSummary(
                    registry.nodesById[rootNodeId],
                    countDescendantItems(registry, rootNodeId)
                )
            )
        }
    };
};

const buildKnowledgeNodePayload = (registry: KnowledgeRegistry, nodeId: string) => {
    const node = registry.nodesById[nodeId];
    if (!node) {
        return buildErrorPayload('Unknown knowledge node id.');
    }

    return {
        ok: true,
        node: {
            ...toNodeSummary(node, countDescendantItems(registry, node.id)),
            parentNodeId: node.parentNodeId,
            childNodes: node.childNodeIds.map((childNodeId) =>
                toNodeSummary(
                    registry.nodesById[childNodeId],
                    countDescendantItems(registry, childNodeId)
                )
            ),
            childItems: node.childItemIds.map((childItemId) =>
                toItemSummary(registry.itemsById[childItemId])
            )
        }
    };
};

const buildKnowledgeItemPayload = (registry: KnowledgeRegistry, itemId: string) => {
    const item = registry.itemsById[itemId];
    if (!item) {
        return buildErrorPayload('Unknown knowledge item id.');
    }

    return {
        ok: true,
        item: {
            id: item.id,
            type: item.type,
            title: item.title,
            summary: item.summary,
            tags: item.tags,
            attributes: item.attributes,
            body: item.body,
            links: item.links,
            relatedItems: item.relatedItemIds.map((relatedItemId) =>
                toItemSummary(registry.itemsById[relatedItemId])
            )
        }
    };
};

export const createSiteToolRegistryFromRegistry = (
    registry: KnowledgeRegistry
): SiteToolRegistry => {
    const refs = [
        'site:root',
        ...Object.keys(registry.nodesById).map((nodeId) => nodeRef(nodeId)),
        ...Object.keys(registry.itemsById).map((itemId) => itemRef(itemId))
    ];
    const siteIndexText = buildSiteIndexText(registry);

    const tools: SiteToolDefinition[] = [
        {
            name: 'get_knowledge_root',
            definition: {
                source: 'site',
                name: 'get_knowledge_root',
                description:
                    'Read the top-level knowledge collections and item counts for navigation before choosing a specific node or item. Do not use collection names alone as the final answer when the user asked for concrete items.',
                inputSchema: z.object({}).strict(),
                inputJsonSchema: z.toJSONSchema(z.object({}).strict())
            },
            execute: () => ({
                label: 'Reading knowledge root',
                target: 'knowledge root',
                refs: registry.rootNodeIds.map((rootNodeId) => nodeRef(rootNodeId)),
                payload: buildKnowledgeRootPayload(registry)
            })
        },
        {
            name: 'get_knowledge_node',
            definition: {
                source: 'site',
                name: 'get_knowledge_node',
                description:
                    'Read one knowledge node by id, including child categories and immediate child items. Use this for navigation and scoping; prefer concrete knowledge items in the final answer when the user asked for examples, projects, papers, tools, or repositories.',
                inputSchema: z
                    .object({
                        id: z.string().min(1)
                    })
                    .strict(),
                inputJsonSchema: z.toJSONSchema(
                    z
                        .object({
                            id: z
                                .string()
                                .min(1)
                                .describe(
                                    'Knowledge node id from get_knowledge_root or get_knowledge_node.'
                                )
                        })
                        .strict()
                )
            },
            execute: (args) => {
                const id = asString(args.id);
                const node = registry.nodesById[id];

                return {
                    label: node
                        ? `Reading knowledge node: ${node.title}`
                        : 'Reading knowledge node',
                    target: node?.title ?? (id || 'knowledge node'),
                    refs: node
                        ? [
                              nodeRef(node.id),
                              ...node.childNodeIds.map((childNodeId) => nodeRef(childNodeId)),
                              ...node.childItemIds.map((childItemId) => itemRef(childItemId))
                          ]
                        : [],
                    payload: buildKnowledgeNodePayload(registry, id)
                };
            }
        },
        {
            name: 'get_knowledge_item',
            definition: {
                source: 'site',
                name: 'get_knowledge_item',
                description:
                    'Read one knowledge item by id, including full body, links, and related items.',
                inputSchema: z
                    .object({
                        id: z.string().min(1)
                    })
                    .strict(),
                inputJsonSchema: z.toJSONSchema(
                    z
                        .object({
                            id: z
                                .string()
                                .min(1)
                                .describe('Knowledge item id from get_knowledge_node.')
                        })
                        .strict()
                )
            },
            execute: (args) => {
                const id = asString(args.id);
                const item = registry.itemsById[id];

                return {
                    label: item
                        ? `Reading knowledge item: ${item.title}`
                        : 'Reading knowledge item',
                    target: item?.title ?? (id || 'knowledge item'),
                    refs: item
                        ? [
                              itemRef(item.id),
                              ...(registry.itemToParentNodeIds[item.id] ?? []).map((parentNodeId) =>
                                  nodeRef(parentNodeId)
                              ),
                              ...item.relatedItemIds.map((relatedItemId) => itemRef(relatedItemId))
                          ]
                        : [],
                    payload: buildKnowledgeItemPayload(registry, id)
                };
            }
        }
    ];

    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

    return {
        contentVersion: registry.version,
        refs,
        siteIndexText,
        toolDefinitions: tools.map((tool) => tool.definition),
        executeTool: (name, args) => toolMap.get(name as SiteToolName)?.execute(args) ?? null
    };
};

export const createSiteToolRegistry = (): SiteToolRegistry =>
    createSiteToolRegistryFromRegistry(getStaticKnowledgeRegistry());
