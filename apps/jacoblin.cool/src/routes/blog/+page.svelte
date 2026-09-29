<script lang="ts">
    import { resolve } from '$app/paths';
    import { ArrowUpRight, Rss } from '@lucide/svelte';
    import { siteConfig } from '$lib/config/site';
    import { blogDescription, formatPostDate } from '$lib/content/blog';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>Blog · Jacob Lin</title>
    <meta name="description" content={blogDescription} />
    <meta property="og:title" content="Blog · Jacob Lin" />
    <meta property="og:description" content={blogDescription} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={`${siteConfig.origin}/blog`} />
    <link rel="canonical" href={`${siteConfig.origin}/blog`} />
    {#if data.preview}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<div class="reading-page">
    <header class="reading-header">
        <h1>Blog</h1>
        <div class="mt-5 flex flex-wrap items-start justify-between gap-5">
            <p class="max-w-lg text-lg leading-relaxed text-zinc-300">{blogDescription}</p>
            <a href={resolve('/blog/rss.xml')} class="reading-link inline-flex items-center gap-2">
                <Rss size={16} aria-hidden="true" /> RSS feed
            </a>
        </div>
    </header>

    {#if data.posts.length}
        <ol class="divide-y divide-white/12 border-y border-white/12">
            {#each data.posts as post (post.slug)}
                <li>
                    <a href={resolve('/blog/[slug]', { slug: post.slug })} class="post-row group">
                        <div class="post-date text-sm text-zinc-400">
                            <time datetime={post.date}>{formatPostDate(post.date)}</time>
                            {#if post.draft}<span class="draft-label mt-2">Draft preview</span>{/if}
                        </div>
                        <div class="min-w-0" lang={post.lang}>
                            <h2
                                class="text-xl leading-snug font-medium tracking-tight text-zinc-100 group-hover:text-emerald-200 sm:text-2xl"
                            >
                                {post.title}
                            </h2>
                            <p class="mt-3 leading-relaxed text-zinc-300">{post.description}</p>
                            <p class="mt-4 text-sm text-zinc-400">
                                {post.readingMinutes} min read{#if post.tags.length}<span
                                        aria-hidden="true"
                                        class="mx-2"
                                    >
                                        ·
                                    </span>{post.tags.join(' / ')}{/if}
                            </p>
                        </div>
                        <ArrowUpRight
                            size={21}
                            class="mt-1 text-zinc-400 group-hover:text-emerald-200"
                            aria-hidden="true"
                        />
                    </a>
                </li>
            {/each}
        </ol>
    {:else}
        <section class="border-y border-white/12 py-14 sm:py-20" aria-label="No articles yet">
            <h2 class="text-2xl font-medium tracking-tight">A space for the next idea.</h2>
            <p class="mt-4 max-w-lg leading-relaxed text-zinc-300">
                No posts yet. In the meantime, explore my research and the questions behind it.
            </p>
            <a
                href={resolve('/publications')}
                class="reading-link mt-6 inline-flex items-center gap-2"
                >Explore publications <ArrowUpRight size={17} aria-hidden="true" /></a
            >
        </section>
    {/if}
</div>

<style>
    .post-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.75rem 1rem;
        padding-block: 2rem;
        text-decoration: none;
    }
    .post-date {
        grid-column: 1 / -1;
    }
    @media (min-width: 640px) {
        .post-row {
            grid-template-columns: 10rem minmax(0, 1fr) auto;
            gap: 1.5rem;
            padding-block: 2.5rem;
        }
        .post-date {
            grid-column: auto;
            padding-top: 0.3rem;
        }
    }
</style>
