<script lang="ts">
    import { Sparkles } from '@lucide/svelte';
    import type { PromptChip } from '$lib/types/chat';

    let {
        chips,
        disabled = false,
        onSelect
    }: {
        chips: PromptChip[];
        disabled?: boolean;
        onSelect: (chip: PromptChip) => void;
    } = $props();
</script>

<ul class="flex flex-wrap gap-2" aria-label="Prompt suggestions">
    {#each chips as chip, index (chip.id)}
        <li>
            <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/72 px-3 text-xs text-zinc-300 transition hover:border-white/18 hover:bg-zinc-800/80 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                onclick={() => onSelect(chip)}
                {disabled}
            >
                {#if index === 0}
                    <Sparkles size={13} strokeWidth={2} class="text-zinc-400" />
                {/if}
                {chip.label}
            </button>
        </li>
    {/each}
</ul>
