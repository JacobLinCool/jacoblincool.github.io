import type { PromptChip } from '$lib/types/chat';
import type { DeepDivePrompt, HomeSectionConfig } from '$lib/types/home';
import { z } from 'zod';
import knowledgeGraphSource from '../../../../data/knowledge.graph.json';
import knowledgeItemsSource from '../../../../data/knowledge.items.json';
import siteUiSource from '../../../../data/site-ui.json';

export type KnowledgeNodeType = 'collection' | 'category';

export type KnowledgeBodySection = {
    id: string;
    label: string;
    text: string;
};

export type KnowledgeLink = {
    id: string;
    label: string;
    url: string;
    kind: string;
};

export type KnowledgeItem = {
    id: string;
    type: string;
    title: string;
    summary: string;
    tags: string[];
    attributes: Record<string, unknown>;
    body: KnowledgeBodySection[];
    links: KnowledgeLink[];
    relatedItemIds: string[];
};

export type KnowledgeNode = {
    id: string;
    nodeType: KnowledgeNodeType;
    title: string;
    summary: string;
    parentNodeId: string | null;
    childNodeIds: string[];
    childItemIds: string[];
};

export type KnowledgeRegistry = {
    version: string;
    language: string;
    updatedAt: string;
    rootNodeIds: string[];
    nodesById: Record<string, KnowledgeNode>;
    itemsById: Record<string, KnowledgeItem>;
    itemToParentNodeIds: Record<string, string[]>;
    deepDivePromptByItemId: Record<string, DeepDivePrompt>;
    homepageSectionBindings: Record<string, HomeSectionConfig>;
    metricsProfileItemId: string;
};

export type SiteUiConfig = {
    homepage: {
        metricsProfileItemId: string;
        sections: Record<string, HomeSectionConfig>;
    };
    chat: {
        taglines: string[];
        promptChips: PromptChip[];
        deepDivePrompts: DeepDivePrompt[];
        deepDivePromptByItemId: Record<string, DeepDivePrompt>;
    };
};

export type StaticKnowledgeContent = {
    registry: KnowledgeRegistry;
    siteUi: SiteUiConfig;
};

const isoDateStringSchema = z.string().datetime({ offset: true });

const knowledgeBodySectionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    text: z.string().min(1)
});

const knowledgeLinkSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    url: z.url(),
    kind: z.string().min(1)
});

const knowledgeItemSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    tags: z.array(z.string().min(1)).default([]),
    attributes: z.record(z.string(), z.unknown()).default({}),
    body: z.array(knowledgeBodySectionSchema).default([]),
    links: z.array(knowledgeLinkSchema).default([]),
    relatedItemIds: z.array(z.string().min(1)).default([])
});

const knowledgeNodeSchema = z.object({
    id: z.string().min(1),
    nodeType: z.enum(['collection', 'category']),
    title: z.string().min(1),
    summary: z.string().min(1),
    parentNodeId: z.string().min(1).nullable(),
    childNodeIds: z.array(z.string().min(1)).default([]),
    childItemIds: z.array(z.string().min(1)).default([])
});

const knowledgeGraphSchema = z.object({
    version: z.string().min(1),
    language: z.string().min(1),
    updatedAt: isoDateStringSchema,
    rootNodeIds: z.array(z.string().min(1)).min(1),
    nodes: z.record(z.string(), knowledgeNodeSchema)
});

const knowledgeItemsSchema = z.object({
    items: z.record(z.string(), knowledgeItemSchema)
});

const homeSectionVariantSchema = z.enum(['research-cards', 'publication-rail', 'project-rail']);

const homeSectionConfigSchema = z.object({
    id: z.string().min(1),
    rootNodeId: z.string().min(1),
    variant: homeSectionVariantSchema,
    maxItems: z.number().int().positive(),
    eyebrow: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1),
    ctaLabel: z.string().min(1)
});

const promptChipSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    prompt: z.string().min(1)
});

const deepDivePromptSchema = z.object({
    id: z.string().min(1),
    targetItemId: z.string().min(1),
    label: z.string().min(1),
    prompt: z.string().min(1)
});

const siteUiSchema = z.object({
    homepage: z.object({
        metricsProfileItemId: z.string().min(1),
        sections: z.array(homeSectionConfigSchema).min(1)
    }),
    chat: z.object({
        taglines: z.array(z.string().min(1)).min(1),
        promptChips: z.array(promptChipSchema).min(1),
        deepDivePrompts: z.array(deepDivePromptSchema).min(1)
    })
});

const invariant = (condition: unknown, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const getNodeOrThrow = (
    nodesById: Record<string, KnowledgeNode>,
    nodeId: string,
    message: string
): KnowledgeNode => {
    const node = nodesById[nodeId];
    invariant(node, message);
    return node;
};

const getItemOrThrow = (
    itemsById: Record<string, KnowledgeItem>,
    itemId: string,
    message: string
): KnowledgeItem => {
    const item = itemsById[itemId];
    invariant(item, message);
    return item;
};

const ensureUniqueValues = (values: string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) {
            throw new Error(`Duplicate ${label}: ${value}`);
        }
        seen.add(value);
    }
};

