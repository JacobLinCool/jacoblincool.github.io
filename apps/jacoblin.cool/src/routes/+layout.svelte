<script lang="ts">
    import TopBar from '$lib/components/app/TopBar.svelte';
    import Sidebar from '$lib/components/app/Sidebar.svelte';
    import Notifications from '$lib/components/app/Notifications.svelte';
    import LoginModal from '$lib/components/auth/LoginModal.svelte';
    import ProfileModal from '$lib/components/app/ProfileModal.svelte';
    import NeuralBackground from '$lib/components/visual/NeuralBackground.svelte';
    import { chatStore } from '$lib/stores/chat.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { userStore } from '$lib/stores/user.svelte';
    import { onMount } from 'svelte';
    import './layout.css';
    import favicon from '$lib/assets/favicon.png?url';

    let { children } = $props();

    const sidebarId = 'app-sidebar';
    const showSidebar = false;

    onMount(() => {
        const cleanupUserStore = userStore.init();
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
            cleanupUserStore?.();
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('resize', handleResize);
        };
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <meta name="theme-color" content="#010204" />
</svelte:head>

<div class="app-shell">
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <NeuralBackground
        backgroundEventId={chatStore.state.backgroundEventId}
        backgroundEventType={chatStore.state.backgroundEventType}
        backgroundEventStrength={chatStore.state.backgroundEventStrength}
        isStreaming={chatStore.state.isStreaming}
    />

    <div class="relative z-10 flex h-dvh min-h-dvh flex-col">
        <TopBar {sidebarId} {showSidebar} />

        <div class="flex min-h-0 flex-1">
            {#if showSidebar}
                <Sidebar id={sidebarId} />
            {/if}
            <main
                id="main-content"
                class={`app-main min-h-0 flex-1 ${
                    chatStore.state.conversationStage === 'active'
                        ? 'app-main-active overflow-y-hidden'
                        : 'overflow-y-auto'
                }`}
            >
                <div
                    class={`app-content mx-auto box-border w-full max-w-245 px-4 lg:px-8 ${
                        chatStore.state.conversationStage === 'active'
                            ? 'h-full min-h-0 pt-2 pb-1 sm:pt-3 sm:pb-2'
                            : 'pt-8 pb-8 sm:pt-10 lg:pb-12'
                    }`}
                >
                    {@render children()}
                </div>
            </main>
        </div>
    </div>

    <LoginModal />
    <ProfileModal />
    <Notifications />
</div>
