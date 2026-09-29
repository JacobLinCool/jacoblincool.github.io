<script lang="ts">
    import { resolve } from '$app/paths';
    import { ArrowLeft } from '@lucide/svelte';
    import { siteConfig } from '$lib/config/site';
    import { formatPostDate } from '$lib/content/blog';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    const post = $derived(data.post);
    const canonical = $derived(`${siteConfig.origin}/blog/${post.slug}`);
</script>

<svelte:head>
    <title>{post.title} · Jacob Lin</title>
    <meta name="description" content={post.description} />
    <meta name="author" content="Jacob Lin" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content={post.title} />
    <meta property="og:description" content={post.description} />
    <meta property="og:url" content={canonical} />
    <meta property="article:published_time" content={`${post.date}T00:00:00Z`} />
    {#if post.updated}<meta
            property="article:modified_time"
            content={`${post.updated}T00:00:00Z`}
        />{/if}
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href={canonical} />
    {#if post.draft}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<div class="reading-page article-page">
    <a href={resolve('/blog')} class="reading-link mb-10 inline-flex items-center gap-2"
        ><ArrowLeft size={17} aria-hidden="true" /> All posts</a
    >
    <article lang={post.lang}>
        <header class="reading-header">
            {#if post.draft}<p class="draft-label mb-5">
                    Draft preview — visible only in development
                </p>{/if}
            <h1>{post.title}</h1>
            <p class="mt-6 text-xl leading-relaxed text-zinc-300">{post.description}</p>
            <div class="mt-6 flex flex-wrap gap-x-3 gap-y-2 text-sm text-zinc-400">
                <span>Jacob Lin</span><span aria-hidden="true">·</span>
                <time datetime={post.date}>{formatPostDate(post.date, post.lang)}</time>
                <span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span>
            </div>
            {#if post.updated}<p class="mt-2 text-sm text-zinc-400">
                    Updated <time datetime={post.updated}
                        >{formatPostDate(post.updated, post.lang)}</time
                    >
                </p>{/if}
            {#if post.tags.length}<p class="mt-4 text-sm text-emerald-200">
                    {post.tags.join(' / ')}
                </p>{/if}
        </header>
        {#if post.headings.length > 1}
            <nav aria-label="Table of contents" class="mb-10 border-y border-white/12 py-6">
                <h2 class="mb-3 text-sm font-medium text-zinc-200">On this page</h2>
                <ol class="space-y-2">
                    {#each post.headings as heading (heading.id)}
                        <li class:pl-4={heading.depth === 3}>
                            <a href={`#${heading.id}`} class="reading-link text-sm"
                                >{heading.text}</a
                            >
                        </li>
                    {/each}
                </ol>
            </nav>
        {/if}
        <div class="article-body">
            <!-- HTML is rendered server-side with raw HTML escaped and URL protocols checked. -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html post.html}
        </div>
    </article>
    <div class="mt-14 border-t border-white/12 pt-6">
        <a href={resolve('/blog')} class="reading-link inline-flex items-center gap-2"
            ><ArrowLeft size={17} aria-hidden="true" /> All posts</a
        >
    </div>
</div>

<style>
    .article-page {
        max-width: 46rem;
    }
    .article-page h1 {
        font-size: clamp(2rem, 5vw, 3.5rem);
        overflow-wrap: anywhere;
    }
    .article-body {
        font-size: 1.0625rem;
        line-height: 1.9;
        color: #d4d4d8;
        overflow-wrap: anywhere;
    }
    .article-body :global(> :first-child) {
        margin-top: 0;
    }
    .article-body :global(p),
    .article-body :global(ul),
    .article-body :global(ol),
    .article-body :global(blockquote),
    .article-body :global(pre),
    .article-body :global(table) {
        margin-block: 1.5rem;
    }
    .article-body :global(h2),
    .article-body :global(h3),
    .article-body :global(h4),
    .article-body :global(h5),
    .article-body :global(h6) {
        color: #f4f4f5;
        font-weight: 600;
        line-height: 1.35;
        margin: 2.75rem 0 1rem;
        scroll-margin-top: 5rem;
        text-wrap: balance;
    }
    .article-body :global(h2) {
        font-size: 1.65rem;
    }
    .article-body :global(h3) {
        font-size: 1.3rem;
    }
    .article-body :global(a) {
        color: #a7f3d0;
        text-decoration: underline;
        text-underline-offset: 0.2em;
    }
    .article-body :global(a:hover) {
        color: #d1fae5;
    }
    .article-body :global(strong) {
        color: #f4f4f5;
    }
    .article-body :global(ul),
    .article-body :global(ol) {
        padding-left: 1.5rem;
    }
    .article-body :global(ul) {
        list-style: disc;
    }
    .article-body :global(ol) {
        list-style: decimal;
    }
    .article-body :global(li + li) {
        margin-top: 0.4rem;
    }
    .article-body :global(li > ul),
    .article-body :global(li > ol) {
        margin-block: 0.5rem;
    }
    .article-body :global(blockquote) {
        border-left: 1px solid #6ee7b7;
        padding-left: 1.4rem;
        color: #a1a1aa;
    }
    .article-body :global(code) {
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 0.85em;
        background: #18181b;
        border-radius: 0.25rem;
        padding: 0.15em 0.35em;
    }
    .article-body :global(pre) {
        overflow-x: auto;
        border: 1px solid #27272a;
        background: #09090b;
        border-radius: 0.75rem;
        padding: 1.25rem;
        line-height: 1.7;
    }
    .article-body :global(pre code) {
        padding: 0;
        background: transparent;
    }
    .article-body :global(img) {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin-inline: auto;
    }
    .article-body :global(table) {
        display: block;
        max-width: 100%;
        overflow-x: auto;
        border-collapse: collapse;
        font-size: 0.9em;
    }
    .article-body :global(th),
    .article-body :global(td) {
        padding: 0.65rem 1rem;
        border-bottom: 1px solid #3f3f46;
        text-align: left;
    }
    .article-body :global(th) {
        color: #f4f4f5;
    }
    .article-body :global(hr) {
        margin-block: 2.5rem;
        border-color: #3f3f46;
    }
</style>
