<script lang="ts">
    import ContextStatusCard from '$lib/components/chat/ContextStatusCard.svelte';
    import MessageItem from '$lib/components/chat/MessageItem.svelte';
    import type { AudioUiState, ChatMessage, ChatProgressEvent } from '$lib/types/chat';

    let {
        messages,
        progressEvents = [],
        contextStatusCollapsed = true,
        audioState,
        onCopy,
        onToggleAudio,
        onToggleContextStatus,
        layoutMode = 'compact',
        bottomInset = 0
    }: {
        messages: ChatMessage[];
        progressEvents?: ChatProgressEvent[];
        contextStatusCollapsed?: boolean;
        audioState: AudioUiState;
        onCopy: (messageId: string) => void;
        onToggleAudio: (messageId: string) => void;
        onToggleContextStatus: () => void;
        layoutMode?: 'compact' | 'conversation';
        bottomInset?: number;
    } = $props();

    let scrollRef: HTMLDivElement | null = null;

    const activeTurnView = $derived.by(() => {
        if (messages.length === 0) {
            return {
                contextAnchorMessageId: null as string | null,
                assistantMessageId: null as string | null,
                showContextStatus: false
            };
        }

        let lastUserIndex = -1;
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index]?.role === 'user') {
                lastUserIndex = index;
                break;
            }
        }

        if (lastUserIndex === -1) {
            return {
                contextAnchorMessageId: null as string | null,
                assistantMessageId: null as string | null,
                showContextStatus: false
            };
        }

        const anchorMessageId = messages[lastUserIndex]?.id ?? null;
        const assistantMessage = messages
            .slice(lastUserIndex + 1)
            .find((message) => message.role === 'assistant');

        const assistantHasVisibleContent = Boolean(assistantMessage?.content.trim());
        const showContextStatus =
            progressEvents.length > 0 &&
            Boolean(anchorMessageId) &&
            Boolean(assistantMessage) &&
            !assistantHasVisibleContent;

        return {
            contextAnchorMessageId: anchorMessageId,
            assistantMessageId: assistantMessage?.id ?? null,
            showContextStatus
        };
    });

    const scrollKey = $derived(
        [
            messages.map((message) => `${message.id}:${message.content.length}:${message.status}`).join('|'),
            progressEvents.map((event) => `${event.id}:${event.text}`).join('|'),
            contextStatusCollapsed ? 'collapsed' : 'expanded',
            activeTurnView.showContextStatus ? 'status-visible' : 'response-visible'
        ].join('||')
    );

    const hiddenAssistantMessageId = $derived(
        activeTurnView.showContextStatus ? activeTurnView.assistantMessageId : null
    );

    const contextAnchorMessageId = $derived(activeTurnView.contextAnchorMessageId);
    const showContextStatus = $derived(activeTurnView.showContextStatus);

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
            {#if message.id !== hiddenAssistantMessageId}
                <MessageItem {message} {audioState} {onCopy} {onToggleAudio} />
            {/if}

            {#if showContextStatus && message.id === contextAnchorMessageId}
                <ContextStatusCard
                    events={progressEvents}
                    collapsed={contextStatusCollapsed}
                    onToggle={onToggleContextStatus}
                />
            {/if}
        {/each}
    </ul>
</div>
