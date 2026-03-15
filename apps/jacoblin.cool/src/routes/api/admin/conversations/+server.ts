import { requireOwner } from '$lib/server/auth/require-owner';
import { getAdminDb } from '$lib/server/firestore-admin';
import { listConversations } from '$lib/server/repos/conversation-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    try {
        await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const db = getAdminDb(config);
        const conversations = await listConversations(db, 100);
        return json({ conversations });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load conversations.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
