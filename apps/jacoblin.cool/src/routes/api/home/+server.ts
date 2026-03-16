import { getHomeApiPayload } from '$lib/server/content/home-service';
import { getAdminDb } from '$lib/server/firestore-admin';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, platform }) => {
    const config = readRuntimeConfig(
        (platform?.env ?? undefined) as Record<string, unknown> | undefined
    );
    const db = getAdminDb(config);
    const payload = await getHomeApiPayload(db, fetch, config);

    return json(payload);
};
