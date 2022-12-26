import type { Load } from "@sveltejs/kit";
import { file } from "$lib/blog";

export const prerender = true;

export const load: Load = async ({ fetch, params }) => {
	if (params.slug) {
		const res = await fetch(`/api/blog/posts/file/${params.slug}`).then((r) => r.json());
		fetch(`/api/blog/posts/${params.slug}`);
		const post = await file[res.filepath]();
		const content = post.default;
		return { content };
	}
};
