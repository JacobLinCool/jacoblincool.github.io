<script lang="ts">
    import { Copy, Square, Volume2 } from '@lucide/svelte';
    import { publicFeatureFlags } from '$lib/config/public-flags';
    import type { AudioUiState, ChatMessage } from '$lib/types/chat';
    import { renderChatMarkdown } from '$lib/utils/chat-markdown';

    let {
        message,
        audioState,
        onCopy,
        onToggleAudio
    }: {
        message: ChatMessage;
        audioState: AudioUiState;
        onCopy: (messageId: string) => void;
        onToggleAudio: (messageId: string) => void;
    } = $props();

    const isAssistant = $derived(message.role === 'assistant');
    const showActions = $derived(isAssistant && message.status === 'done');
    const isPlaying = $derived(
        audioState.state === 'playing' && audioState.messageId === message.id
    );
    const showAudioButton = $derived(showActions && publicFeatureFlags.chatAudioEnabled);
    const displayContent = $derived(message.content || (isAssistant ? 'Thinking…' : ''));
    const renderedContent = $derived(renderChatMarkdown(displayContent));
</script>

<li class={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
    <article
        class={`rounded-3xl px-4 py-3 text-[15.5px] leading-[1.65] sm:text-[16px] ${
            isAssistant
                ? 'max-w-[92%] border border-white/8 bg-zinc-800/68 text-zinc-100 sm:max-w-[72ch]'
                : 'max-w-[90%] border border-sky-300/22 bg-sky-500/20 text-sky-50 sm:max-w-[78%]'
        }`}
    >
        <div
            aria-live={isAssistant && message.status === 'streaming' ? 'polite' : 'off'}
            aria-atomic="false"
        >
            <div
                class={`chat-message-markdown prose max-w-none break-words text-inherit prose-p:my-0 prose-headings:mb-3 prose-headings:font-medium prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-inherit prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/35 prose-pre:px-3 prose-pre:py-2 prose-ol:my-3 prose-ul:my-3 prose-li:my-1 prose-blockquote:border-l-white/15 prose-blockquote:text-inherit prose-a:font-medium prose-a:text-sky-300 prose-a:no-underline hover:prose-a:text-sky-200 hover:prose-a:underline ${
                    isAssistant
                        ? 'prose-invert prose-code:bg-white/6 prose-code:px-1 prose-code:py-0.5 prose-code:before:hidden prose-code:after:hidden'
                        : 'prose-invert prose-a:text-sky-100 hover:prose-a:text-white prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:before:hidden prose-code:after:hidden'
                }`}
            >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html renderedContent}
            </div>
            {#if isAssistant && message.status === 'streaming'}
                <div class="mt-1.5 flex items-center gap-2 text-xs text-zinc-400">
                    <span class="loading loading-xs loading-dots"></span>
                    Streaming response
                </div>
            {/if}
        </div>

        {#if showActions}
            <div class="mt-2 flex gap-2 border-t border-white/10 pt-2">
                <button
                    type="button"
                    class="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/3 px-2 text-xs text-zinc-300 transition hover:border-white/18 hover:bg-white/8"
                    onclick={() => onCopy(message.id)}
                    aria-label="Copy response"
                >
                    <Copy size={12} strokeWidth={1.9} />
                    Copy
                </button>
                {#if showAudioButton}
                    <button
                        type="button"
                        class="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/3 px-2 text-xs text-zinc-300 transition hover:border-white/18 hover:bg-white/8"
                        onclick={() => onToggleAudio(message.id)}
                        aria-label={isPlaying ? 'Stop voice playback' : 'Play voice'}
                    >
                        {#if isPlaying}
                            <Square size={12} strokeWidth={1.9} />
                            Stop
                        {:else}
                            <Volume2 size={12} strokeWidth={1.9} />
                            Play
                        {/if}
                    </button>
                {/if}
            </div>
        {/if}
    </article>
</li>
