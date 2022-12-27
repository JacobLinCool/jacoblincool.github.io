import type { Load } from "@sveltejs/kit";
import { db, initialized } from "$lib/server/blog/db";

export const load: Load = async ({ params }) => {
	if (params.slug) {
		await initialized;
		return db.post[params.slug];
	}
};
