import type { Load } from "@sveltejs/kit";

export const load: Load = async ({ fetch, params }) => {
	if (params.slug) {
		const data = await fetch(`/api/blog/posts/${params.slug}`).then((r) => r.json());
		return data;
	}
};
