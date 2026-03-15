<script lang="ts">
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { computeRailEdgeState, scrollRailByViewport } from '$lib/utils/rail-scroll';
    import { formatCount, formatUtcDateTime } from '$lib/utils/display-format';
    import type { FeaturedDemo, ProfileMetricsSnapshot } from '$lib/types/home';

    let {
        demos,
        metrics,
        onDeepDive,
        disabled = false
    }: {
        demos: FeaturedDemo[];
        metrics: ProfileMetricsSnapshot['huggingface'];
        onDeepDive: (promptId: string) => void | Promise<void>;
        disabled?: boolean;
    } = $props();

    const openExternal = (url: string) => {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    let railTrackRef: HTMLDivElement | null = null;
    let canScrollPrev = $state(false);
    let canScrollNext = $state(false);

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

<section aria-labelledby="demo-lab-heading" class="section-shell rounded-3xl border border-white/10 bg-black/25 p-6 sm:p-9 lg:p-10">
    <div class="mb-10 flex items-start justify-between gap-5 sm:mb-12">
        <div class="flex max-w-[72ch] flex-col gap-3">
            <p class="text-xs font-semibold tracking-[0.22em] text-fuchsia-300/85 uppercase">Live Demos</p>
            <h2 id="demo-lab-heading" class="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Interactive Demos I Maintain
            </h2>
            <p class="text-sm text-zinc-300 sm:text-base">
                Hands-on demos that show what my models do well, where they fail, and what it takes to ship them.
            </p>
        </div>

        <div class="home-rail-controls hidden xl:flex" aria-label="Demo rail controls">
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll demos left"
                disabled={!canScrollPrev}
                onclick={() => scrollRail(-1)}
            >
                <ChevronLeft size={16} strokeWidth={2.1} />
            </button>
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll demos right"
                disabled={!canScrollNext}
                onclick={() => scrollRail(1)}
            >
                <ChevronRight size={16} strokeWidth={2.1} />
            </button>
        </div>
    </div>

    <div class="metric-strip mb-8 grid gap-4 sm:grid-cols-2 lg:mb-10 lg:grid-cols-4">
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Models</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(metrics.models)}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Spaces</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(metrics.spaces)}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Most liked Space</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(metrics.topSpace.likes)}</p>
            <p class="mt-1 truncate text-xs text-zinc-500">{metrics.topSpace.id}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Most downloaded model</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(metrics.topModel.downloads)}</p>
            <p class="mt-1 truncate text-xs text-zinc-500">{metrics.topModel.id}</p>
        </article>
    </div>

    <div class="home-rail">
        <div
            bind:this={railTrackRef}
            class="home-rail-track grid gap-5 md:grid-cols-2 xl:!flex xl:gap-6"
            onwheel={handleRailWheel}
        >
            {#each demos as demo (demo.id)}
                <article class="home-rail-item demo-rail-item home-surface-soft flex h-full flex-col p-5 sm:p-6">
                    <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span class="rounded-full border border-white/12 px-2 py-1">Likes {formatCount(demo.likes)}</span>
                        <span class="rounded-full border border-white/12 px-2 py-1">
                            Downloads {formatCount(demo.downloads)}
                        </span>
                    </div>

                    <h3 class="demo-title text-lg font-semibold tracking-tight text-zinc-100">{demo.name}</h3>
                    <p class="mt-3 flex-1 text-sm leading-relaxed text-zinc-200">{demo.description}</p>

                    <div class="mt-7 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            class="inline-flex items-center rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200 transition-colors duration-200 hover:border-white/35 hover:text-zinc-100"
                            onclick={() => openExternal(demo.url)}
                        >
                            Open demo
                        </button>
                        <button
                            type="button"
                            class="inline-flex cursor-pointer items-center rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-100 transition-colors duration-200 hover:border-fuchsia-200/55 hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={disabled}
                            onclick={() => void onDeepDive(demo.promptId)}
                        >
                            Discuss this demo in chat
                        </button>
                    </div>
                </article>
            {/each}
        </div>
    </div>

    <p class="mt-6 text-xs text-zinc-500">Metrics updated: {formatUtcDateTime(metrics.refreshedAt)}</p>
</section>

<style>
    @media (min-width: 1280px) {
        .metric-strip {
            gap: 0;
            border-radius: 1rem;
            border: 1px solid rgb(255 255 255 / 0.06);
            background: linear-gradient(180deg, rgb(10 14 24 / 0.3), rgb(8 11 20 / 0.12));
            overflow: hidden;
        }

        .metric-strip article.home-surface-metric {
            border: 0;
            border-radius: 0;
            background: transparent;
            padding: 1rem 1.2rem;
        }
    }

    @media (min-width: 1280px) {
        .demo-rail-item {
            width: clamp(23rem, 28vw, 30rem);
        }

        .demo-title {
            min-height: 3.5rem;
        }
    }
</style>
