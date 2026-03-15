<script lang="ts">
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { computeRailEdgeState, scrollRailByViewport } from '$lib/utils/rail-scroll';
    import { formatCount } from '$lib/utils/display-format';
    import type { NextStepCta, ProfileMetricsSnapshot } from '$lib/types/home';

    let {
        nextSteps,
        scholar,
        onDeepDive,
        disabled = false
    }: {
        nextSteps: NextStepCta[];
        scholar: ProfileMetricsSnapshot['scholar'];
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

<section aria-labelledby="next-steps-heading" class="section-shell rounded-3xl border border-white/10 bg-black/30 p-6 sm:p-9 lg:p-10">
    <div class="mb-10 flex items-start justify-between gap-5 sm:mb-12">
        <div class="flex max-w-[72ch] flex-col gap-3">
            <p class="text-xs font-semibold tracking-[0.22em] text-amber-300/85 uppercase">Work Together</p>
            <h2 id="next-steps-heading" class="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Ways We Can Collaborate
            </h2>
            <p class="text-sm text-zinc-300 sm:text-base">
                Choose a direction and I'll continue in chat.
            </p>
        </div>

        <div class="home-rail-controls hidden xl:flex" aria-label="Next step rail controls">
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll next steps left"
                disabled={!canScrollPrev}
                onclick={() => scrollRail(-1)}
            >
                <ChevronLeft size={16} strokeWidth={2.1} />
            </button>
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll next steps right"
                disabled={!canScrollNext}
                onclick={() => scrollRail(1)}
            >
                <ChevronRight size={16} strokeWidth={2.1} />
            </button>
        </div>
    </div>

    <div class="metric-strip mb-8 grid gap-4 sm:grid-cols-2 lg:mb-10 lg:grid-cols-4">
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Total citations</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(scholar.citations)}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">H-index</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(scholar.hIndex)}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">i10-index</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-100">{formatCount(scholar.i10Index)}</p>
        </article>
        <article class="home-surface-metric home-divider-inline p-4">
            <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Focus areas</p>
            <p class="mt-2 text-sm text-zinc-100">{scholar.topics.join(' / ')}</p>
        </article>
    </div>

    <div class="home-rail">
        <div
            bind:this={railTrackRef}
            class="home-rail-track grid gap-5 md:grid-cols-3 xl:!flex xl:gap-6"
            onwheel={handleRailWheel}
        >
            {#each nextSteps as item (item.id)}
                <article class="home-rail-item next-step-rail-item home-surface-soft flex h-full flex-col p-5 sm:p-6">
                    <h3 class="next-step-title text-lg font-semibold tracking-tight text-zinc-100">{item.title}</h3>

                    <p class="mt-4 flex-1 text-sm leading-relaxed text-zinc-200">{item.description}</p>

                    <button
                        type="button"
                        class="mt-7 inline-flex cursor-pointer items-center self-start rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition-colors duration-200 hover:border-amber-200/60 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={disabled}
                        onclick={() => void onDeepDive(item.promptId)}
                    >
                        {item.ctaLabel}
                    </button>
                </article>
            {/each}
        </div>
    </div>

    <div class="mt-10 text-sm text-zinc-400">
        Google Scholar:
        <button
            type="button"
            class="cursor-pointer text-zinc-200 underline decoration-zinc-600 underline-offset-3 transition-colors duration-200 hover:text-zinc-100"
            aria-label="Open Google Scholar profile in a new tab"
            onclick={() => openExternal(scholar.profileUrl)}
        >
            Open profile
        </button>
    </div>
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
        .next-step-rail-item {
            width: clamp(22rem, 26vw, 28rem);
        }

        .next-step-title {
            min-height: 3.5rem;
        }
    }
</style>
