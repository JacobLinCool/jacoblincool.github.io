import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/kit/vite";
import { mdsvex } from "mdsvex";
import remark_gfm from "remark-gfm";
import remark_github from "remark-github";
import add_classes from "rehype-add-classes";
import external_links from "rehype-external-links";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: [".md"],
			remarkPlugins: [
				remark_gfm,
				[remark_github, { repository: "jacoblincool/jacoblincool.github.io" }],
			],
			rehypePlugins: [
				[add_classes, { "*": "markdown" }],
				[external_links, { target: "_blank", rel: ["noopener", "noreferrer"] }],
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
