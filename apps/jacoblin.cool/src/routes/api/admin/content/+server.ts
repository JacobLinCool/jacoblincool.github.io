import { requireOwner } from '$lib/server/auth/require-owner';
import { getStaticPublishedContent } from '$lib/server/content/static-content';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const config = readRuntimeConfig(
        (platform?.env ?? undefined) as Record<string, unknown> | undefined
    );
    const locale = url.searchParams.get('locale') ?? 'en';

    try {
        await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const content = getStaticPublishedContent(locale);
        return json(content);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load content.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
