import { getStaticHomeProjection, getStaticScholarProfile } from '$lib/server/content/home-adapter';
import { describe, expect, it } from 'vitest';

describe('home adapter', () => {
    it('projects homepage sections and deep dive prompts from the structured knowledge registry', () => {
        const projection = getStaticHomeProjection();

        expect(projection.homePayload.researchQuestions).toHaveLength(3);
        expect(projection.homePayload.publications).toHaveLength(3);
        expect(projection.homePayload.projects).toHaveLength(3);
        expect(projection.homeUi.sections.research).toMatchObject({
            rootNodeId: 'research',
            variant: 'research-cards'
        });
        expect(
            projection.chatConfig.deepDivePromptsByItemId['rq-agent-collaboration']
        ).toMatchObject({
            targetItemId: 'rq-agent-collaboration',
            label: 'Deep dive: Multi-human agent collaboration'
        });
    });

    it('maps the scholar profile item into the existing scholar metrics shape', () => {
        expect(getStaticScholarProfile()).toEqual({
            profileUrl: 'https://scholar.google.com/citations?user=BdzYgY0AAAAJ',
            citations: 8,
            hIndex: 2,
            i10Index: 0,
            topics: ['Human-Computer Interaction', 'AI Agents', 'Software Engineering']
        });
    });
});
