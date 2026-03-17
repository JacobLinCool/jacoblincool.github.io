<script lang="ts">
    import { resolveSpecialOccasion, type SpecialOccasion } from '@jacoblincool/agent';
    import { onMount } from 'svelte';
    import { Confetti } from 'svelte-confetti';

    const birthdayPalette = [
        '#fb7185',
        '#f59e0b',
        '#fde047',
        '#34d399',
        '#60a5fa',
        '#a78bfa',
        'linear-gradient(135deg, #f9a8d4, #fb7185)',
        'linear-gradient(135deg, #67e8f9, #60a5fa)'
    ];
    const birthdayEffectLifetimeMs = 6800;

    let activeOccasion = $state<SpecialOccasion | null>(null);
    let shouldRender = $state(false);

    onMount(() => {
        const occasion = resolveSpecialOccasion(new Date());
        if (!occasion) {
            return;
        }

        activeOccasion = occasion;
        shouldRender = true;

        const timeoutId = window.setTimeout(() => {
            shouldRender = false;
            activeOccasion = null;
        }, birthdayEffectLifetimeMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    });
</script>

{#if shouldRender && activeOccasion === 'birthday'}
    <div class="special-occasion-overlay" aria-hidden="true">
        <div class="fullscreen-confetti-field">
            <Confetti
                amount={200}
                colorArray={birthdayPalette}
                delay={[0, 5000]}
                destroyOnComplete
                disableForReducedMotion
                fallDistance="100vh"
                rounded
                size={16}
                x={[-5, 5]}
                y={[0, 0.1]}
            />
        </div>
    </div>
{/if}

<style>
    .special-occasion-overlay {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: flex;
        justify-content: center;
        pointer-events: none;
        overflow: hidden;
    }

    .fullscreen-confetti-field {
        position: fixed;
        top: -3.25rem;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        overflow: hidden;
        pointer-events: none;
    }

    @media (max-width: 640px) {
        .fullscreen-confetti-field {
            top: -2.5rem;
        }
    }
</style>
