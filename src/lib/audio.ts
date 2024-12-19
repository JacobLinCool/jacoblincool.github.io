import { env } from '$env/dynamic/private';
import { Client } from '@gradio/client';
import { OpenAI } from 'openai';

export const openai = new OpenAI({
	baseURL: env.OPENAI_API_URL,
	apiKey: env.OPENAI_API_KEY
});

const client = await Client.connect(env.HUGGINFACE_VC_SPACE, {
	hf_token: env.HUGGINFACE_TOKEN as `hf_${string}`
});

export async function createAudio(text: string): Promise<string> {
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
