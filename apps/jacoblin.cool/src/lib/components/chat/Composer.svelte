<script lang="ts">
    import { SendHorizontal } from '@lucide/svelte';

    let {
        value,
        disabled = false,
        onChange,
        onSubmit
    }: {
        value: string;
        disabled?: boolean;
        onChange: (value: string) => void;
        onSubmit: () => void;
    } = $props();

    let isComposing = $state(false);

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
        onSubmit();
    };
</script>

<div
    class="rounded-[1.7rem] border border-white/9 bg-zinc-950/78 p-3.5 shadow-[0_14px_32px_rgb(0_0_0/28%)] backdrop-blur-xl sm:p-4"
>
    <label class="sr-only" for="chat-composer">Message Jacob</label>
    <textarea
        id="chat-composer"
        rows={2}
        class="max-h-44 min-h-16 w-full resize-none rounded-2xl border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        placeholder="Ask me anything..."
        {value}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
        onkeydown={handleKeydown}
        {disabled}
    ></textarea>

    <div class="mt-2 flex items-center justify-between gap-3 border-t border-white/8 pt-2.5">
        <div class="inline-flex items-center gap-2 text-xs text-zinc-500">
            <p>Enter to send, Shift+Enter for newline</p>
        </div>

        <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 text-sm font-medium text-sky-50 transition hover:border-sky-200/45 hover:bg-sky-400/18 disabled:cursor-not-allowed disabled:border-white/14 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:opacity-100"
            onclick={onSubmit}
            disabled={disabled || !value.trim()}
        >
            <SendHorizontal size={15} strokeWidth={1.9} />
            Send
        </button>
    </div>
</div>
