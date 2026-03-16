type SendFn = (event: string, data: unknown) => void;

const encoder = new TextEncoder();

const serialize = (event: string, data: unknown) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return `event: ${event}\ndata: ${payload}\n\n`;
};

const isClosedControllerError = (error: unknown) =>
    error instanceof TypeError && error.message.includes('Controller is already closed');

export const createSseResponse = (
    execute: (send: SendFn) => Promise<void>,
    options?: {
        headers?: HeadersInit;
    }
): Response => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    let cancelled = false;

    const abort = () => {
        cancelled = true;
    };

    const close = () => {
        if (closed || cancelled || !streamController) {
            return;
        }

        closed = true;

        try {
            streamController.close();
        } catch (error) {
            if (!isClosedControllerError(error)) {
                throw error;
            }
        }
    };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            streamController = controller;
            const send: SendFn = (event, data) => {
                if (closed || cancelled) {
                    return;
                }

                const activeController = streamController;
                if (!activeController) {
                    return;
                }

                const payload = encoder.encode(serialize(event, data));

                try {
                    activeController.enqueue(payload);
                } catch (error) {
                    if (!isClosedControllerError(error)) {
                        throw error;
                    }

                    abort();
                }
            };

            void execute(send)
                .catch((error) => {
                    send('error', {
                        type: 'error',
                        message: error instanceof Error ? error.message : 'Unknown stream failure'
                    });
                })
                .finally(() => {
                    close();
                });
        },
        cancel() {
            abort();
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
