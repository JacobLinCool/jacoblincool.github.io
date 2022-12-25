import type { Load } from "@sveltejs/kit";

export const load: Load = async ({ fetch }) => {
	const response = await fetch("/api/posts/tags/all");
	const tags = await response.json();

	return { tags };
};
