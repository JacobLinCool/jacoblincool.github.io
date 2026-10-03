type SendFn = (event: string, data: unknown) => void;
const encoder = new TextEncoder();

export const createSseResponse = (
    execute: (send: SendFn, signal: AbortSignal) => Promise<void>,
    options?: { headers?: HeadersInit; signal?: AbortSignal }
): Response => {
    const controller = new AbortController();
    const signal = options?.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal;
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let cancelled = false;

    const close = () => {
        clearInterval(heartbeat);
        signal.removeEventListener('abort', close);
        if (closed) return;
        closed = true;
        if (!cancelled) streamController.close();
    };
    const stream = new ReadableStream<Uint8Array>({
        start(output) {
            streamController = output;
            signal.addEventListener('abort', close, { once: true });
            if (signal.aborted) {
                close();
                return;
            }
            const send: SendFn = (event, data) => {
                if (closed) return;
                const payload = typeof data === 'string' ? data : JSON.stringify(data);
                output.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
            };
            heartbeat = setInterval(() => {
                if (!closed) output.enqueue(encoder.encode(': keepalive\n\n'));
            }, 15_000);
            void Promise.resolve()
                .then(() => {
                    signal.throwIfAborted();
                    return execute(send, signal);
                })
                .catch((error) => {
                    if (!signal.aborted)
                        send('error', {
                            type: 'error',
                            message:
                                error instanceof Error ? error.message : 'Unknown stream failure'
                        });
                })
                .finally(close);
        },
        cancel() {
            cancelled = true;
            controller.abort();
            close();
        }
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            ...(options?.headers ?? {})
        }
    });
};
