import { browser } from '$app/environment';
import { chatStore } from '$lib/stores/chat.svelte';

const HERO_CHAT_ANCHOR_ID = 'hero-chat';

const wait = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

export const engageHeroChat = async (prompt: string): Promise<void> => {
    if (!prompt.trim() || chatStore.state.isStreaming) {
        return;
    }

    if (browser) {
        const target = document.getElementById(HERO_CHAT_ANCHOR_ID);
        const mainScroller = document.getElementById('main-content');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (target) {
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement) {
                activeElement.blur();
            }

            if (mainScroller) {
                const targetTop =
                    target.getBoundingClientRect().top -
                    mainScroller.getBoundingClientRect().top +
                    mainScroller.scrollTop;
                mainScroller.scrollTo({
                    top: targetTop,
                    behavior: prefersReducedMotion ? 'auto' : 'smooth'
                });
            } else {
                target.scrollIntoView({
                    behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    block: 'start'
                });
            }

            await wait(prefersReducedMotion ? 24 : 460);
        }
    }

    await chatStore.submitChipPrompt(prompt);
};
