import { json } from "@sveltejs/kit";
import { db } from "$lib/server/blog/db";

export const prerender = true;

export async function GET({ params }: { params: { tag: string } }) {
	const tag = db.tag[params.tag];
	if (!tag) {
		return json({ error: "Not found" }, { status: 404 });
	}

	return json(Object.values(db.post).filter((post) => post.meta.tags.includes(tag.slug)));
}
