<script lang="ts">
    import { ArrowDown } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { createChatScrollController, type ChatScrollController } from '$lib/utils/chat-scroll';
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
        onRetry,
        isStreaming = false
    }: {
        messages: ChatMessage[];
        progressEvents?: ChatProgressEvent[];
        contextStatusCollapsed?: boolean;
        audioState: AudioUiState;
        onCopy: (messageId: string) => void;
        onToggleAudio: (messageId: string) => void;
        onToggleContextStatus: () => void;
        onRetry: (messageId: string) => void;
        isStreaming?: boolean;
    } = $props();

    let scrollRef: HTMLDivElement | null = null;
    let contentRef: HTMLUListElement | null = null;
    let scrollState = $state({ following: true, overflowing: false });
    let scrollController = $state.raw<ChatScrollController | null>(null);

    const jumpToLatest = () => {
        const smooth =
            !isStreaming && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrollController?.jumpToLatest(smooth);
    };

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
            !assistantHasVisibleContent &&
            assistantMessage?.status === 'streaming';

        return {
            contextAnchorMessageId: anchorMessageId,
            assistantMessageId: assistantMessage?.id ?? null,
            showContextStatus
        };
    });

    const hiddenAssistantMessageId = $derived(
        activeTurnView.showContextStatus ? activeTurnView.assistantMessageId : null
    );

    const contextAnchorMessageId = $derived(activeTurnView.contextAnchorMessageId);
    const showContextStatus = $derived(activeTurnView.showContextStatus);
    // Retries replace the assistant bubble while retaining the user's visible message.
    const scrollTurnId = $derived(activeTurnView.assistantMessageId ?? contextAnchorMessageId);

    const contentVersion = $derived.by(() => {
        const last = messages.at(-1);
        if (!last) return '';
        return `${last.id}:${last.content.length}:${last.status}:${progressEvents.at(-1)?.id}:${contextStatusCollapsed}`;
    });

    onMount(() => {
        if (!scrollRef || !contentRef) return;
        const controller = createChatScrollController({
            viewport: scrollRef,
            onStateChange: (next) => {
                scrollState = next;
            },
            requestFrame: requestAnimationFrame,
            cancelFrame: cancelAnimationFrame
        });
        scrollController = controller;
        const observer = new ResizeObserver(() => controller.resized());
        // Text/images and viewport changes both affect the visible bottom.
        observer.observe(contentRef);
        observer.observe(scrollRef);
        controller.update(scrollTurnId);
        return () => {
            observer.disconnect();
            controller.destroy();
            scrollController = null;
        };
    });

    $effect(() => {
        if (!contentVersion) return;
        scrollController?.update(scrollTurnId);
    });
</script>

<div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
    <!-- This focusable region observes native keyboard/pointer scrolling; it is not a button or custom widget. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
        bind:this={scrollRef}
        onscroll={() => scrollController?.scrolled()}
        onwheel={(event) => scrollController?.wheel(event.deltaY)}
        onkeydown={(event) => scrollController?.keydown(event.key, event.shiftKey)}
        ontouchstart={(event) => {
            const touch = event.touches[0];
            if (touch) scrollController?.touchStarted(touch.clientY);
        }}
        ontouchmove={(event) => {
            const touch = event.touches[0];
            if (touch) scrollController?.touchMoved(touch.clientY);
        }}
        ontouchend={() => scrollController?.touchEnded()}
        ontouchcancel={() => scrollController?.touchEnded()}
        onpointerdown={(event) => {
            if (scrollRef && event.target === scrollRef && event.offsetX >= scrollRef.clientWidth) {
                scrollController?.scrollbarPressed();
            }
        }}
        role="region"
        aria-label="Conversation"
        tabindex="0"
        class="chat-transcript min-h-0 flex-1 overflow-y-auto"
        class:overscroll-contain={scrollState.overflowing}
    >
        <ul bind:this={contentRef} class="space-y-3 p-3">
            {#each messages as message (message.id)}
                {#if message.id !== hiddenAssistantMessageId}
                    <MessageItem
                        {message}
                        {audioState}
                        {onCopy}
                        {onToggleAudio}
                        {onRetry}
                        canRetry={!isStreaming && message.id === messages.at(-1)?.id}
                        errorMessage={message.id === messages.at(-1)?.id
                            ? progressEvents.findLast((event) => event.type === 'error')?.text
                            : undefined}
                    />
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

    {#if !scrollState.following && scrollState.overflowing}
        <button
            type="button"
            class="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-sky-300/25 bg-zinc-900 px-3 py-2 text-xs text-sky-100 shadow-lg shadow-black/30 hover:bg-zinc-800"
            onclick={jumpToLatest}
        >
            <ArrowDown size={14} />
            Latest response
        </button>
    {/if}
</div>

<style>
    .chat-transcript {
        overflow-anchor: none;
    }
</style>
