import { createAudio } from '$lib/audio';
import { chat } from '$lib/chat';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { conversations } = await request.json();
	const answer = await chat(conversations);

	let audio: string | undefined = undefined;
	if (answer.text && answer.text.length < 500) {
		try {
			audio = await createAudio(answer.text);
		} catch (error) {
			console.error('Failed to create audio:', error);
		}
	}

	return json({ answer, audio });
};
