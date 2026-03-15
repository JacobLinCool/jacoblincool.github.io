import { writeAdminAudit } from '$lib/server/admin/audit';
import { resolveDynamicTarget, type DynamicTarget } from '$lib/server/content/dynamic-sync';
import { requireOwner } from '$lib/server/auth/require-owner';
import { getAdminDb } from '$lib/server/firestore-admin';
import { getToolPolicy } from '$lib/server/repos/tool-policy-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RequestBody = {
    entityKey?: unknown;
    kind?: unknown;
};

const resolveTarget = (
    source: string,
    body: RequestBody,
    config: ReturnType<typeof readRuntimeConfig>
): DynamicTarget => {
    const kind = typeof body.kind === 'string' ? body.kind : null;
    const entityKey = typeof body.entityKey === 'string' ? body.entityKey.trim() : null;

    if (source === 'github') {
        if (kind === 'github_repo_detail') {
            if (!entityKey) {
                throw new Error('entityKey is required for github_repo_detail');
            }
            return {
                kind: 'github_repo_detail',
                source: 'github',
                entityKey
            };
        }

        return {
            kind: 'github_user_summary',
            source: 'github',
            entityKey: entityKey || `user:${config.githubUser.toLowerCase()}`
        };
    }

    if (source === 'huggingface') {
        if (kind === 'huggingface_model_detail') {
            if (!entityKey) {
                throw new Error('entityKey is required for huggingface_model_detail');
            }
            return {
                kind: 'huggingface_model_detail',
                source: 'huggingface',
                entityKey
            };
        }

        if (kind === 'huggingface_space_detail') {
            if (!entityKey) {
                throw new Error('entityKey is required for huggingface_space_detail');
            }
            return {
                kind: 'huggingface_space_detail',
                source: 'huggingface',
                entityKey
            };
        }

        return {
            kind: 'huggingface_user_summary',
            source: 'huggingface',
            entityKey: entityKey || `user:${config.huggingfaceUser.toLowerCase()}`
        };
    }

    throw new Error(`Unsupported source: ${source}`);
};

export const POST: RequestHandler = async ({ request, params, fetch, platform }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    try {
        const owner = await requireOwner(request, config.firestoreProjectId, config.ownerUid);
        const body = (await request.json().catch(() => ({}))) as RequestBody;
        const db = getAdminDb(config);
        const policy = await getToolPolicy(db);
        const target = resolveTarget(params.source, body, config);

        const snapshot = await resolveDynamicTarget({
            db,
            fetchFn: fetch,
            config,
            policy,
            target,
            forceRefresh: true
        });

        await writeAdminAudit(db, owner.uid, 'admin.sync.force_refresh', `${target.source}:${target.entityKey}`, {
            kind: target.kind,
            revision: snapshot.revision
        });

        return json({
            ok: true,
            target,
            snapshot
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Admin sync failed.';
        const status = message.startsWith('Forbidden') ? 403 : 400;
        return json({ error: message }, { status });
    }
};
