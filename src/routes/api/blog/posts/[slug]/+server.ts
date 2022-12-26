import { json } from "@sveltejs/kit";
import { db } from "$lib/server/blog/db";

export const prerender = true;

export async function GET({ params }: { params: { slug: string } }) {
	const post = db.post[params.slug];
	if (!post) {
		console.log(params, db.post);
		return json({ error: "Not found" }, { status: 404 });
	}
	return json(post);
}
