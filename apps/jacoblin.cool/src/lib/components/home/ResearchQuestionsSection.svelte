<script lang="ts">
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { computeRailEdgeState, scrollRailByViewport } from '$lib/utils/rail-scroll';
    import type { ResearchQuestionCard } from '$lib/types/home';

    let {
        questions,
        onDeepDive,
        disabled = false
    }: {
        questions: ResearchQuestionCard[];
        onDeepDive: (promptId: string) => void | Promise<void>;
        disabled?: boolean;
    } = $props();

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

<section aria-labelledby="research-questions-heading" class="section-shell rounded-3xl border border-white/10 bg-black/35 p-6 sm:p-9 lg:p-10">
    <div class="mb-10 flex items-start justify-between gap-5 sm:mb-12">
        <div class="flex max-w-[72ch] flex-col gap-3">
            <p class="text-xs font-semibold tracking-[0.22em] text-cyan-300/85 uppercase">Research Focus</p>
            <h2 id="research-questions-heading" class="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                What I'm Exploring Right Now
            </h2>
            <p class="text-sm text-zinc-300 sm:text-base">
                Pick a card to continue this topic in chat.
            </p>
        </div>

        <div class="home-rail-controls hidden xl:flex" aria-label="Research question rail controls">
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll research questions left"
                disabled={!canScrollPrev}
                onclick={() => scrollRail(-1)}
            >
                <ChevronLeft size={16} strokeWidth={2.1} />
            </button>
            <button
                type="button"
                class="home-rail-control-btn"
                aria-label="Scroll research questions right"
                disabled={!canScrollNext}
                onclick={() => scrollRail(1)}
            >
                <ChevronRight size={16} strokeWidth={2.1} />
            </button>
        </div>
    </div>

    <div class="home-rail">
        <div
            bind:this={railTrackRef}
            class="home-rail-track grid gap-5 md:grid-cols-3 xl:!flex xl:gap-6"
            onwheel={handleRailWheel}
        >
            {#each questions as question (question.id)}
                <article class="home-rail-item research-rail-item home-surface-soft flex h-full flex-col p-5 sm:p-6">
                    <h3 class="research-title mb-3 text-lg font-semibold tracking-tight text-zinc-100">
                        {question.title}
                    </h3>

                    <div class="flex-1 space-y-4">
                        <div>
                            <p class="text-xs font-semibold tracking-[0.18em] text-zinc-400 uppercase">The Question</p>
                            <p class="mt-1 text-sm leading-relaxed text-zinc-200">{question.question}</p>
                        </div>

                        <div>
                            <p class="text-xs font-semibold tracking-[0.18em] text-zinc-400 uppercase">Why This Matters</p>
                            <p class="mt-1 text-sm leading-relaxed text-zinc-200">{question.whyItMatters}</p>
                        </div>

                        <div>
                            <p class="text-xs font-semibold tracking-[0.18em] text-zinc-400 uppercase">What I'm Testing Now</p>
                            <p class="mt-1 text-sm leading-relaxed text-zinc-200">{question.currentDirection}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="mt-7 inline-flex cursor-pointer items-center justify-center self-start rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition-colors duration-200 hover:border-cyan-200/55 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={disabled}
                        onclick={() => void onDeepDive(question.promptId)}
                    >
                        Continue in chat
                    </button>
                </article>
            {/each}
        </div>
    </div>
</section>

<style>
    @media (min-width: 1280px) {
        .research-rail-item {
            width: clamp(21rem, 24vw, 26rem);
        }

        .research-title {
            min-height: 3.5rem;
        }
    }
</style>
