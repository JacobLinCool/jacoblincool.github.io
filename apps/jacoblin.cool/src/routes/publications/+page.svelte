<script lang="ts">
    import { ArrowUpRight } from '@lucide/svelte';
    import { siteConfig } from '$lib/config/site';
    import { formatPostDate } from '$lib/content/blog';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    const years = $derived([...new Set(data.publications.map((paper) => paper.year))]);
</script>

<svelte:head>
    <title>Publications · Jacob Lin</title>
    <meta
        name="description"
        content="Papers and preprints by Jhen-Ke (Jacob) Lin on model evaluation, AI agents, rhythm games, and speech technology."
    />
    <link rel="canonical" href={`${siteConfig.origin}/publications`} />
</svelte:head>

<div class="reading-page">
    <header class="reading-header">
        <h1>Publications</h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
            Papers and preprints on model evaluation, agent-managed software, rhythm-game
            generation, and speech technology.
        </p>
        <a
            href={data.scholar.profileUrl}
            rel="external"
            class="reading-link mt-6 inline-flex items-center gap-2"
            >Google Scholar <ArrowUpRight size={17} aria-hidden="true" /></a
        >
        <p class="mt-3 text-sm text-zinc-400">
            Citation counts checked {formatPostDate(data.verifiedAt)}.
        </p>
    </header>
    <div class="space-y-12">
        {#each years as year (year)}
            <section aria-labelledby={`year-${year}`} class="year-group">
                <h2 id={`year-${year}`} class="pt-6 text-2xl font-medium text-emerald-200">
                    {year}
                </h2>
                <ol class="divide-y divide-white/12">
                    {#each data.publications.filter((paper) => paper.year === year) as paper (paper.id)}
                        <li class="py-6">
                            <h3 class="text-xl leading-snug font-medium text-zinc-100">
                                <a href={paper.url} rel="external" class="hover:text-emerald-200"
                                    >{paper.title}</a
                                >
                            </h3>
                            <p class="mt-3 text-sm leading-relaxed text-zinc-400">
                                {paper.authors}
                            </p>
                            <p class="mt-2 text-sm text-emerald-200">{paper.venue}</p>
                            <p class="mt-4 leading-relaxed text-zinc-300">{paper.summary}</p>
                            <div class="mt-4 flex flex-wrap items-center gap-5 text-sm">
                                <a
                                    href={paper.url}
                                    rel="external"
                                    class="reading-link inline-flex items-center gap-1"
                                    >Read paper <ArrowUpRight size={15} aria-hidden="true" /></a
                                >
                                <span class="text-zinc-400"
                                    >{paper.citations}
                                    {paper.citations === 1 ? 'citation' : 'citations'}</span
                                >
                            </div>
                        </li>
                    {/each}
                </ol>
            </section>
        {/each}
    </div>
</div>

<style>
    .year-group {
        display: grid;
        gap: 0.5rem;
        border-top: 1px solid rgb(255 255 255 / 12%);
    }
    @media (min-width: 640px) {
        .year-group {
            grid-template-columns: 6rem minmax(0, 1fr);
            gap: 2rem;
        }
    }
</style>
