<script lang="ts">
    import { SendHorizontal, Square } from '@lucide/svelte';
    import { siteConfig } from '$lib/config/site';

    let {
        value,
        isStreaming = false,
        focusRequest = 0,
        onChange,
        onSubmit,
        onPrepare,
        onStop
    }: {
        value: string;
        isStreaming?: boolean;
        focusRequest?: number;
        onChange: (value: string) => void;
        onSubmit: () => void;
        onPrepare: () => void;
        onStop: () => void;
    } = $props();

    let isComposing = $state(false);
    let handledFocusRequest = 0;
    let textareaRef: HTMLTextAreaElement | null = null;

    const handleInput = (event: Event) => {
        const target = event.currentTarget as HTMLTextAreaElement;
        onChange(target.value);
    };

    const handleCompositionStart = () => {
        isComposing = true;
    };

    const handleCompositionEnd = () => {
        isComposing = false;
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }

        // IME composition (e.g. Zhuyin) also uses Enter to confirm candidates.
        if (event.isComposing || isComposing || event.keyCode === 229) {
            return;
        }

        event.preventDefault();
        if (!isStreaming) handleSubmit();
    };

    $effect(() => {
        if (focusRequest <= handledFocusRequest) return;
        handledFocusRequest = focusRequest;
        textareaRef?.focus({ preventScroll: true });
    });

    const handleSubmit = () => {
        if (isStreaming || !value.trim()) return;
        onSubmit();
    };
</script>

<div
    class="chat-composer rounded-[1.7rem] border border-white/9 bg-zinc-950/78 p-3.5 shadow-[0_14px_32px_rgb(0_0_0/28%)] backdrop-blur-xl sm:p-4"
>
    <label class="sr-only" for="chat-composer">Message {siteConfig.identity.shortName}</label>
    <textarea
        id="chat-composer"
        bind:this={textareaRef}
        rows={2}
        maxlength={8000}
        class="max-h-44 min-h-16 w-full resize-none rounded-2xl border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
        placeholder={isStreaming ? 'Write your next question…' : 'Ask me anything…'}
        aria-describedby="chat-composer-hint"
        onfocus={onPrepare}
        onpointerenter={onPrepare}
        {value}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
        onkeydown={handleKeydown}
    ></textarea>

    <div
        class="composer-actions mt-2 flex items-center justify-between gap-3 border-t border-white/8 pt-2.5"
    >
        <div
            id="chat-composer-hint"
            class="composer-hint inline-flex items-center gap-2 text-xs text-zinc-400"
        >
            {#if isStreaming}
                <p>You can draft while I reply.</p>
            {:else}
                <p class="sm:hidden">Enter to send</p>
                <p class="max-sm:hidden">Enter to send, Shift+Enter for newline</p>
            {/if}
        </div>

        {#if isStreaming}
            <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/6 px-3 text-sm font-medium text-zinc-100 hover:bg-white/12"
                onclick={onStop}
                aria-label="Stop response"
            >
                <Square size={13} strokeWidth={1.9} />
                Stop
            </button>
        {:else}
            <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 text-sm font-medium text-sky-50 transition hover:border-sky-200/45 hover:bg-sky-400/18 disabled:cursor-not-allowed disabled:border-white/14 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:opacity-100"
                onclick={handleSubmit}
                disabled={!value.trim()}
            >
                <SendHorizontal size={15} strokeWidth={1.9} />
                Send
            </button>
        {/if}
    </div>
</div>

<style>
    @media (max-height: 540px) {
        .chat-composer {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 0.25rem 0.5rem;
            padding: 0.5rem 0.625rem;
            border-radius: 1.25rem;
        }

        textarea {
            grid-area: 1 / 1;
            min-height: 0;
            height: 2.5rem;
            max-height: 2.5rem;
            padding-block: 0.25rem;
            line-height: 1.5rem;
            overflow-y: auto;
        }

        .composer-actions {
            display: contents;
        }

        .composer-actions > button {
            grid-area: 1 / 2;
        }

        .composer-hint {
            grid-column: 1 / -1;
            grid-row: 2;
            padding-inline: 0.5rem;
        }
    }
</style>
