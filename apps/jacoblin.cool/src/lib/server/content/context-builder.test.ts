import {
    createSiteToolRegistry,
    createSiteToolRegistryFromRegistry
} from '$lib/server/content/context-builder';
import { buildStaticKnowledgeContent } from '$lib/server/content/knowledge-registry';
import { describe, expect, it } from 'vitest';

describe('createSiteToolRegistry', () => {
    it('builds a compact site index and exposes generic hierarchy tools', () => {
        const registry = createSiteToolRegistry();

        expect(registry.siteIndexText).toContain('Published site knowledge index');
        expect(registry.siteIndexText).toContain('[research]');
        expect(registry.toolDeclarations.map((tool) => tool.name)).toEqual(
            expect.arrayContaining([
                'get_knowledge_root',
                'get_knowledge_node',
                'get_knowledge_item'
            ])
        );

        const rootPayload = registry.executeTool('get_knowledge_root', {});
        expect(rootPayload?.payload).toMatchObject({
            ok: true,
            root: {
                collections: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'research',
                        title: 'Research Interests'
                    })
                ])
            }
        });

        const nodePayload = registry.executeTool('get_knowledge_node', {
            id: 'publications.speaking-assessment'
        });
        expect(nodePayload?.payload).toMatchObject({
            ok: true,
            node: {
                id: 'publications.speaking-assessment',
                childItems: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'pub-si-2025-open-track'
                    })
                ])
            }
        });

        const itemPayload = registry.executeTool('get_knowledge_item', {
            id: 'project-d1-manager'
        });
        expect(itemPayload?.payload).toMatchObject({
            ok: true,
            item: {
                id: 'project-d1-manager',
                title: 'd1-manager'
            }
        });
    });

    it('returns an explicit error payload for unknown ids', () => {
        const registry = createSiteToolRegistry();

        expect(registry.executeTool('get_knowledge_node', { id: 'missing-node' })?.payload).toEqual(
            {
                ok: false,
                error: 'Unknown knowledge node id.'
            }
        );
        expect(registry.executeTool('get_knowledge_item', { id: 'missing-item' })?.payload).toEqual(
            {
                ok: false,
                error: 'Unknown knowledge item id.'
            }
        );
    });

    it('reads newly added collections and items without code changes', () => {
        const custom = buildStaticKnowledgeContent(
            {
                version: 'v-test',
                language: 'en',
                updatedAt: '2026-03-17T00:00:00.000Z',
                rootNodeIds: ['profile', 'notes'],
                nodes: {
                    profile: {
                        id: 'profile',
                        nodeType: 'collection',
                        title: 'Profile',
                        summary: 'Profile collection.',
                        parentNodeId: null,
                        childNodeIds: [],
                        childItemIds: ['profile.card']
                    },
                    notes: {
                        id: 'notes',
                        nodeType: 'collection',
                        title: 'Notes',
                        summary: 'General notes.',
                        parentNodeId: null,
                        childNodeIds: ['notes.interview'],
                        childItemIds: []
                    },
                    'notes.interview': {
                        id: 'notes.interview',
                        nodeType: 'category',
                        title: 'Interview Notes',
                        summary: 'Interview-related notes.',
                        parentNodeId: 'notes',
                        childNodeIds: [],
                        childItemIds: ['note-1']
                    }
                }
            },
            {
                items: {
                    'note-1': {
                        id: 'note-1',
                        type: 'note',
                        title: 'Interview Note',
                        summary: 'A standalone note item.',
                        tags: ['Note'],
                        attributes: {},
                        body: [{ id: 'overview', label: 'Overview', text: 'Hello note.' }],
                        links: [],
                        relatedItemIds: ['profile.card']
                    },
                    'profile.card': {
                        id: 'profile.card',
                        type: 'profile',
                        title: 'Profile Card',
                        summary: 'Profile item for metrics.',
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
                    }
                }
            },
            {
                homepage: {
                    metricsProfileItemId: 'profile.card',
                    sections: [
                        {
                            id: 'notes',
                            rootNodeId: 'notes',
                            variant: 'research-cards',
                            maxItems: 1,
                            eyebrow: 'Notes',
                            heading: 'Notes',
                            description: 'Notes description.',
                            ctaLabel: 'Open'
                        }
                    ]
                },
                chat: {
                    taglines: ['Hello'],
                    promptChips: [{ id: 'chip-1', label: 'Ask', prompt: 'Ask something.' }],
                    deepDivePrompts: [
                        {
                            id: 'note-1-prompt',
                            targetItemId: 'note-1',
                            label: 'Ask about note',
                            prompt: 'Talk about the note.'
                        }
                    ]
                }
            }
        );

        const registry = createSiteToolRegistryFromRegistry(custom.registry);
        expect(registry.executeTool('get_knowledge_root', {})?.payload).toMatchObject({
            ok: true,
            root: {
                collections: expect.arrayContaining([
                    expect.objectContaining({ id: 'notes', title: 'Notes' })
                ])
            }
        });
        expect(registry.executeTool('get_knowledge_item', { id: 'note-1' })?.payload).toMatchObject(
            {
                ok: true,
                item: {
                    id: 'note-1',
                    type: 'note'
                }
            }
        );
    });
});
