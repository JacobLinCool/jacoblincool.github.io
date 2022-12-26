import type { Load } from "@sveltejs/kit";

export const prerender = true;

export const load: Load = async ({ fetch }) => {
	return {
		posts: await fetch("/api/blog/posts/_index").then((r) => r.json()),
	};
};
