import { json } from "@sveltejs/kit";
import { list_posts } from "$lib/server/blog";
import type { PostMetadata } from "$lib/server/blog";

export const prerender = true;

const posts = await list_posts();
const rev = new Map<string, PostMetadata[]>();
for (const post of posts) {
	for (const tag of post.meta.tags) {
		const list = rev.get(tag) || [];
		list.push(post);
		rev.set(tag, list);
	}
}

export async function GET({ params }: { params: { tag: string } }) {
	const posts = rev.get(params.tag);
	if (!posts) {
		return json([]);
	}
	return json(posts);
}
