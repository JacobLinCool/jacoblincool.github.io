<script lang="ts">
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { computeRailEdgeState, scrollRailByViewport } from '$lib/utils/rail-scroll';
    import { formatCount } from '$lib/utils/display-format';
    import type { PublicationHighlight } from '$lib/types/home';

    let {
        publications,
        onAskPaper,
        disabled = false
    }: {
        publications: PublicationHighlight[];
        onAskPaper: (promptId: string) => void | Promise<void>;
        disabled?: boolean;
    } = $props();

    const openExternal = (url: string) => {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    let railTrackRef: HTMLOListElement | null = null;
    let canScrollPrev = $state(false);
    let canScrollNext = $state(false);

    const getPublicationYearRangeLabel = (items: PublicationHighlight[]): string => {
        const years = items
            .map((item) => item.year)
            .filter((year): year is number => Number.isFinite(year))
            .sort((a, b) => a - b);

        if (years.length === 0) {
            return 'N/A';
        }

        const minYear = years[0];
        const maxYear = years[years.length - 1];
        return minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`;
    };

    const publicationYearRangeLabel = $derived(getPublicationYearRangeLabel(publications));

    const getCitationLabel = (count: number): string => {
        const unit = count === 1 ? 'citation' : 'citations';
        return `${formatCount(count)} ${unit}`;
    };

    const prefersReducedMotion = () =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncRailEdges = () => {
        if (!railTrackRef || typeof window === 'undefined' || window.innerWidth < 1280) {
            canScrollPrev = false;
            canScrollNext = false;
            return;
        }

        const edgeState = computeRailEdgeState(railTrackRef);
        canScrollPrev = edgeState.canPrev;
        canScrollNext = edgeState.canNext;
    };

    const scrollRail = (direction: -1 | 1) => {
        if (!railTrackRef) {
            return;
        }
        scrollRailByViewport(railTrackRef, direction, prefersReducedMotion());
    };

    const handleRailWheel = (event: WheelEvent) => {
        if (!railTrackRef || typeof window === 'undefined' || window.innerWidth < 1280) {
            return;
        }

        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            return;
        }

        const maxScrollLeft = railTrackRef.scrollWidth - railTrackRef.clientWidth;
        if (maxScrollLeft <= 0) {
            return;
        }

        const nextScrollLeft = Math.min(
            maxScrollLeft,
            Math.max(0, railTrackRef.scrollLeft + event.deltaY)
        );
        if (Math.abs(nextScrollLeft - railTrackRef.scrollLeft) < 0.5) {
            return;
        }

        event.preventDefault();
        railTrackRef.scrollLeft = nextScrollLeft;
    };

    $effect(() => {
        if (!railTrackRef) {
            return;
        }

        const track = railTrackRef;
        const sync = () => {
            syncRailEdges();
        };

        const observer = new ResizeObserver(sync);
        observer.observe(track);
        track.addEventListener('scroll', sync, { passive: true });

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', sync, { passive: true });
        }

        sync();

        return () => {
            observer.disconnect();
            track.removeEventListener('scroll', sync);
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', sync);
            }
        };
    });
</script>

<section
    aria-labelledby="publications-heading"
    class="section-shell rounded-3xl border border-white/10 bg-black/30 p-6 sm:p-9 lg:p-10"
>
    <div class="mb-10 flex items-start justify-between gap-5 sm:mb-12">
        <div class="flex max-w-[72ch] flex-col gap-3">
            <p class="text-xs font-semibold tracking-[0.22em] text-emerald-300/85 uppercase">
                Previous Publications
            </p>
            <h2
                id="publications-heading"
                class="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
            >
                Selected Papers from Earlier Work
            </h2>
            <p class="text-sm text-zinc-300 sm:text-base">
                Selected papers from {publicationYearRangeLabel} on speech assessment, transcription fidelity,
                and multimodal systems.
            </p>
        </div>

        <div class="home-rail-controls hidden xl:flex" aria-label="Publications rail controls">
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll publications left"
                disabled={!canScrollPrev}
                onclick={() => scrollRail(-1)}
            >
                <ChevronLeft size={16} strokeWidth={2.1} />
            </button>
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll publications right"
                disabled={!canScrollNext}
                onclick={() => scrollRail(1)}
            >
                <ChevronRight size={16} strokeWidth={2.1} />
            </button>
        </div>
    </div>

    <div class="home-rail">
        <ol
            bind:this={railTrackRef}
            class="home-rail-track space-y-5 xl:!flex xl:gap-6 xl:space-y-0"
            onwheel={handleRailWheel}
        >
            {#each publications as publication, index (publication.id)}
                <li
                    class="home-rail-item publication-rail-item home-surface-soft relative flex h-full flex-col p-5 sm:p-6"
                >
                    <div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span class="rounded-full border border-white/12 px-2 py-1"
                            >{publication.year}</span
                        >
                        <span class="rounded-full border border-white/12 px-2 py-1">
                            {getCitationLabel(publication.citations)}
                        </span>
                        {#each publication.tags as tag (`${publication.id}-${tag}`)}
                            <span class="rounded-full border border-white/12 px-2 py-1">{tag}</span>
                        {/each}
                    </div>

                    <div class="publication-header">
                        <h3
                            class="publication-title text-lg font-semibold tracking-tight text-zinc-100"
                        >
                            {publication.title}
                        </h3>
                        <p class="publication-authors mt-1 text-sm text-zinc-400">
                            {publication.authors}
                        </p>
                        <p class="publication-venue mt-1 text-sm text-zinc-500">
                            {publication.venue}
                        </p>
                    </div>

                    <div class="mt-4 grid flex-1 content-start gap-4 md:grid-cols-2">
                        <div>
                            <p
                                class="text-xs font-semibold tracking-[0.18em] text-zinc-400 uppercase"
                            >
                                Contribution
                            </p>
                            <p
                                class="publication-impact mt-1 text-sm leading-relaxed text-zinc-200"
                            >
                                {publication.impact}
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-xs font-semibold tracking-[0.18em] text-zinc-400 uppercase"
                            >
                                Summary
                            </p>
                            <p
                                class="publication-summary mt-1 text-sm leading-relaxed text-zinc-200"
                            >
                                {publication.summary}
                            </p>
                        </div>
                    </div>

                    <div class="mt-7 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            class="inline-flex items-center rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200 transition-colors duration-200 hover:border-white/35 hover:text-zinc-100"
                            onclick={() => openExternal(publication.url)}
                        >
                            Open publication
                        </button>
                        <button
                            type="button"
                            class="inline-flex cursor-pointer items-center rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100 transition-colors duration-200 hover:border-emerald-200/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            {disabled}
                            onclick={() => void onAskPaper(publication.promptId)}
                        >
                            Discuss this paper in chat
                        </button>
                    </div>

                    {#if index < publications.length - 1}
                        <div
                            class="pointer-events-none absolute -bottom-3 left-8 h-6 w-px bg-white/14 xl:hidden"
                        ></div>
                    {/if}
                </li>
            {/each}
        </ol>
    </div>
</section>

<style>
    @media (min-width: 1280px) {
        .publication-rail-item {
            width: clamp(32rem, 38vw, 42rem);
        }

        .publication-header {
            min-height: 10.5rem;
        }

        .publication-title {
            min-height: calc(1.35em * 3);
        }

        .publication-authors {
            min-height: calc(1.45em * 2.2);
        }

        .publication-venue {
            min-height: calc(1.4em * 1.2);
        }

        .publication-impact,
        .publication-summary {
            min-height: calc(1.55em * 3.5);
        }
    }
</style>
