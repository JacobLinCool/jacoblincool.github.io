import { captureClientError, initializeAnalytics } from '$lib/services/analytics/posthog';
import type { HandleClientError } from '@sveltejs/kit';

export function init() {
    const initialize = () => {
        void initializeAnalytics().catch(() => undefined);
    };
    // Let the page hydrate before parsing the analytics SDK. An interaction can initialize it earlier.
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(initialize, { timeout: 2000 });
    } else {
        setTimeout(initialize, 1000);
    }
}

export const handleError: HandleClientError = ({ error, status, message }) => {
    captureClientError(error);
    return { message, status };
};
