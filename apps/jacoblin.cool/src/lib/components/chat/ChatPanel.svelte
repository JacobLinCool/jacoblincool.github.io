<script lang="ts">
    import { Sparkles } from '@lucide/svelte';
    import Composer from '$lib/components/chat/Composer.svelte';
    import PromptChips from '$lib/components/chat/PromptChips.svelte';
    import TypingTagline from '$lib/components/chat/TypingTagline.svelte';
    import { trackPromptChipClicked } from '$lib/services/analytics/posthog';
    import { chatStore } from '$lib/stores/chat.svelte';
    import type { PromptChip } from '$lib/types/chat';

    const prepare = () => {
        void import('$lib/components/chat/MessageList.svelte').catch(() => undefined);
        chatStore.prepare();
    };

    const handleChipSelect = async (chip: PromptChip) => {
        trackPromptChipClicked(chip.id);
        await chatStore.submitChipPrompt(chip.prompt, {
            source: 'chip',
            sourceId: chip.id
        });
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
</script>

<section
    class={`chat-panel mx-auto w-full max-w-5xl px-1 sm:px-2 ${isIdle ? '' : 'h-full min-h-0'}`}
>
    <div
        aria-hidden="true"
        class={`chat-scrim ${isIdle ? 'chat-scrim-idle' : ''} ${isInteractive ? 'chat-scrim-interactive' : ''}`}
    ></div>

    <div
        class={`chat-stack relative z-10 flex flex-col gap-3 sm:gap-4 ${
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
            {#await import('$lib/components/chat/MessageList.svelte')}
                <div class="min-h-0 flex-1 space-y-3 p-3" role="status">
                    <p
                        class="ml-auto max-w-[90%] rounded-3xl border border-sky-300/22 bg-sky-500/20 px-4 py-3 text-sky-50"
                    >
                        {chatStore.state.messages.findLast((message) => message.role === 'user')
                            ?.content}
                    </p>
                    <p class="flex items-center gap-2 text-sm text-zinc-300">
                        <span class="loading loading-xs loading-spinner" aria-hidden="true"
                        ></span>Connecting…
                    </p>
                </div>
            {:then { default: MessageList }}
                <MessageList
                    messages={chatStore.state.messages}
                    progressEvents={chatStore.state.progressEvents}
                    contextStatusCollapsed={chatStore.state.contextStatusCollapsed}
                    audioState={chatStore.state.audio}
                    onCopy={(messageId) => void chatStore.copyMessage(messageId)}
                    onToggleAudio={(messageId) => chatStore.toggleAudio(messageId)}
                    onToggleContextStatus={() => chatStore.toggleContextStatusCollapsed()}
                    onRetry={(messageId) => void chatStore.retryMessage(messageId)}
                    isStreaming={chatStore.state.isStreaming}
                />
            {:catch}
                <p role="alert" class="p-3 text-sm text-zinc-300">
                    The conversation could not load. Reload the page to try again.
                </p>
            {/await}
        {/if}

        <div class={isIdle ? '' : 'conversation-composer'}>
            <Composer
                value={chatStore.state.composer}
                focusRequest={chatStore.state.composerFocusRequest}
                isStreaming={chatStore.state.isStreaming}
                onPrepare={prepare}
                onStop={() => chatStore.stopResponse()}
                onChange={(value) => chatStore.setComposer(value)}
                onSubmit={handleSubmit}
            />
        </div>

        {#if isIdle}
            <PromptChips
                chips={chatStore.state.promptChips}
                disabled={chatStore.state.isStreaming}
                onSelect={handleChipSelect}
                onPrepare={prepare}
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

    .conversation-composer {
        flex: none;
        width: min(100%, 48rem);
        margin-inline: auto;
        padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
    }
    @media (max-height: 540px) {
        .chat-stack {
            gap: 0.5rem;
        }

        .conversation-composer {
            padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
        }
    }
</style>
