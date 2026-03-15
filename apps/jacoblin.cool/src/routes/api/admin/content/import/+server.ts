import { writeAdminAudit } from '$lib/server/admin/audit';
import { requireOwner } from '$lib/server/auth/require-owner';
import { getAdminDb } from '$lib/server/firestore-admin';
import { importContentBundle } from '$lib/server/repos/content-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import type { CanonicalContentBundle } from '$lib/types/home';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Body = {
    versionId?: unknown;
    locales?: unknown;
    publishLocales?: unknown;
};

export const POST: RequestHandler = async ({ request, platform }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    try {
        const owner = await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const body = (await request.json()) as Body;

        if (typeof body.versionId !== 'string' || !body.versionId.trim()) {
            throw new Error('versionId is required.');
        }

        if (!Array.isArray(body.locales) || body.locales.length === 0) {
            throw new Error('locales must be a non-empty array.');
        }

        const localeBundles = body.locales as CanonicalContentBundle[];
        const publishLocales = Array.isArray(body.publishLocales)
            ? body.publishLocales.filter((value): value is string => typeof value === 'string')
            : ['en'];

        const db = getAdminDb(config);
        await importContentBundle(db, {
            versionId: body.versionId,
            locales: localeBundles,
            publishLocales,
            actorUid: owner.uid
        });

        await writeAdminAudit(db, owner.uid, 'admin.content.import', body.versionId, {
            locales: localeBundles.map((entry) => entry.locale),
            publishLocales
        });

        return json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to import content bundle.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
