import { resolveResponseLengthBand, resolveTurnLatencyBand } from '$lib/services/analytics/posthog';
import { describe, expect, it } from 'vitest';

describe('posthog analytics helpers', () => {
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
});
