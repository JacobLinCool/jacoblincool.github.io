import { createSiteToolRegistry } from '$lib/server/content/context-builder';
import { describe, expect, it } from 'vitest';

describe('createSiteToolRegistry', () => {
    it('builds a compact site index and exposes section/detail tools', () => {
        const registry = createSiteToolRegistry('en');

        expect(registry.siteIndexText).toContain('Published site knowledge index');
        expect(registry.siteIndexText).toContain('[rq-agent-collaboration]');
        expect(registry.toolDeclarations.map((tool) => tool.name)).toEqual(
            expect.arrayContaining([
                'get_site_overview',
                'get_research_interests',
                'get_previous_publications',
                'get_publication_detail',
                'get_side_projects',
                'get_project_detail'
            ])
        );

        const publicationDetail = registry.executeTool('get_publication_detail', {
            id: 'pub-si-2025-open-track'
        });
        expect(publicationDetail?.payload).toMatchObject({
            ok: true,
            publication: {
                id: 'pub-si-2025-open-track',
                title: 'The NTNU System at the S&I Challenge 2025 SLA Open Track'
            }
        });

        const projectDetail = registry.executeTool('get_project_detail', {
            id: 'project-d1-manager'
        });
        expect(projectDetail?.payload).toMatchObject({
            ok: true,
            project: {
                id: 'project-d1-manager',
                name: 'd1-manager'
            }
        });
    });

    it('returns an explicit error payload for unknown detail ids', () => {
        const registry = createSiteToolRegistry('en');

        const publicationDetail = registry.executeTool('get_publication_detail', {
            id: 'missing-publication'
        });
        expect(publicationDetail?.payload).toEqual({
            ok: false,
            error: 'Unknown publication id.'
        });
    });
});
