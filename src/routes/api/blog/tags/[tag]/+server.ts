import { json } from "@sveltejs/kit";
import { db, initialized } from "$lib/server/blog/db";

export const prerender = true;

export async function GET({ params }: { params: { tag: string } }) {
	await initialized;
	const tag = db.tag[params.tag];
	if (!tag) {
		return json({ error: "Not found" }, { status: 404 });
	}

	return json({
		tag,
		posts: Object.values(db.post).filter((post) => post.tags.map((t) => t.slug).includes(tag.slug)),
	});
}
