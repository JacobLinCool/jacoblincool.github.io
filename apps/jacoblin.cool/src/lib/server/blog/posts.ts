import { parse } from 'yaml';
import { z } from 'zod';
import { renderBlogMarkdown } from './markdown';

const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((date) => {
        const parsed = new Date(`${date}T00:00:00Z`);
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
    }, 'Use a real calendar date in YYYY-MM-DD format.');

const metadataSchema = z
    .strictObject({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        date: dateSchema,
        updated: dateSchema.optional(),
        draft: z.boolean(),
        lang: z.enum(['en', 'zh-TW']),
        tags: z.array(z.string().trim().min(1)).default([])
    })
    .refine((data) => !data.updated || data.updated >= data.date, {
        message: 'updated cannot precede date.',
        path: ['updated']
    });

export type PostSummary = z.infer<typeof metadataSchema> & { slug: string; readingMinutes: number };
export type Post = PostSummary & ReturnType<typeof renderBlogMarkdown>;

export function parsePost(source: string, slug: string): Post {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(
            `Invalid blog filename: ${slug}. Use lowercase words separated by hyphens.`
        );
    }
    const frontmatter = source
        .replace(/^\uFEFF/, '')
        .match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!frontmatter) throw new Error(`${slug}: Missing YAML front matter.`);
    try {
        const metadata = metadataSchema.parse(parse(frontmatter[1]));
        const body = frontmatter[2].trim();
        if (!body) throw new Error('Article body is empty.');
        const cjk =
            body.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
        const words =
            body
                .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, ' ')
                .match(/\S+/g)?.length ?? 0;
        return {
            ...metadata,
            slug,
            tags: [...new Set(metadata.tags)],
            readingMinutes: Math.max(1, Math.ceil(words / 220 + cjk / 400)),
            ...renderBlogMarkdown(body)
        };
    } catch (error) {
        throw new Error(`${slug}: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error
        });
    }
}

export function selectPosts(posts: Post[], includeDrafts = false): Post[] {
    return posts
        .filter((post) => includeDrafts || !post.draft)
        .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// Raw imports are bundled server-side; no runtime filesystem or database is needed.
const sources = import.meta.glob(['/content/blog/*.md', '!/content/blog/*.shadow.md'], {
    eager: true,
    query: '?raw',
    import: 'default'
});
const posts = Object.entries(sources).map(([path, source]) =>
    parsePost(source as string, path.split('/').at(-1)!.slice(0, -3))
);

export const getPosts = (includeDrafts = false): PostSummary[] =>
    selectPosts(posts, includeDrafts).map((post) => ({
        slug: post.slug,
        title: post.title,
        description: post.description,
        date: post.date,
        updated: post.updated,
        draft: post.draft,
        lang: post.lang,
        tags: post.tags,
        readingMinutes: post.readingMinutes
    }));

export const getPost = (slug: string, includeDrafts = false): Post | undefined =>
    selectPosts(posts, includeDrafts).find((post) => post.slug === slug);
