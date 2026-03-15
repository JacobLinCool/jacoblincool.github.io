<script lang="ts">
    import DemoLabSection from '$lib/components/home/DemoLabSection.svelte';
    import EngineeringImpactSection from '$lib/components/home/EngineeringImpactSection.svelte';
    import NextStepsCtaSection from '$lib/components/home/NextStepsCtaSection.svelte';
    import PublicationsTimelineSection from '$lib/components/home/PublicationsTimelineSection.svelte';
    import ResearchQuestionsSection from '$lib/components/home/ResearchQuestionsSection.svelte';
    import '$lib/components/home/home-wide-rails.css';
    import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
    import { chatStore } from '$lib/stores/chat.svelte';
    import { engageHeroChat } from '$lib/utils/hero-chat-bridge';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    $effect(() => {
        chatStore.hydrateChatConfig(data.home.chatConfig);
    });

    const isIdle = $derived(chatStore.state.conversationStage === 'idle');
    const ctaDisabled = $derived(chatStore.state.isStreaming);

    const handleDeepDive = async (promptId: string) => {
        if (chatStore.state.isStreaming) {
            return;
        }

        const prompt = data.home.chatConfig.deepDivePrompts[promptId]?.prompt;
        if (!prompt) {
            return;
        }

        await engageHeroChat(prompt);
    };
</script>

<section id="hero-chat" class={`hero-chat-shell ${isIdle ? '' : 'hero-chat-active'}`}>
    <div
        class={`page-shell flex justify-center ${
            isIdle
                ? 'min-h-[calc(100dvh-8rem)] items-center py-4 sm:py-8'
                : 'h-full min-h-0 items-stretch overflow-hidden py-1 sm:py-2'
        }`}
    >
        <div
            class={`panel-shift w-full ${
                isIdle ? 'panel-shift-idle' : 'panel-shift-active h-full min-h-0 overflow-hidden'
            }`}
        >
            <ChatPanel />
        </div>
    </div>
</section>

<div class="home-sections home-sections-breakout mt-14 flex w-full flex-col gap-10 pb-16 sm:mt-16 sm:gap-12 sm:pb-20 lg:gap-14 lg:pb-24">
    <ResearchQuestionsSection
        questions={data.home.homePayload.researchQuestions}
        onDeepDive={handleDeepDive}
        disabled={ctaDisabled}
    />

    <PublicationsTimelineSection
        publications={data.home.homePayload.publications}
        onAskPaper={handleDeepDive}
        disabled={ctaDisabled}
    />

    <EngineeringImpactSection
        projects={data.home.homePayload.projects}
        metrics={data.home.homePayload.metrics.github}
        onDeepDive={handleDeepDive}
        disabled={ctaDisabled}
    />

    <DemoLabSection
        demos={data.home.homePayload.demos}
        metrics={data.home.homePayload.metrics.huggingface}
        onDeepDive={handleDeepDive}
        disabled={ctaDisabled}
    />

    <NextStepsCtaSection
        nextSteps={data.home.homePayload.nextSteps}
        scholar={data.home.homePayload.metrics.scholar}
        onDeepDive={handleDeepDive}
        disabled={ctaDisabled}
    />
</div>

<style>
    .hero-chat-shell {
        position: relative;
    }

    .home-sections-breakout {
        --chapter-min-h: auto;
        --chapter-gap: clamp(2.5rem, 5vw, 4.5rem);
        position: relative;
        left: 0;
        width: 100%;
        max-width: none;
        transform: none;
        gap: var(--chapter-gap);
    }

    .home-sections-breakout :global(.section-shell) {
        scroll-margin-top: calc(3.5rem + 1rem);
    }

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

    .hero-chat-active {
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    .hero-chat-active :global(.composer-docked) {
        position: absolute;
        left: 50%;
        bottom: calc(0.85rem + env(safe-area-inset-bottom));
        width: min(calc(100% - 1rem), 48rem);
        transform: translateX(-50%);
        z-index: 25;
    }

    .hero-chat-active :global(.chat-panel > .relative.z-10) {
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    .hero-chat-active :global(.chat-panel > .relative.z-10 > .overflow-y-auto.rounded-3xl) {
        min-height: 0;
        max-height: none;
        height: 100%;
    }

    @media (min-width: 640px) {
        .hero-chat-active :global(.composer-docked) {
            width: min(calc(100% - 1.5rem), 48rem);
            bottom: 1rem;
        }
    }

    @media (min-width: 1280px) {
        .home-sections-breakout {
            --home-wide-max: 1680px;
            --home-wide-gutter: clamp(16px, 3.5vw, 72px);
            --chapter-min-h: calc(100dvh - 3.5rem - clamp(0.75rem, 1.5vh, 1.25rem));
            --chapter-gap: clamp(5rem, 10vh, 8rem);
            left: 50%;
            width: min(var(--home-wide-max), calc(100vw - (var(--home-wide-gutter) * 2)));
            transform: translateX(-50%);
            gap: var(--chapter-gap);
        }

        .home-sections-breakout :global(.section-shell) {
            min-height: var(--chapter-min-h);
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            padding-block: clamp(2.5rem, 5.2vh, 4.75rem);
        }
    }
</style>
