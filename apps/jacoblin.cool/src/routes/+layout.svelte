<script lang="ts">
    import TopBar from '$lib/components/app/TopBar.svelte';
    import Sidebar from '$lib/components/app/Sidebar.svelte';
    import SiteFooter from '$lib/components/app/SiteFooter.svelte';
    import Notifications from '$lib/components/app/Notifications.svelte';
    import LoginModal from '$lib/components/auth/LoginModal.svelte';
    import SpecialOccasionEffects from '$lib/components/visual/SpecialOccasionEffects.svelte';
    import NeuralBackground from '$lib/components/visual/NeuralBackground.svelte';
    import { chatStore } from '$lib/stores/chat.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { userStore } from '$lib/stores/user.svelte';
    import { onMount } from 'svelte';
    import './layout.css';
    import favicon from '$lib/assets/favicon.png?url';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import { deLocalizeUrl } from '$lib/paraglide/runtime';

    let { children } = $props();

    const sidebarId = 'app-sidebar';
    const showSidebar = false;
    const isHome = $derived(deLocalizeUrl(page.url).pathname === '/');
    const activeChat = $derived(isHome && chatStore.state.conversationStage === 'active');

    $effect(() => {
        if (isHome) return userStore.init();
    });

    onMount(() => {
        uiStore.syncAccountMenuPresentation();

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                uiStore.closeTransientUi();
            }
        };

        const handleResize = () => {
            uiStore.syncAccountMenuPresentation();
        };

        window.addEventListener('keydown', handleEscape);
        window.addEventListener('resize', handleResize, { passive: true });
        return () => {
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('resize', handleResize);
        };
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <meta name="theme-color" content="#010204" />
    <link
        rel="alternate"
        type="application/rss+xml"
        title="Jacob Lin — Blog"
        href={resolve('/blog/rss.xml')}
    />
</svelte:head>

<div class="app-shell">
    <a href="#main-content" class="skip-link">Skip to main content</a>

    {#if isHome}<NeuralBackground
            backgroundEventId={chatStore.state.backgroundEventId}
            backgroundEventType={chatStore.state.backgroundEventType}
            backgroundEventStrength={chatStore.state.backgroundEventStrength}
            isStreaming={chatStore.state.isStreaming}
        />
        <SpecialOccasionEffects />{/if}

    <div class={`relative z-10 flex min-h-dvh flex-col ${isHome ? 'h-dvh' : ''}`}>
        <TopBar {sidebarId} {showSidebar} showAccountMenu={isHome} />

        <div class="flex min-h-0 flex-1">
            {#if showSidebar}
                <Sidebar id={sidebarId} />
            {/if}
            <main
                id="main-content"
                class={`app-main min-h-0 min-w-0 flex-1 ${
                    isHome
                        ? activeChat
                            ? 'app-main-active overflow-y-auto'
                            : 'overflow-y-auto'
                        : ''
                }`}
            >
                <div
                    class={`app-content mx-auto box-border w-full max-w-245 px-4 lg:px-8 ${
                        activeChat
                            ? 'h-full min-h-0 pt-2 pb-1 sm:pt-3 sm:pb-2'
                            : 'pt-8 pb-8 sm:pt-10 lg:pb-12'
                    }`}
                >
                    {@render children()}
                    <SiteFooter />
                </div>
            </main>
        </div>
    </div>

    {#if isHome}<LoginModal />{/if}
    <Notifications />
</div>
