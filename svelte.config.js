import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/kit/vite";
import { mdsvex } from "mdsvex";
import add_classes from "rehype-add-classes";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: [".md"],
			rehypePlugins: [
				[
					add_classes,
					{
						"*": "markdown",
					},
				],
			],
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
