<script lang="ts">
    import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import type { ChatProgressEvent } from '$lib/types/chat';

    let {
        events,
        collapsed = false,
        onToggle
    }: {
        events: ChatProgressEvent[];
        collapsed?: boolean;
        onToggle: () => void;
    } = $props();

    const latestEventText = $derived(events.at(-1)?.text ?? 'Collecting context...');
</script>

<li class="flex justify-start">
    <article class="w-full max-w-[78%] rounded-[1.35rem] border border-white/8 bg-zinc-900/54 sm:max-w-[34rem]">
        <button
            type="button"
            class="flex w-full items-start justify-between gap-2.5 rounded-[1.35rem] px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
            onclick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand context status' : 'Collapse context status'}
        >
            <div class="min-w-0 space-y-1">
                <p class="text-[11px] tracking-[0.15em] text-zinc-400 uppercase">Context status</p>
                <p class={`leading-relaxed text-zinc-200 ${collapsed ? 'line-clamp-1 text-[13px]' : 'line-clamp-1 text-[13px]'}`}>
                    {latestEventText}
                </p>
            </div>
            <span class="mt-0.5 shrink-0 text-zinc-400">
                {#if collapsed}
                    <ChevronDown size={14} strokeWidth={1.9} />
                {:else}
                    <ChevronUp size={14} strokeWidth={1.9} />
                {/if}
            </span>
        </button>

        {#if !collapsed}
            <div class="px-3 pb-3">
                <ul class="space-y-1 text-[13px] leading-relaxed text-zinc-300">
                    {#each events as event (event.id)}
                        <li>{event.text}</li>
                    {/each}
                </ul>
            </div>
        {/if}
    </article>
</li>
