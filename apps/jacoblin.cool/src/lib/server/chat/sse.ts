type SendFn = (event: string, data: unknown) => void;

const encoder = new TextEncoder();

const serialize = (event: string, data: unknown) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return `event: ${event}\ndata: ${payload}\n\n`;
};

export const createSseResponse = (
    execute: (send: SendFn) => Promise<void>
): Response => {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send: SendFn = (event, data) => {
                controller.enqueue(encoder.encode(serialize(event, data)));
            };

            void execute(send)
                .catch((error) => {
                    send('error', {
                        type: 'error',
                        message: error instanceof Error ? error.message : 'Unknown stream failure'
                    });
                })
                .finally(() => {
                    controller.close();
                });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive'
        }
    });
};
