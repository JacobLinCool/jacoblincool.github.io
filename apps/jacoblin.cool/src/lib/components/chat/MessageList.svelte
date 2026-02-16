<script lang="ts">
    import MessageItem from '$lib/components/chat/MessageItem.svelte';
    import type { AudioUiState, ChatMessage } from '$lib/types/chat';

    let {
        messages,
        audioState,
        onCopy,
        onToggleAudio,
        layoutMode = 'compact',
        bottomInset = 0
    }: {
        messages: ChatMessage[];
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
        {#each messages as message (message.id)}
            <MessageItem {message} {audioState} {onCopy} {onToggleAudio} />
        {/each}
    </ul>
</div>
