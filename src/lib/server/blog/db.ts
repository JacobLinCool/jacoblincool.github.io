import fs from "node:fs";
import { globby } from "globby";
import { compile } from "mdsvex";
import { slugify } from "$lib/server/blog/utils";
import { readtime } from "$lib/server/blog/readtime";
import type { Tag } from "blog/tags";

export const db: {
	post: Record<string, PostMetadata>;
	author: Record<string, AuthorMetadata>;
	tag: Record<string, TagMetadata>;
	initialized: Promise<void>;
} = {
	post: {},
	author: {},
	tag: {},
	initialized: Promise.resolve(),
};

export const file: Record<string, string> = {};

export const initialized = init();
db.initialized = initialized;

export async function init() {
	console.time("blog db init");
	await checkout_tags();
	await checkout_author();
	await checkout_post();
	db.post = sort_object(db.post, (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	console.timeEnd("blog db init");
}

async function checkout_tags() {
	const all = (await import("blog/tags")).default;

	function walk(tag: Tag, inherits: string[] = []) {
		const slug = tag.slug || slugify(tag.name);
		if (db.tag[slug]) {
			return;
		}

		db.tag[slug] = {
			name: tag.name,
			inherits,
			slug,
		};

		if (tag.sub) {
			for (const sub of Object.values(tag.sub)) {
				walk(
					sub,
					tag.inheritable === false ? [...inherits] : [tag.slug || slugify(tag.name), ...inherits],
				);
			}
		}
	}

	walk(all);
}

async function checkout_author() {
	const authors = (await globby("blog/authors/**/*.md")).map<
		[string, () => Promise<{ metadata: AuthorMetadata }>]
	>((filepath) => [
		"/" + filepath,
		async () => {
			const file = fs.readFileSync(filepath, "utf8");
			const compiled = await compile(file);
			if (typeof compiled?.data?.fm !== "object") {
				throw new Error("Invalid post metadata");
			}
			return { metadata: compiled.data.fm } as { metadata: AuthorMetadata };
		},
	]);

	await Promise.all(
		authors.map(async ([filepath, resolver]) => {
			const { metadata } = await resolver();
			const slug = slugify(filepath.slice("/blog/authors/".length, -".md".length));

			db.author[slug] = {
				name: metadata.name,
				slug,
			};

			if (metadata.owner) {
				db.author.default = db.author[slug];
			}
		}),
	);

	if (!db.author.default) {
		db.author.default = {
			name: "Unknown",
			slug: "default",
		};
	}
}

async function checkout_post() {
	const posts = (await globby("blog/posts/**/*.md")).map<
		[string, () => Promise<{ metadata: RawPostMetadata }>]
	>((filepath) => [
		"/" + filepath,
		async () => {
			const file = fs.readFileSync(filepath, "utf8");
			const compiled = await compile(file);
			if (typeof compiled?.data?.fm !== "object") {
				throw new Error("Invalid post metadata");
			}
			return { metadata: compiled.data.fm } as { metadata: RawPostMetadata };
		},
	]);

	await Promise.all(
		posts.map(async ([filepath, resolver]) => {
			const { metadata } = await resolver();
			const content = await compile(fs.readFileSync("." + filepath, "utf8"));

			const slug = slugify(filepath.slice("blog/posts/".length, -".md".length));
			file[slug] = filepath;

			const raw_tags = metadata.tags || [];
			const tag_length = raw_tags.length;
			const tags = new Set<string>();
			for (let i = 0; i < tag_length; i++) {
				const tag = raw_tags[i];
				const slug = slugify(tag);

				if (!db.tag[slug]) {
					db.tag[slug] = {
						name: tag,
						inherits: [],
						slug,
					};
				}

				tags.add(slug);
				for (const inherit of db.tag[slug].inherits) {
					if (!tags.has(inherit)) {
						tags.add(inherit);
					}
				}
			}

			db.post[slug] = {
				title: metadata.title || "Untitled",
				date: metadata.date || new Date().toISOString(),
				cover: metadata.cover || "/blog-cover.png",
				description: metadata.description || "",
				readtime: readtime(content?.code || "").humanizedDuration,
				tags: [...tags].map((tag) => db.tag[tag]),
				author: db.author[metadata.author || "default"] || db.author.default,
				slug,
			};
		}),
	);
}

function sort_object<T>(
	obj: Record<string, T>,
	compare: (a: T, b: T) => number = (a, b) => (a > b ? -1 : 1),
) {
	return Object.entries(obj)
		.sort((a, b) => compare(a[1], b[1]))
		.reduce((acc, [key, value]) => {
			acc[key] = value;
			return acc;
		}, {} as Record<string, T>);
}

export interface AuthorMetadata {
	slug: string;
	name: string;
	owner?: boolean;
}

export interface TagMetadata {
	slug: string;
	name: string;
	inherits: string[];
}

export interface RawPostMetadata {
	title?: string;
	date?: string;
	cover?: string;
	description?: string;
	readtime?: string;
	tags?: string[];
	author?: string;
}

export interface PostMetadata {
	slug: string;
	title: string;
	date: string;
	cover: string;
	description: string;
	readtime: string;
	tags: {
		name: string;
		slug: string;
	}[];
	author: {
		name: string;
		slug: string;
	};
}
