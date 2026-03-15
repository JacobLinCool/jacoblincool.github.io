import { writeAdminAudit } from '$lib/server/admin/audit';
import { requireOwner } from '$lib/server/auth/require-owner';
import { getAdminDb } from '$lib/server/firestore-admin';
import { publishContentVersion } from '$lib/server/repos/content-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Body = {
    versionId?: unknown;
    locales?: unknown;
};

export const POST: RequestHandler = async ({ request, platform }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    try {
        const owner = await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const body = (await request.json()) as Body;

        if (typeof body.versionId !== 'string' || !body.versionId.trim()) {
            throw new Error('versionId is required.');
        }

        const locales = Array.isArray(body.locales)
            ? body.locales.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : ['en'];

        if (locales.length === 0) {
            throw new Error('locales must include at least one locale.');
        }

        const db = getAdminDb(config);
        await publishContentVersion(db, body.versionId, locales, owner.uid);

        await writeAdminAudit(db, owner.uid, 'admin.content.publish', body.versionId, {
            locales
        });

        return json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to publish content.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
