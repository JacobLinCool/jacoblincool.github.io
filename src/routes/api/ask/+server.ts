import { chat } from '$lib/chat';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { conversations } = await request.json();
	const answer = await chat(conversations);
	return json({ answer });
};