const collectReachableNodeIds = (
    nodesById: Record<string, KnowledgeNode>,
    rootNodeIds: string[]
) => {
    const visited = new Set<string>();

    const visit = (nodeId: string, stack: string[]) => {
        if (stack.includes(nodeId)) {
            const cyclePath = [...stack, nodeId].join(' -> ');
            throw new Error(`Cycle detected in knowledge graph: ${cyclePath}`);
        }

        if (visited.has(nodeId)) {
            return;
        }

        const node = getNodeOrThrow(nodesById, nodeId, `Unknown root node id: ${nodeId}`);

        visited.add(nodeId);
        for (const childNodeId of node.childNodeIds) {
            visit(childNodeId, [...stack, nodeId]);
        }
    };

    for (const rootNodeId of rootNodeIds) {
        visit(rootNodeId, []);
    }

    return visited;
};

const validateAcyclicNodeGraph = (nodesById: Record<string, KnowledgeNode>) => {
    const visited = new Set<string>();

    const visit = (nodeId: string, stack: string[]) => {
        if (stack.includes(nodeId)) {
            const cyclePath = [...stack, nodeId].join(' -> ');
            throw new Error(`Cycle detected in knowledge graph: ${cyclePath}`);
        }

        if (visited.has(nodeId)) {
            return;
        }

        const node = nodesById[nodeId];
        if (!node) {
            return;
        }

        visited.add(nodeId);
        for (const childNodeId of node.childNodeIds) {
            visit(childNodeId, [...stack, nodeId]);
        }
    };

    for (const nodeId of Object.keys(nodesById)) {
        visit(nodeId, []);
    }
};

const normalizeSiteUi = (siteUi: z.infer<typeof siteUiSchema>): SiteUiConfig => {
    const sectionsById = Object.fromEntries(
        siteUi.homepage.sections.map((section) => [section.id, section])
    ) as Record<string, HomeSectionConfig>;
    const deepDivePromptByItemId = Object.fromEntries(
        siteUi.chat.deepDivePrompts.map((prompt) => [prompt.targetItemId, prompt])
    ) as Record<string, DeepDivePrompt>;

    return {
        homepage: {
            metricsProfileItemId: siteUi.homepage.metricsProfileItemId,
            sections: sectionsById
        },
        chat: {
            taglines: siteUi.chat.taglines,
            promptChips: siteUi.chat.promptChips as PromptChip[],
            deepDivePrompts: siteUi.chat.deepDivePrompts as DeepDivePrompt[],
            deepDivePromptByItemId
        }
    };
};

