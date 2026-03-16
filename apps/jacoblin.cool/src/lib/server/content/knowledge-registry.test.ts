import { buildStaticKnowledgeContent } from '$lib/server/content/knowledge-registry';
import { describe, expect, it } from 'vitest';

type MutableGraphSource = {
    version: string;
    language: string;
    updatedAt: string;
    rootNodeIds: string[];
    nodes: Record<
        string,
        {
            id: string;
            nodeType: 'collection' | 'category';
            title: string;
            summary: string;
            parentNodeId: string | null;
            childNodeIds: string[];
            childItemIds: string[];
        }
    >;
};

type MutableItemsSource = {
    items: Record<
        string,
        {
            id: string;
            type: string;
            title: string;
            summary: string;
            tags: string[];
            attributes: Record<string, unknown>;
            body: Array<{ id: string; label: string; text: string }>;
            links: Array<{ id: string; label: string; url: string; kind: string }>;
            relatedItemIds: string[];
        }
    >;
};

type MutableSiteUiSource = {
    homepage: {
        metricsProfileItemId: string;
        sections: Array<{
            id: string;
            rootNodeId: string;
            variant: 'research-cards' | 'publication-rail' | 'project-rail';
            maxItems: number;
            eyebrow: string;
            heading: string;
            description: string;
            ctaLabel: string;
        }>;
    };
    chat: {
        taglines: string[];
        promptChips: Array<{ id: string; label: string; prompt: string }>;
        deepDivePrompts: Array<{
            id: string;
            targetItemId: string;
            label: string;
            prompt: string;
        }>;
    };
};

const createValidSources = (): {
    graph: MutableGraphSource;
    items: MutableItemsSource;
    ui: MutableSiteUiSource;
} => ({
    graph: {
        version: 'v-test',
        language: 'en',
        updatedAt: '2026-03-17T00:00:00.000Z',
        rootNodeIds: ['profile', 'research'],
        nodes: {
            profile: {
                id: 'profile',
                nodeType: 'collection',
                title: 'Profile',
                summary: 'Profile summary.',
                parentNodeId: null,
                childNodeIds: [],
                childItemIds: ['profile.card']
            },
            research: {
                id: 'research',
                nodeType: 'collection',
                title: 'Research',
                summary: 'Research summary.',
                parentNodeId: null,
                childNodeIds: ['research.agent-systems'],
                childItemIds: []
            },
            'research.agent-systems': {
                id: 'research.agent-systems',
                nodeType: 'category',
                title: 'Agent Systems',
                summary: 'Agent systems summary.',
                parentNodeId: 'research',
                childNodeIds: [],
                childItemIds: ['rq-1']
            }
        }
    },
    items: {
        items: {
            'profile.card': {
                id: 'profile.card',
                type: 'profile',
                title: 'Profile Card',
                summary: 'Profile summary.',
                tags: ['Profile'],
                attributes: {
                    profileUrl: 'https://example.com',
                    citations: 0,
                    hIndex: 0,
                    i10Index: 0,
                    topics: ['Test']
                },
                body: [],
                links: [],
                relatedItemIds: []
            },
            'rq-1': {
                id: 'rq-1',
                type: 'research-question',
                title: 'Question',
                summary: 'Question summary.',
                tags: ['Research'],
                attributes: {},
                body: [
                    { id: 'question', label: 'Question', text: 'Question text.' },
                    { id: 'why-it-matters', label: 'Why', text: 'Why text.' },
                    { id: 'current-direction', label: 'Current', text: 'Current text.' }
                ],
                links: [],
                relatedItemIds: []
            }
        }
    },
    ui: {
        homepage: {
            metricsProfileItemId: 'profile.card',
            sections: [
                {
                    id: 'research',
                    rootNodeId: 'research',
                    variant: 'research-cards',
                    maxItems: 1,
                    eyebrow: 'Research',
                    heading: 'Heading',
                    description: 'Description',
                    ctaLabel: 'Open'
                }
            ]
        },
        chat: {
            taglines: ['Hello'],
            promptChips: [{ id: 'chip-1', label: 'Ask', prompt: 'Ask.' }],
            deepDivePrompts: [
                {
                    id: 'prompt-1',
                    targetItemId: 'rq-1',
                    label: 'Ask about research',
                    prompt: 'Ask about research.'
                }
            ]
        }
    }
});

describe('buildStaticKnowledgeContent', () => {
    it('fails when a node id collides with an item id', () => {
        const { graph, items, ui } = createValidSources();
        items.items.research = {
            id: 'research',
            type: 'note',
            title: 'Research duplicate',
            summary: 'Duplicate item.',
            tags: [],
            attributes: {},
            body: [],
            links: [],
            relatedItemIds: []
        };

        expect(() => buildStaticKnowledgeContent(graph, items, ui)).toThrow(
            'Node id collides with item id: research'
        );
    });

    it('fails on dangling references', () => {
        const { graph, items, ui } = createValidSources();
        graph.nodes.research.childNodeIds.push('missing-category');

        expect(() => buildStaticKnowledgeContent(graph, items, ui)).toThrow(
            'Dangling childNodeId on research: missing-category'
        );
    });

    it('fails on dangling related items', () => {
        const { graph, items, ui } = createValidSources();
        items.items['rq-1'].relatedItemIds.push('missing-item');

        expect(() => buildStaticKnowledgeContent(graph, items, ui)).toThrow(
            'Dangling relatedItemId on rq-1: missing-item'
        );
    });

    it('fails when the node graph contains a cycle', () => {
        const { graph, items, ui } = createValidSources();
        graph.nodes['research.loop'] = {
            id: 'research.loop',
            nodeType: 'category',
            title: 'Loop',
            summary: 'Loop summary.',
            parentNodeId: 'research.agent-systems',
            childNodeIds: ['research.agent-systems'],
            childItemIds: []
        };
        graph.nodes['research.agent-systems'].childNodeIds.push('research.loop');

        expect(() => buildStaticKnowledgeContent(graph, items, ui)).toThrow(
            'Cycle detected in knowledge graph'
        );
    });

    it('fails when the root node list is empty', () => {
        const { graph, items, ui } = createValidSources();
        graph.rootNodeIds = [];

        expect(() => buildStaticKnowledgeContent(graph, items, ui)).toThrow();
    });
});
