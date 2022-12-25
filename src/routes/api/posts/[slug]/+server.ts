import { json } from "@sveltejs/kit";
import { list_posts } from "$lib/server/blog";

export const prerender = true;

const posts = await list_posts();
const rev = new Map(posts.map((post) => [post.slug, post]));

export async function GET({ params }: { params: { slug: string } }) {
	const post = rev.get(params.slug);
	if (!post) {
		return json({ error: "Not found" }, { status: 404 });
	}
	return json(post);
}
