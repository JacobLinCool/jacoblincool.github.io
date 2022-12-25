import type { Load } from "@sveltejs/kit";

export const load: Load = async ({ fetch, route }) => {
	if (route.id) {
		const response = await fetch(route.id.replace(/^\/blog\/post/, "/api/posts"));
		const post = await response.json();

		return post;
	}
};
