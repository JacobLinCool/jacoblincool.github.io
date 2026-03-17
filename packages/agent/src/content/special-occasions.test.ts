import { describe, expect, it } from 'vitest';
import {
    applySpecialOccasionPromptChips,
    buildSpecialOccasionSystemInstruction,
    buildStaticSpecialOccasionCatalog,
    getActiveSpecialOccasion,
    getSpecialOccasionCatalog,
    loadStaticSpecialOccasionCatalog,
    resolveSpecialOccasion,
    SITE_OCCASION_TIME_ZONE
} from './special-occasions.js';

describe('special occasions', () => {
    it('activates the birthday celebration on march 17 in taipei', () => {
        expect(resolveSpecialOccasion(new Date('2026-03-16T16:00:00Z'))).toBe('birthday');
        expect(resolveSpecialOccasion(new Date('2026-03-17T15:59:59Z'))).toBe('birthday');
    });

    it('stays inactive outside march 17 in taipei', () => {
        expect(resolveSpecialOccasion(new Date('2026-03-16T15:59:59Z'))).toBeNull();
        expect(resolveSpecialOccasion(new Date('2026-03-17T16:00:00Z'))).toBeNull();
    });

    it('allows callers to override the reference time zone', () => {
        expect(resolveSpecialOccasion(new Date('2026-03-16T16:30:00Z'), 'UTC')).toBeNull();
        expect(
            resolveSpecialOccasion(new Date('2026-03-16T16:30:00Z'), SITE_OCCASION_TIME_ZONE)
        ).toBe('birthday');
    });

    it('exposes the active occasion definition from the shared catalog', () => {
        expect(getSpecialOccasionCatalog()).toHaveLength(1);
        expect(loadStaticSpecialOccasionCatalog()).toMatchObject({
            version: 'v1',
            timeZone: 'Asia/Taipei'
        });
        expect(getActiveSpecialOccasion(new Date('2026-03-17T00:00:00+08:00'))).toMatchObject({
            id: 'birthday',
            title: "Jacob's birthday"
        });
    });

    it('prepends the occasion prompt chip and drops the last default chip', () => {
        const promptChips = [
            { id: 'intro-work', label: 'What are you studying now?', prompt: 'Q1' },
            { id: 'research-focus', label: 'Research interests', prompt: 'Q2' },
            { id: 'dev-journey', label: 'Your journey into tech', prompt: 'Q3' },
            { id: 'site-behind', label: 'How was this site built?', prompt: 'Q4' }
        ];

        expect(
            applySpecialOccasionPromptChips(promptChips, new Date('2026-03-17T00:00:00+08:00'))
        ).toEqual([
            {
                id: 'occasion-birthday',
                label: 'What Day Is Today?',
                prompt: 'What day is it for you today, and how does the site mark it?'
            },
            promptChips[0],
            promptChips[1],
            promptChips[2]
        ]);
        expect(
            applySpecialOccasionPromptChips(promptChips, new Date('2026-03-18T00:00:00+08:00'))
        ).toEqual(promptChips);
    });

    it('builds chat instruction text with both today and the known occasion catalog', () => {
        const instruction = buildSpecialOccasionSystemInstruction(
            new Date('2026-03-17T00:00:00+08:00')
        );

        expect(instruction).toContain(
            'Special occasions on this site follow the Asia/Taipei calendar.'
        );
        expect(instruction).toContain('Today in Asia/Taipei is March 17, 2026.');
        expect(instruction).toContain("The active special occasion today is Jacob's birthday.");
        expect(instruction).toContain("- Jacob's birthday: March 17.");
    });

    it('validates custom occasion catalogs from plain data', () => {
        expect(
            buildStaticSpecialOccasionCatalog({
                version: 'v-test',
                timeZone: 'UTC',
                occasions: [
                    {
                        id: 'demo-day',
                        title: 'Demo Day',
                        matcher: {
                            kind: 'month-day',
                            month: 4,
                            day: 1
                        },
                        description: 'A test occasion.',
                        promptChip: {
                            id: 'occasion-demo-day',
                            label: 'What Day Is Today?',
                            prompt: 'Is today demo day?'
                        }
                    }
                ]
            })
        ).toMatchObject({
            version: 'v-test',
            timeZone: 'UTC',
            occasions: [
                {
                    id: 'demo-day',
                    title: 'Demo Day'
                }
            ]
        });
    });
});
