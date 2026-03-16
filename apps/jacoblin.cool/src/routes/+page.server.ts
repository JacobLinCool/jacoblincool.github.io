import { getHomeApiPayload } from '$lib/server/content/home-service';
import { getAdminDb } from '$lib/server/firestore-admin';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, platform }) => {
    const config = readRuntimeConfig(
        (platform?.env ?? undefined) as Record<string, unknown> | undefined
    );
    const db = getAdminDb(config);
    const home = await getHomeApiPayload(db, fetch, config);

    return {
        home
    };
};
