import { resolveSpecialOccasion, SITE_OCCASION_TIME_ZONE } from '$lib/utils/special-occasion';
import { describe, expect, it } from 'vitest';

describe('resolveSpecialOccasion', () => {
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
});
