import { requireFirebaseUser } from '$lib/server/auth/verify-firebase-token';
import { streamChatTurn } from '$lib/server/chat/stream-chat';
import { resolveLocale } from '$lib/server/content/locale';
import { createSseResponse } from '$lib/server/chat/sse';
import { getAdminDb } from '$lib/server/firestore-admin';
import { getToolPolicy } from '$lib/server/repos/tool-policy-repository';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RequestBody = {
    message?: unknown;
    conversationId?: unknown;
    locale?: unknown;
};

export const POST: RequestHandler = async ({ request, fetch, platform, url }) => {
    const config = readRuntimeConfig((platform?.env ?? undefined) as Record<string, unknown> | undefined);

    let user;
    try {
        user = await requireFirebaseUser(request, config.firestoreProjectId);
    } catch (error) {
        return json(
            {
                error: error instanceof Error ? error.message : 'Unauthorized'
            },
            { status: 401 }
        );
    }

    let body: RequestBody;
    try {
        body = (await request.json()) as RequestBody;
    } catch {
        return json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
        return json({ error: 'message is required.' }, { status: 400 });
    }

    const localeCandidate = typeof body.locale === 'string' ? body.locale : null;
    const locale = localeCandidate
        ? localeCandidate
        : resolveLocale(url.pathname, request.headers.get('accept-language'));

    const requestedConversationId =
        typeof body.conversationId === 'string' && body.conversationId.trim()
            ? body.conversationId
            : null;

    const db = getAdminDb(config);
    const policy = await getToolPolicy(db);

    return createSseResponse(async (send) => {
        try {
            await streamChatTurn({
                db,
                fetchFn: fetch,
                config,
                policy,
                user: {
                    uid: user.uid,
                    isAnonymous: user.isAnonymous
                },
                locale,
                requestedConversationId,
                message,
                send
            });
        } catch (error) {
            send('error', {
                type: 'error',
                message: error instanceof Error ? error.message : 'Chat stream failed.'
            });
        }
    });
};
