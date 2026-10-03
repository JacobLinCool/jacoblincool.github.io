import { requireFirebaseUser } from '$lib/server/auth/verify-firebase-token';
import { createSseResponse } from '$lib/server/chat/sse';
import { streamChatTurn } from '$lib/server/chat/stream-chat';
import { resolveLocale } from '$lib/server/content/locale';
import { getAdminDb } from '$lib/server/firestore-admin';
import { getPostHogClient } from '$lib/server/posthog';
import { readRuntimeConfig } from '$lib/server/runtime-env';
import { createChatErrorLogPayload, logChatError } from '$lib/server/telemetry/chat-logger';
import { EXTERNAL_TOOL_CONFIG } from '$lib/server/tools/external-tool-config';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RequestBody = {
    message?: unknown;
    turnId?: unknown;
    locale?: unknown;
};

const createRequestId = (request: Request) =>
    request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID();

export const POST: RequestHandler = async ({ request, fetch, platform, url }) => {
    const config = readRuntimeConfig(
        (platform?.env ?? undefined) as Record<string, unknown> | undefined
    );

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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ error: 'Expected a JSON object.' }, { status: 400 });
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
        return json({ error: 'message is required.' }, { status: 400 });
    }

    if (message.length > 8_000) {
        return json({ error: 'Message is too long (maximum 8,000 characters).' }, { status: 400 });
    }
    const turnId = typeof body.turnId === 'string' ? body.turnId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(turnId)) {
        return json({ error: 'A valid turnId is required.' }, { status: 400 });
    }
    const localeCandidate = typeof body.locale === 'string' ? body.locale : null;
    const locale = localeCandidate
        ? localeCandidate
        : resolveLocale(url.pathname, request.headers.get('accept-language'));

    const db = getAdminDb(config);
    const requestId = createRequestId(request);

    const posthog = getPostHogClient();
    posthog?.capture({
        distinctId: user.uid,
        event: 'chat_turn_submitted',
        properties: {
            is_anonymous: user.isAnonymous,
            locale,
            request_id: requestId
        }
    });

    return createSseResponse(
        async (send, signal) => {
            try {
                await streamChatTurn({
                    db,
                    fetchFn: fetch,
                    config,
                    externalToolConfig: EXTERNAL_TOOL_CONFIG,
                    requestId,
                    turnId,
                    signal,
                    user: {
                        uid: user.uid,
                        isAnonymous: user.isAnonymous
                    },
                    locale,
                    message,
                    send
                });
            } catch (error) {
                if (signal.aborted) return;
                logChatError(
                    'chat_stream_failed',
                    createChatErrorLogPayload(error, { requestId, turnId })
                );
                send('error', {
                    type: 'error',
                    message: 'The response could not be completed. Please retry.'
                });
            }
        },
        {
            signal: request.signal,
            headers: {
                'x-request-id': requestId
            }
        }
    );
};
