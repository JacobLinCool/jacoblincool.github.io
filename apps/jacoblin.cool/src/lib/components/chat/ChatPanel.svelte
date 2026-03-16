<script lang="ts">
    import { Sparkles } from '@lucide/svelte';
    import Composer from '$lib/components/chat/Composer.svelte';
    import MessageList from '$lib/components/chat/MessageList.svelte';
    import PromptChips from '$lib/components/chat/PromptChips.svelte';
    import TypingTagline from '$lib/components/chat/TypingTagline.svelte';
    import { chatStore } from '$lib/stores/chat.svelte';

    const handleChipSelect = async (prompt: string) => {
        await chatStore.submitChipPrompt(prompt);
    };

    const handleSubmit = async () => {
        await chatStore.submitComposer();
    };

    const isIdle = $derived(chatStore.state.conversationStage === 'idle');
    const isInteractive = $derived(
        chatStore.state.isStreaming || chatStore.state.backgroundEventType !== 'idle'
    );
    const idleTaglines = $derived(
        chatStore.state.taglines.length > 0 ? chatStore.state.taglines : ['I am Jacob']
    );
    let composerDockRef: HTMLDivElement | null = null;
    let composerDockHeight = $state(0);

    $effect(() => {
        if (isIdle || !composerDockRef) {
            composerDockHeight = 0;
            return;
        }

        const updateDockHeight = () => {
            composerDockHeight = Math.ceil(composerDockRef?.getBoundingClientRect().height ?? 0);
        };

        updateDockHeight();
        const observer = new ResizeObserver(() => {
            updateDockHeight();
        });
        observer.observe(composerDockRef);

        return () => {
            observer.disconnect();
        };
    });
</script>

<section
    class={`chat-panel mx-auto w-full max-w-5xl px-1 sm:px-2 ${isIdle ? '' : 'h-full min-h-0'}`}
>
    <div
        aria-hidden="true"
        class={`chat-scrim ${isIdle ? 'chat-scrim-idle' : ''} ${isInteractive ? 'chat-scrim-interactive' : ''}`}
    ></div>

    <div
        class={`relative z-10 flex flex-col gap-3 sm:gap-4 ${
            isIdle
                ? 'min-h-[58vh] justify-center pb-4'
                : 'h-full min-h-0 justify-start overflow-hidden'
        }`}
    >
        {#if isIdle}
            <div class="space-y-2 text-zinc-100">
                <p
                    class="flex min-h-8 items-center gap-2 text-base font-medium tracking-tight text-zinc-200 sm:text-xl"
                >
                    <Sparkles size={16} strokeWidth={1.9} class="text-sky-300" />
                    <TypingTagline
                        phrases={idleTaglines}
                        typingMs={45}
                        deletingMs={30}
                        holdMs={1200}
                        loop={true}
                    />
                </p>
                <h1
                    class="text-xl leading-tight font-medium tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.08]"
                >
                    What do you want to talk about?
                </h1>
            </div>
        {/if}

        {#if !isIdle}
            <MessageList
                messages={chatStore.state.messages}
                progressEvents={chatStore.state.progressEvents}
                contextStatusCollapsed={chatStore.state.contextStatusCollapsed}
                audioState={chatStore.state.audio}
                onCopy={(messageId) => void chatStore.copyMessage(messageId)}
                onToggleAudio={(messageId) => chatStore.toggleAudio(messageId)}
                onToggleContextStatus={() => chatStore.toggleContextStatusCollapsed()}
                layoutMode="conversation"
                bottomInset={composerDockHeight + 16 + 12}
            />
        {/if}

        <div bind:this={composerDockRef} class={isIdle ? '' : 'composer-docked'}>
            <Composer
                value={chatStore.state.composer}
                disabled={chatStore.state.isStreaming}
                onChange={(value) => chatStore.setComposer(value)}
                onSubmit={handleSubmit}
            />
        </div>

        {#if isIdle}
            <PromptChips
                chips={chatStore.state.promptChips}
                disabled={chatStore.state.isStreaming}
                onSelect={handleChipSelect}
            />
        {/if}
    </div>
</section>

<style>
    .chat-panel {
        position: relative;
    }

    .chat-scrim {
        position: absolute;
        inset: -0.35rem;
        border-radius: 2rem;
        background: radial-gradient(
            120% 120% at 50% 14%,
            rgb(2 6 13 / 62%) 0%,
            rgb(2 6 13 / 46%) 54%,
            rgb(2 6 13 / 28%) 100%
        );
        pointer-events: none;
        transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0.64;
    }

    .chat-scrim-idle {
        opacity: 0.54;
    }

    .chat-scrim-interactive {
        opacity: 0.38;
    }

    .composer-docked {
        position: fixed;
        left: 50%;
        width: min(calc(100vw - 2rem), 48rem);
        transform: translateX(-50%);
        bottom: calc(0.85rem + env(safe-area-inset-bottom));
        z-index: 25;
    }

    @media (min-width: 640px) {
        .composer-docked {
            width: min(calc(100vw - 3rem), 48rem);
            bottom: 1rem;
        }
    }
</style>
