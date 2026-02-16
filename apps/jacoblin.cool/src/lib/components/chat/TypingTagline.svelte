<script lang="ts">
    import { browser } from '$app/environment';
    import { onDestroy, onMount } from 'svelte';

    type TypingPhase = 'typing' | 'holding' | 'deleting';

    let {
        phrases,
        typingMs = 45,
        deletingMs = 30,
        holdMs = 1200,
        startDelayMs = 280,
        loop = true
    }: {
        phrases: string[];
        typingMs?: number;
        deletingMs?: number;
        holdMs?: number;
        startDelayMs?: number;
        loop?: boolean;
    } = $props();

    let activeIndex = $state(0);
    let displayText = $state('');
    let phase = $state<TypingPhase>('typing');
    let isReducedMotion = $state(false);

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let mediaQuery: MediaQueryList | null = null;
    let cleanupMotionListener: (() => void) | null = null;

    const firstPhrase = $derived(phrases[0] ?? '');

    const clearTimer = () => {
        if (timerId === null) {
            return;
        }

        clearTimeout(timerId);
        timerId = null;
    };

    const scheduleStep = (delay: number) => {
        clearTimer();
        timerId = setTimeout(
            () => {
                tickTyping();
            },
            Math.max(0, delay)
        );
    };

    const resetCycle = () => {
        activeIndex = 0;
        displayText = '';
        phase = 'typing';
    };

    const moveToNextPhrase = () => {
        if (phrases.length === 0) {
            return;
        }

        if (activeIndex < phrases.length - 1) {
            activeIndex += 1;
            return;
        }

        if (loop) {
            activeIndex = 0;
        }
    };

    const tickTyping = () => {
        if (phrases.length === 0) {
            displayText = '';
            return;
        }

        if (isReducedMotion) {
            displayText = firstPhrase;
            phase = 'holding';
            return;
        }

        const currentPhrase = phrases[activeIndex] ?? '';

        if (phase === 'typing') {
            if (displayText.length < currentPhrase.length) {
                displayText = currentPhrase.slice(0, displayText.length + 1);
                scheduleStep(typingMs);
                return;
            }

            phase = 'holding';
            scheduleStep(holdMs);
            return;
        }

        if (phase === 'holding') {
            phase = 'deleting';
            scheduleStep(deletingMs);
            return;
        }

        if (displayText.length > 0) {
            displayText = displayText.slice(0, -1);
            scheduleStep(deletingMs);
            return;
        }

        const reachedLastPhrase = activeIndex >= phrases.length - 1;
        if (reachedLastPhrase && !loop) {
            phase = 'holding';
            displayText = currentPhrase;
            return;
        }

        moveToNextPhrase();
        phase = 'typing';
        scheduleStep(typingMs);
    };

    const syncMotionPreference = () => {
        isReducedMotion = mediaQuery?.matches ?? false;
        clearTimer();

        if (phrases.length === 0) {
            displayText = '';
            return;
        }

        if (isReducedMotion) {
            activeIndex = 0;
            phase = 'holding';
            displayText = firstPhrase;
            return;
        }

        resetCycle();
        scheduleStep(startDelayMs);
    };

    onMount(() => {
        if (!browser) {
            return;
        }

        if (phrases.length === 0) {
            displayText = '';
            return;
        }

        mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleMotionChange = () => {
            syncMotionPreference();
        };

        mediaQuery.addEventListener('change', handleMotionChange);
        cleanupMotionListener = () => {
            mediaQuery?.removeEventListener('change', handleMotionChange);
        };

        syncMotionPreference();
    });

    onDestroy(() => {
        clearTimer();
        cleanupMotionListener?.();
        cleanupMotionListener = null;
        mediaQuery = null;
    });
</script>

<span class="typing-tagline" aria-hidden="true">
    <span class="typing-text">{displayText}</span>
    <span class={`typing-caret ${isReducedMotion ? 'typing-caret-static' : ''}`} aria-hidden="true"
        >|</span
    >
</span>
<span class="sr-only">{firstPhrase || 'Jacob introduction'}</span>

<style>
    .typing-tagline {
        display: inline-flex;
        align-items: baseline;
        min-height: 1.25em;
        line-height: 1.2;
    }

    .typing-text {
        display: inline;
    }

    .typing-caret {
        margin-left: 0.08em;
        color: rgb(186 230 253 / 74%);
        animation: caret-blink 1500ms ease-in-out infinite;
    }

    .typing-caret-static {
        animation: none;
        opacity: 0.72;
    }

    @keyframes caret-blink {
        0%,
        45% {
            opacity: 0.92;
        }

        46%,
        100% {
            opacity: 0.2;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .typing-caret {
            animation: none;
            opacity: 0.72;
        }
    }
</style>
