import { auth } from '$lib/firebase/client';
import type { ChatSseEvent } from '$lib/types/chat';
import { signInAnonymously } from 'firebase/auth';

type StreamChatOptions = {
    message: string;
    locale: string;
    onEvent: (event: ChatSseEvent) => void;
};

const ensureAuthToken = async () => {
    if (!auth.currentUser) {
        await signInAnonymously(auth);
    }

    const user = auth.currentUser;
    if (!user) {
        throw new Error('Unable to initialize Firebase user.');
    }

    return user.getIdToken();
};

const parseSse = (chunk: string): Array<{ event: string; data: string }> => {
    const blocks = chunk.split('\n\n').filter(Boolean);
    const parsed: Array<{ event: string; data: string }> = [];

    for (const block of blocks) {
        const lines = block.split('\n');
        let event = 'message';
        const dataLines: string[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(':')) {
                continue;
            }

            if (line.startsWith('event:')) {
                event = line.slice(6).trim();
                continue;
            }

            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        }

        if (dataLines.length > 0) {
            parsed.push({
                event,
                data: dataLines.join('\n')
            });
        }
    }

    return parsed;
};

export const streamChat = async ({ message, locale, onEvent }: StreamChatOptions) => {
    const token = await ensureAuthToken();

    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            message,
            locale
        })
    });

    if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Chat stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lastDelimiter = buffer.lastIndexOf('\n\n');
        if (lastDelimiter === -1) {
            continue;
        }

        const chunk = buffer.slice(0, lastDelimiter + 2);
        buffer = buffer.slice(lastDelimiter + 2);

        const events = parseSse(chunk);
        for (const event of events) {
            try {
                const parsed = JSON.parse(event.data) as ChatSseEvent;
                onEvent(parsed);
            } catch {
                continue;
            }
        }
    }

    if (buffer.trim()) {
        const trailingEvents = parseSse(`${buffer}\n\n`);
        for (const event of trailingEvents) {
            try {
                const parsed = JSON.parse(event.data) as ChatSseEvent;
                onEvent(parsed);
            } catch {
                continue;
            }
        }
    }
};
