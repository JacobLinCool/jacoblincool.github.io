import { json } from "@sveltejs/kit";
import { list_posts } from "$lib/server/blog";

export const prerender = true;

export async function GET() {
	const posts = await list_posts();
	return json(posts.map((post) => post.meta.tags).flat());
}
