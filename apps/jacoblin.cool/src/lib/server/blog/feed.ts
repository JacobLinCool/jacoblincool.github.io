import { siteConfig } from '$lib/config/site';
import { blogDescription } from '$lib/content/blog';
import { escapeHtml } from './markdown';
import type { PostSummary } from './posts';

export function renderFeed(posts: PostSummary[]) {
    const origin = siteConfig.origin;
    const entries = posts
        .filter((post) => !post.draft)
        .map((post) => {
            const url = `${origin}/blog/${post.slug}`;
            return `<item><title>${escapeHtml(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeHtml(post.description)}</description><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>${post.tags.map((tag) => `<category>${escapeHtml(tag)}</category>`).join('')}</item>`;
        })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Jacob Lin — Blog</title><link>${origin}/blog</link><description>${escapeHtml(blogDescription)}</description><atom:link href="${origin}/blog/rss.xml" rel="self" type="application/rss+xml"/>${entries}</channel></rss>`;
}
