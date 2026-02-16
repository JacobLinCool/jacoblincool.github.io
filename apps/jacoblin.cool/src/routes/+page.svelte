<script lang="ts">
    import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
    import { chatStore } from '$lib/stores/chat.svelte';

    const isIdle = $derived(chatStore.state.conversationStage === 'idle');
</script>

<div
    class={`page-shell flex justify-center ${
        isIdle
            ? 'min-h-[calc(100dvh-8rem)] items-center py-4 sm:py-8'
            : 'h-full min-h-0 items-start py-1 sm:py-2'
    }`}
>
    <div
        class={`panel-shift w-full ${isIdle ? 'panel-shift-idle' : 'panel-shift-active h-full min-h-0'}`}
    >
        <ChatPanel />
    </div>
</div>

<style>
    .page-shell {
        transition: padding 320ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-shift {
        transition: margin 340ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-shift-idle {
        margin-top: 0;
    }

    .panel-shift-active {
        margin-top: 0;
    }

    @media (min-width: 1024px) {
        .panel-shift-active {
            margin-top: 0;
        }
    }
</style>
