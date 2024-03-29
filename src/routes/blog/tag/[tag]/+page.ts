import type { Load } from "@sveltejs/kit";

export const prerender = true;

export const load: Load = async ({ fetch, params }) => {
	if (params.tag) {
		const response = await fetch(`/api/blog/tags/${params.tag}`);
		const data = await response.json();

		return data;
	}
};
