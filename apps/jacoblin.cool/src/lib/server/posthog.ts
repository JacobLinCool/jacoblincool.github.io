import { dev } from '$app/environment';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
    if (dev || !PUBLIC_POSTHOG_PROJECT_TOKEN) return null;
    if (!posthogClient) {
        posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
            host: PUBLIC_POSTHOG_HOST,
            flushAt: 1,
            flushInterval: 0
        });
    }
    return posthogClient;
}
