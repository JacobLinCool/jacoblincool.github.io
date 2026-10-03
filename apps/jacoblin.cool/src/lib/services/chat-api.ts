import { ensureAuthToken } from '$lib/services/auth-session';
import type { ChatSseEvent } from '$lib/types/chat';

type StreamChatOptions = {
    turnId: string;
    message: string;
    locale: string;
    signal: AbortSignal;
    onEvent: (event: ChatSseEvent) => void;
};

/** Preparation never includes the draft or starts a model request. */
export const prepareChat = () => ensureAuthToken();

const waitForAuth = (signal: AbortSignal) => {
    signal.throwIfAborted();
    return new Promise<string>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        ensureAuthToken()
            .then(resolve, reject)
            .finally(() => {
                signal.removeEventListener('abort', onAbort);
            });
    });
};

const parseEvent = (block: string): ChatSseEvent | null => {
    const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
    if (!data) return null;

    let event: ChatSseEvent;
    try {
        event = JSON.parse(data) as ChatSseEvent;
    } catch {
        throw new Error('The response could not be read. Please try again.');
    }
    if (
        !event ||
        typeof event !== 'object' ||
        !['status', 'tool_call', 'tool_result', 'answer_delta', 'done', 'error'].includes(
            event.type
        ) ||
        (event.type === 'answer_delta' && typeof event.delta !== 'string') ||
        (event.type === 'error' && typeof event.message !== 'string')
    ) {
        throw new Error('The response could not be read. Please try again.');
    }
    return event;
};

export const streamChat = async ({
    turnId,
    message,
    locale,
    signal,
    onEvent
}: StreamChatOptions) => {
    const token = await waitForAuth(signal);
    signal.throwIfAborted();
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        signal,
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ turnId, message, locale })
    });

    if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Chat stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    const dispatch = (block: string) => {
        const event = parseEvent(block);
        if (!event) return;
        // Application errors must escape this loop, not be swallowed as JSON errors.
        if (event.type === 'error') throw new Error(event.message);
        onEvent(event);
        if (event.type === 'done') completed = true;
    };

    try {
        while (!completed) {
            signal.throwIfAborted();
            const { done, value } = await reader.read();
            signal.throwIfAborted();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            // Normalize only complete CRLF pairs, including pairs split between chunks.
            buffer = buffer.replaceAll('\r\n', '\n');
            let delimiter = buffer.indexOf('\n\n');
            while (delimiter !== -1 && !completed) {
                dispatch(buffer.slice(0, delimiter));
                buffer = buffer.slice(delimiter + 2);
                delimiter = buffer.indexOf('\n\n');
            }
            if (buffer.length > 1_000_000) {
                throw new Error('The response could not be read. Please try again.');
            }
            if (done) {
                if (!completed && buffer.trim()) dispatch(buffer);
                break;
            }
        }
        if (!completed) {
            throw new Error('The connection ended before the response finished. Please retry.');
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
};
