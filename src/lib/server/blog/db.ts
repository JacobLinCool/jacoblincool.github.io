import fs from "node:fs";
import { compile } from "mdsvex";
import readtime from "../readtime";
import type { Tag } from "blog/tags";

export const db: {
	post: Record<string, PostMetadata>;
	author: Record<string, AuthorMetadata>;
	tag: Record<string, TagMetadata>;
} = {
	post: {},
	author: {},
	tag: {},
};

export const file: Record<string, string> = {};

export const initialized = init();

export async function init() {
	console.time("blog db init");
	await checkout_tags();
	await checkout_author();
	await checkout_post();
	db.post = sort_object(
		db.post,
		(a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime(),
	);
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
	const authors = Object.entries(
		import.meta.glob<boolean, string, { metadata: AuthorMetadata }>("/blog/authors/**/*.md"),
	);

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
	const posts = Object.entries(
		import.meta.glob<boolean, string, { metadata: RawPostMetadata }>("blog/posts/**/*.md"),
	);

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

				if (!db.tag[tag]) {
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
				meta: {
					title: metadata.title || "Untitled",
					date: metadata.date || new Date().toISOString(),
					cover: metadata.cover || "/blog-cover.png",
					description: metadata.description || "",
					readtime: readtime(content?.code || "").humanizedDuration,
					tags: [...tags],
					author: metadata.author || db.author["default"].slug,
				},
				slug,
			};
		}),
	);
}

function slugify(str: string) {
	return str
		.toLowerCase()
		.replace(/[\\/\s]/g, "-")
		.replace(/^-+|-+$/g, "");
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
	meta: Required<RawPostMetadata>;
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
