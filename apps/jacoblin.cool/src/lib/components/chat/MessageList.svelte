<script lang="ts">
    import MessageItem from '$lib/components/chat/MessageItem.svelte';
    import type { AudioUiState, ChatMessage, ChatProgressEvent } from '$lib/types/chat';

    let {
        messages,
        progressEvents = [],
        audioState,
        onCopy,
        onToggleAudio,
        layoutMode = 'compact',
        bottomInset = 0
    }: {
        messages: ChatMessage[];
        progressEvents?: ChatProgressEvent[];
        audioState: AudioUiState;
        onCopy: (messageId: string) => void;
        onToggleAudio: (messageId: string) => void;
        layoutMode?: 'compact' | 'conversation';
        bottomInset?: number;
    } = $props();

    let scrollRef: HTMLDivElement | null = null;

    const scrollKey = $derived(
        messages
            .map((message) => `${message.id}:${message.content.length}:${message.status}`)
            .join('|')
    );

    $effect(() => {
        const signature = scrollKey;
        if (signature.length === 0) {
            return;
        }

        requestAnimationFrame(() => {
            if (!scrollRef) {
                return;
            }
            scrollRef.scrollTop = scrollRef.scrollHeight;
        });
    });
</script>

<div
    bind:this={scrollRef}
    style={layoutMode === 'conversation'
        ? `padding-bottom: calc(${bottomInset}px + env(safe-area-inset-bottom));`
        : undefined}
    class={`overflow-y-auto rounded-3xl border border-white/8 bg-black/18 p-3 ${
        layoutMode === 'conversation'
            ? 'max-h-none min-h-0 flex-1 overscroll-contain'
            : 'max-h-[42vh] sm:max-h-[46vh]'
    }`}
>
    <ul class="space-y-3">
        {#if progressEvents.length > 0}
            <li>
                <div class="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                    <p class="mb-2 tracking-[0.15em] text-zinc-400 uppercase">Context status</p>
                    <ul class="space-y-1.5">
                        {#each progressEvents as event (event.id)}
                            <li class="leading-relaxed">{event.text}</li>
                        {/each}
                    </ul>
                </div>
            </li>
        {/if}

        {#each messages as message (message.id)}
            <MessageItem {message} {audioState} {onCopy} {onToggleAudio} />
        {/each}
    </ul>
</div>
