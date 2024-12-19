import type {
	ChatCompletionMessage,
	ChatCompletionToolMessageParam
} from 'openai/resources/index.mjs';

export interface ChatResponse {
	text: string;
	image?: string;
	audio?: string;
}

export type ChatEventHandlers = {
	content?: (text: string) => void;
	tool?: (tool: string) => void;
	image?: (imageUrl: string) => void;
	audio?: (audioUrl: string) => void;
	done?: () => void;
	error?: (error: string) => void;
};

export const TOOLS = {
	fetchExtraInformation: 'get some extra information',
	drawPicture: 'draw a picture'
};

export async function askQuestion(
	conversations: (
		| { role: 'assistant' | 'user'; text: string }
		| ChatCompletionMessage
		| ChatCompletionToolMessageParam
	)[],
	handlers: ChatEventHandlers = {}
): Promise<ChatResponse> {
	const response = await fetch('/api/ask', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ conversations })
	});

	if (!response.ok) {
		throw new Error('Failed to send message');
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let result: ChatResponse = { text: '' };

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			const events = chunk.split('\n\n').filter(Boolean);

			for (const event of events) {
				const lines = event.split('\n');
				const type = lines[0].slice('event: '.length);
				const data = JSON.parse(lines[1].slice('data: '.length));

				switch (type) {
					case 'content': {
						result.text += data;
						handlers.content?.(data);
						break;
					}
					case 'tool': {
						const func = JSON.parse(data);
						const name = func.name as keyof typeof TOOLS;
						if (TOOLS[name]) {
							handlers.tool?.(`I am using a tool to ${TOOLS[name]}`);
						} else {
							handlers.tool?.(`I am using ${name}`);
						}
						break;
					}
					case 'image': {
						result.image = data;
						handlers.image?.(data);
						break;
					}
					case 'audio': {
						result.audio = data;
						handlers.audio?.(data);
						break;
					}
					case 'done': {
						handlers.done?.();
						break;
					}
					case 'error': {
						handlers.error?.(data);
						throw new Error(data);
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return result;
}
