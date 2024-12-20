import { openai, space } from '$lib/server/api';

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

	const result = await space.predict('/rvc', {
		audio
	});
	console.dir(result, { depth: null });

	// @ts-expect-error
	return result.data[0].url;
}
