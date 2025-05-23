import { getSpace } from '$lib/server/api';
import { createAudio } from '$lib/server/audio';
import { chatStream } from '$lib/server/chat';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const { conversations } = await request.json();

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (event: string, data: any) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			const _space = getSpace();

			let fullText = '';
			try {
				for await (const { type, data } of chatStream(conversations)) {
					if (type === 'content') {
						fullText += data;
						send('content', data);
					} else if (type === 'tool') {
						send('tool', data);
					} else if (type === 'image') {
						send('image', data);
					} else if (type === 'done') {
						try {
							const remoteURL = await createAudio(fullText);
							const space = await _space;
							const host = space.config?.root;
							if (!host) {
								throw new Error('Space host not found');
							}
							const audio = remoteURL.replace(
								`${host}${space.api_prefix || ''}/file=/`,
								`${url.origin}/api/audio/`
							);
							send('audio', audio);
							await new Promise<void>((resolve) => setTimeout(resolve, 500));
						} catch (error) {
							console.error('Failed to create audio:', error);
						}
						send('done', null);
					}
				}
			} catch (error) {
				send('error', String(error));
			}
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
