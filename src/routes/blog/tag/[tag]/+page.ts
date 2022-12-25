import type { Load } from "@sveltejs/kit";

export const load: Load = async ({ fetch, params }) => {
	if (params.tag) {
		const response = await fetch(`/api/posts/tags/${params.tag}`);
		const posts = await response.json();

		return { posts };
	}
};
