import { env } from '$env/dynamic/private';
import { Client } from '@gradio/client';
import { OpenAI } from 'openai';

export const openai = new OpenAI({
	baseURL: env.OPENAI_API_URL,
	apiKey: env.OPENAI_API_KEY
});

// patch "The 'credentials' field on 'RequestInitializerDict' is not implemented."
// on Cloudflare Workers.
globalThis.fetch = ((f) => {
	type P = Parameters<typeof f>;
	return (input: P[0], init?: P[1]) => {
		if (init?.credentials) {
			delete init.credentials;
		}
		return f(input, init);
	};
})(globalThis.fetch);
globalThis.Request = ((OriginalRequest) => {
	type P = ConstructorParameters<typeof OriginalRequest>;
	return class Request extends OriginalRequest {
		constructor(input: P[0], init?: P[1]) {
			if (init?.credentials) {
				delete init.credentials;
			}
			super(input, init);
		}
	};
})(globalThis.Request);

const client = await Client.connect(env.HUGGINFACE_VC_SPACE, {
	hf_token: env.HUGGINFACE_TOKEN as `hf_${string}`
});

function cleanMarkdown(text: string) {
	// Remove markdown links.
	text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	// Remove markdown images.
	text = text.replace(/!\[[^\]]+\]\([^)]+\)/g, '');

	return text;
}

export async function createAudio(text: string): Promise<string> {
	text = cleanMarkdown(text);
	if (text.length > 1500) {
		throw new Error(`Text is too long: ${text.length} characters`);
	}

	const res = await openai.audio.speech.create({
		model: 'tts-1',
		voice: 'echo',
		input: text,
		response_format: 'mp3'
	});
	if (!res.ok) {
		throw new Error(`Failed to generate audio: ${res.status}`);
	}

	const blob = await res.blob();
	const audio = new Blob([await blob.arrayBuffer()], { type: 'audio/mpeg' });

	const result = await client.predict('/rvc', {
		audio
	});
	console.dir(result, { depth: null });

	// @ts-expect-error
	return result.data[0].url;
}
