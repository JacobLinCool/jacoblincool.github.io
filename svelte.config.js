import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/kit/vite";
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: [".md"],
		}),
	],

	kit: {
		adapter: adapter(),
		alias: {
			blog: "./blog",
		},
	},

	extensions: [".svelte", ".md"],
};

export default config;