export const buildStaticKnowledgeContent = (
    graphInput: unknown,
    itemsInput: unknown,
    siteUiInput: unknown
): StaticKnowledgeContent => {
    const graph = knowledgeGraphSchema.parse(graphInput);
    const items = knowledgeItemsSchema.parse(itemsInput);
    const siteUi = siteUiSchema.parse(siteUiInput);

    const nodesById = graph.nodes as Record<string, KnowledgeNode>;
    const itemsById = items.items as Record<string, KnowledgeItem>;

    for (const [key, node] of Object.entries(nodesById)) {
        invariant(node.id === key, `Knowledge node key/id mismatch: ${key} != ${node.id}`);
        ensureUniqueValues(node.childNodeIds, `child node id in ${node.id}`);
        ensureUniqueValues(node.childItemIds, `child item id in ${node.id}`);
    }

    for (const [key, item] of Object.entries(itemsById)) {
        invariant(item.id === key, `Knowledge item key/id mismatch: ${key} != ${item.id}`);
        ensureUniqueValues(item.relatedItemIds, `related item id in ${item.id}`);
        ensureUniqueValues(
            item.body.map((section) => section.id),
            `body section id in ${item.id}`
        );
        ensureUniqueValues(
            item.links.map((link) => link.id),
            `link id in ${item.id}`
        );
    }

    const allNodeIds = Object.keys(nodesById);
    const allItemIds = Object.keys(itemsById);
    ensureUniqueValues(graph.rootNodeIds, 'root node id');
    for (const nodeId of allNodeIds) {
        invariant(!itemsById[nodeId], `Node id collides with item id: ${nodeId}`);
    }

    for (const rootNodeId of graph.rootNodeIds) {
        const rootNode = getNodeOrThrow(
            nodesById,
            rootNodeId,
            `Unknown root node id: ${rootNodeId}`
        );
        invariant(
            rootNode.parentNodeId === null,
            `Root node must not have a parent: ${rootNodeId}`
        );
    }

    validateAcyclicNodeGraph(nodesById);

    const itemToParentNodeIds = Object.fromEntries(
        allItemIds.map((itemId) => [itemId, [] as string[]])
    ) as Record<string, string[]>;

    for (const node of Object.values(nodesById)) {
        if (node.parentNodeId) {
            const parent = getNodeOrThrow(
                nodesById,
                node.parentNodeId,
                `Unknown parentNodeId on ${node.id}: ${node.parentNodeId}`
            );
            invariant(
                parent.childNodeIds.includes(node.id),
                `Parent/child mismatch: ${node.parentNodeId} does not reference ${node.id}`
            );
        }

        for (const childNodeId of node.childNodeIds) {
            const childNode = getNodeOrThrow(
                nodesById,
                childNodeId,
                `Dangling childNodeId on ${node.id}: ${childNodeId}`
            );
            invariant(
                childNode.parentNodeId === node.id,
                `Child node parent mismatch: ${childNodeId} should point back to ${node.id}`
            );
        }

        for (const childItemId of node.childItemIds) {
            getItemOrThrow(
                itemsById,
                childItemId,
                `Dangling childItemId on ${node.id}: ${childItemId}`
            );
            itemToParentNodeIds[childItemId].push(node.id);
        }
    }

    const reachableNodeIds = collectReachableNodeIds(nodesById, graph.rootNodeIds);
    for (const nodeId of allNodeIds) {
        invariant(reachableNodeIds.has(nodeId), `Unreachable knowledge node: ${nodeId}`);
    }

    for (const itemId of allItemIds) {
        invariant(itemToParentNodeIds[itemId].length > 0, `Unreachable knowledge item: ${itemId}`);
    }

    for (const item of Object.values(itemsById)) {
        for (const relatedItemId of item.relatedItemIds) {
            getItemOrThrow(
                itemsById,
                relatedItemId,
                `Dangling relatedItemId on ${item.id}: ${relatedItemId}`
            );
        }
    }

    const normalizedSiteUi = normalizeSiteUi(siteUi);
    ensureUniqueValues(Object.keys(normalizedSiteUi.homepage.sections), 'homepage section id');
    ensureUniqueValues(
        siteUi.chat.promptChips.map((chip) => chip.id),
        'prompt chip id'
    );
    ensureUniqueValues(
        siteUi.chat.deepDivePrompts.map((prompt) => prompt.id),
        'deep dive prompt id'
    );
    ensureUniqueValues(
        siteUi.chat.deepDivePrompts.map((prompt) => prompt.targetItemId),
        'deep dive prompt target item id'
    );

    for (const section of Object.values(normalizedSiteUi.homepage.sections)) {
        invariant(
            Boolean(nodesById[section.rootNodeId]),
            `Homepage section ${section.id} references unknown root node ${section.rootNodeId}`
        );
    }

    const metricsProfileItem = getItemOrThrow(
        itemsById,
        normalizedSiteUi.homepage.metricsProfileItemId,
        `Unknown homepage metrics profile item: ${normalizedSiteUi.homepage.metricsProfileItemId}`
    );
    invariant(
        metricsProfileItem.type === 'profile',
        `Homepage metrics item must be a profile item: ${metricsProfileItem.id}`
    );

    for (const prompt of normalizedSiteUi.chat.deepDivePrompts) {
        getItemOrThrow(
            itemsById,
            prompt.targetItemId,
            `Deep dive prompt references unknown item: ${prompt.targetItemId}`
        );
    }

    return {
        registry: {
            version: graph.version,
            language: graph.language,
            updatedAt: graph.updatedAt,
            rootNodeIds: graph.rootNodeIds,
            nodesById,
            itemsById,
            itemToParentNodeIds,
            deepDivePromptByItemId: normalizedSiteUi.chat.deepDivePromptByItemId,
            homepageSectionBindings: normalizedSiteUi.homepage.sections,
            metricsProfileItemId: normalizedSiteUi.homepage.metricsProfileItemId
        },
        siteUi: normalizedSiteUi
    };
};

const staticKnowledgeContent = buildStaticKnowledgeContent(
    knowledgeGraphSource,
    knowledgeItemsSource,
    siteUiSource
);

export const getStaticKnowledgeRegistry = () => staticKnowledgeContent.registry;

export const getStaticSiteUiConfig = () => staticKnowledgeContent.siteUi;

export const collectDescendantItemIds = (registry: KnowledgeRegistry, rootNodeId: string) => {
    const seenNodes = new Set<string>();
    const seenItems = new Set<string>();
    const orderedItemIds: string[] = [];

    const visit = (nodeId: string) => {
        if (seenNodes.has(nodeId)) {
            return;
        }

        const node = getNodeOrThrow(registry.nodesById, nodeId, `Unknown node id: ${nodeId}`);
        seenNodes.add(nodeId);

        for (const childItemId of node.childItemIds) {
            if (seenItems.has(childItemId)) {
                continue;
            }

            seenItems.add(childItemId);
            orderedItemIds.push(childItemId);
        }

        for (const childNodeId of node.childNodeIds) {
            visit(childNodeId);
        }
    };

    visit(rootNodeId);
    return orderedItemIds;
};

export const countDescendantItems = (registry: KnowledgeRegistry, rootNodeId: string) =>
    collectDescendantItemIds(registry, rootNodeId).length;
