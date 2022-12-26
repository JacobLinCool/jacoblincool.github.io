import type { Load } from "@sveltejs/kit";
import { db } from "$lib/server/blog/db";

export const load: Load = async ({ params }) => {
	if (params.slug) {
		return {
			post: db.post[params.slug],
			tags: db.post[params.slug].meta.tags.map((tag) => db.tag[tag]),
			author: db.author[db.post[params.slug].meta.author],
		};
	}
};
