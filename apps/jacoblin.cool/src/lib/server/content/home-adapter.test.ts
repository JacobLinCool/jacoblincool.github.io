import {
    getStaticHomeProjection,
    getStaticHomeProjectionForDate,
    getStaticScholarProfile
} from '$lib/server/content/home-adapter';
import { describe, expect, it } from 'vitest';

describe('home adapter', () => {
    it('projects homepage sections and deep dive prompts from the structured knowledge registry', () => {
        const projection = getStaticHomeProjectionForDate(new Date('2026-03-18T00:00:00+08:00'));

        expect(projection.homePayload.researchQuestions).toHaveLength(3);
        expect(projection.homePayload.publications).toHaveLength(3);
        expect(projection.homePayload.projects).toHaveLength(5);
        expect(projection.homePayload.projects.map((project) => project.id)).toEqual([
            'project-d1-manager',
            'project-leetcode-stats-card',
            'project-selflare',
            'project-gradio-rs',
            'project-rhythm-rs'
        ]);
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
        expect(projection.chatConfig.deepDivePromptsByItemId['project-selflare']).toMatchObject({
            targetItemId: 'project-selflare',
            label: 'Ask about selflare'
        });
        expect(projection.chatConfig.promptChips.map((chip) => chip.id)).toEqual([
            'intro-work',
            'research-focus',
            'dev-journey',
            'site-behind'
        ]);
    });

    it('swaps in the special-occasion chip on active occasion days without changing chip count', () => {
        const projection = getStaticHomeProjectionForDate(new Date('2026-03-17T00:00:00+08:00'));

        expect(projection.chatConfig.promptChips.map((chip) => chip.id)).toEqual([
            'occasion-birthday',
            'intro-work',
            'research-focus',
            'dev-journey'
        ]);
        expect(projection.chatConfig.promptChips).toHaveLength(4);
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

    it('keeps the public helper wired to the current-date projection path', () => {
        expect(getStaticHomeProjection()).toMatchObject({
            homePayload: {
                researchQuestions: expect.any(Array),
                publications: expect.any(Array),
                projects: expect.any(Array)
            },
            chatConfig: {
                promptChips: expect.any(Array)
            }
        });
    });
});
