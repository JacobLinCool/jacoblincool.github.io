import { describe, expect, it } from 'vitest';
import { renderFeed } from './feed';
import { renderBlogMarkdown } from './markdown';
import { getPost, getPosts, parsePost, selectPosts } from './posts';

const article = (metadata = '', body = 'Some article text.') => `---
title: "An article"
description: "A description"
date: "2026-09-29"
draft: false
lang: en
${metadata}---

${body}`;

describe('Markdown publishing', () => {
    it('parses quoted titles, tags, CRLF and Chinese content', () => {
        const post = parsePost(
            article('tags: [研究, software, 研究]\n', '中文內容。'.repeat(100)).replaceAll(
                '\n',
                '\r\n'
            ),
            'my-post'
        );
        expect(post.tags).toEqual(['研究', 'software']);
        expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
        expect(post.html).toContain('中文內容');
    });

    it.each([
        ['invalid calendar date', article().replace('2026-09-29', '2026-02-30')],
        ['missing draft flag', article().replace('draft: false\n', '')],
        ['string draft flag', article().replace('draft: false', 'draft: "false"')],
        ['unknown metadata', article('drfat: true\n')],
        ['updated before publication', article('updated: "2026-09-28"\n')],
        ['empty body', article('', '')],
        ['invalid YAML', article('tags: [\n')]
    ])('rejects %s with the post filename', (_, source) => {
        expect(() => parsePost(source, 'broken-post')).toThrow('broken-post');
    });

    it('requires front matter and stable URL-safe filenames', () => {
        expect(() => parsePost('# Title', 'my-post')).toThrow('front matter');
        expect(() => parsePost(article(), '../secret')).toThrow('filename');
    });

    it('keeps drafts out of public lists, lookups, and RSS even when previewing', () => {
        const published = parsePost(article(), 'published');
        const draft = parsePost(article().replace('draft: false', 'draft: true'), 'private-draft');
        expect(selectPosts([draft, published]).map((post) => post.slug)).toEqual(['published']);
        expect(selectPosts([draft, published], true)).toHaveLength(2);
        expect(renderFeed([draft, published])).not.toContain('private-draft');
        expect(getPost('writing-a-post')).toBeUndefined();
        expect(getPost('writing-a-post', true)?.draft).toBe(true);
        expect(getPosts().every((post) => !post.draft)).toBe(true);
    });

    it('orders articles by date and omits article HTML from index payloads', () => {
        const older = parsePost(article().replace('2026-09-29', '2025-01-01'), 'older');
        const newer = parsePost(article(), 'newer');
        expect(selectPosts([older, newer]).map((post) => post.slug)).toEqual(['newer', 'older']);
        expect(getPosts(true).every((post) => !('html' in post))).toBe(true);
    });

    it('escapes RSS fields and uses permanent canonical links', () => {
        const post = parsePost(article().replace('An article', 'A & <B>'), 'rss-post');
        const feed = renderFeed([post]);
        expect(feed).toContain('<title>A &amp; &lt;B&gt;</title>');
        expect(feed).toContain(
            '<guid isPermaLink="true">https://jacoblin.cool/blog/rss-post</guid>'
        );
        expect(feed).toContain('Tue, 29 Sep 2026 00:00:00 GMT');
    });
});

describe('article rendering', () => {
    it('escapes raw HTML and rejects executable link and image URLs', () => {
        const { html } = renderBlogMarkdown(
            '<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n![bad](data:image/svg+xml,test)'
        );
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('href="javascript:');
        expect(html).not.toContain('src="data:');
        expect(html).toContain('&lt;script&gt;');
    });

    it('renders code, tables, safe links and escaped image attributes', () => {
        const { html } = renderBlogMarkdown(
            '```html\n<script>\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n[home](/blog)\n\n![a " quote](/blog/photo.png)'
        );
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('<table>');
        expect(html).toContain('href="/blog"');
        expect(html).toContain('alt="a &quot; quote"');
    });

    it('creates unique anchors for duplicate and Chinese headings with a single page title', () => {
        const { html, headings } = renderBlogMarkdown(
            '# 起點\n\n## 起點\n\n## 起點-2\n\n### **Details**'
        );
        expect(new Set(headings.map((heading) => heading.id)).size).toBe(4);
        expect(headings[0].id).toBe('section-起點');
        expect(headings[3].text).toBe('Details');
        expect(html).not.toContain('<h1');
    });
});
