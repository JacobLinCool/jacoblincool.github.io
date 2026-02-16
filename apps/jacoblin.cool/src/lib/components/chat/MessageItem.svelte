<script lang="ts">
    import { Copy, Square, Volume2 } from '@lucide/svelte';
    import type { AudioUiState, ChatMessage } from '$lib/types/chat';

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
            <p class="wrap-break-word whitespace-pre-wrap">
                {message.content || (isAssistant ? 'Thinking…' : '')}
            </p>
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
            </div>
        {/if}
    </article>
</li>
