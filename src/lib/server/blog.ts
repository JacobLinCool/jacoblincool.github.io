import fs from "node:fs";
import { compile } from "mdsvex";
import readtime from "./readtime";

let posts_cache: PostMetadata[] | null = null;
export async function list_posts(): Promise<PostMetadata[]> {
	if (posts_cache) {
		return posts_cache;
	}

	const files = Object.entries(
		import.meta.glob<boolean, string, { metadata: RawMetadata }>("/src/routes/blog/post/**/*.md"),
	);

	const posts = await Promise.all(
		files.map(async ([filepath, resolver]) => {
			const { metadata } = await resolver();
			const content = await compile(fs.readFileSync("." + filepath, "utf8"));

			return {
				meta: {
					title: metadata.title || "Untitled",
					date: metadata.date || new Date().toISOString(),
					cover: metadata.cover || "/blog-cover.png",
					description: metadata.description || "",
					readtime: readtime(content?.code || "").humanizedDuration,
					tags: metadata.tags || [],
				},
				slug: filepath.slice("/src/routes/blog/post/".length, -"/+page.md".length),
			};
		}),
	);

	posts_cache = posts;
	return posts;
}

interface RawMetadata {
	title?: string;
	date?: string;
	cover?: string;
	description?: string;
	readtime?: string;
	tags?: string[];
}

export interface PostMetadata {
	slug: string;
	meta: Required<RawMetadata>;
}
