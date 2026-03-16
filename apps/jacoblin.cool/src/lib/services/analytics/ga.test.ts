import {
    normalizePageLocation,
    resolveResponseLengthBand,
    resolveTurnLatencyBand
} from '$lib/services/analytics/ga';
import { describe, expect, it } from 'vitest';

describe('ga analytics helpers', () => {
    it('maps latency into stable reporting bands', () => {
        expect(resolveTurnLatencyBand(1200)).toBe('lt3s');
        expect(resolveTurnLatencyBand(4500)).toBe('3to8s');
        expect(resolveTurnLatencyBand(9200)).toBe('gt8s');
    });

    it('maps response length into stable reporting bands', () => {
        expect(resolveResponseLengthBand(120)).toBe('short');
        expect(resolveResponseLengthBand(420)).toBe('medium');
        expect(resolveResponseLengthBand(1600)).toBe('long');
    });

    it('normalizes page views into GA page_location and page_path values', () => {
        expect(normalizePageLocation('https://jacoblin.cool/?q=agent#hero')).toEqual({
            pageLocation: 'https://jacoblin.cool/?q=agent',
            pagePath: '/?q=agent'
        });
    });
});
