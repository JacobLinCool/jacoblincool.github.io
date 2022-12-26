import type { Load } from "@sveltejs/kit";

export const prerender = true;

export const load: Load = async ({ fetch }) => {
	return {
		tags: await fetch("/api/blog/tags/_index").then((r) => r.json()),
	};
};
