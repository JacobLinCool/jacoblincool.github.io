import { requireOwner } from '$lib/server/auth/require-owner';
import { getAdminDb } from '$lib/server/firestore-admin';
import { listDynamicSnapshots } from '$lib/server/repos/dynamic-snapshot-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    try {
        await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const db = getAdminDb(config);
        const snapshots = await listDynamicSnapshots(db, 200);
        return json({ snapshots });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dynamic snapshots.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
