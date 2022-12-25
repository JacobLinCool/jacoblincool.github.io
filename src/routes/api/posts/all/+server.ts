import { json } from "@sveltejs/kit";
import { list_posts } from "$lib/server/blog";
import type { PostMetadata } from "$lib/server/blog";

export const prerender = true;

export async function GET() {
	const posts = await list_posts();

	const sorted: PostMetadata[] = posts.sort((a, b) => {
		const a_date = new Date(a.meta.date);
		const b_date = new Date(b.meta.date);

		return b_date.getTime() - a_date.getTime();
	});

	return json(sorted);
}
