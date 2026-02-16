<script lang="ts">
    import { resolve } from '$app/paths';
    import { Menu } from '@lucide/svelte';
    import UserMenu from '$lib/components/app/UserMenu.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    let {
        sidebarId = 'app-sidebar',
        showSidebar = true
    }: { sidebarId?: string; showSidebar?: boolean } = $props();

    const sidebarExpanded = $derived(
        showSidebar && (uiStore.state.isSidebarOpenDesktop || uiStore.state.isSidebarOpenMobile)
    );
</script>

<header class="sticky top-0 z-20 border-b border-white/8 bg-black/65">
    <div
        class="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-3 sm:px-4 lg:px-6"
    >
        <div class="flex items-center gap-2">
            {#if showSidebar}
                <button
                    type="button"
                    class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/8 hover:text-zinc-100"
                    onclick={() => uiStore.toggleSidebarForViewport()}
                    aria-label="Toggle sidebar"
                    aria-controls={sidebarId}
                    aria-expanded={sidebarExpanded}
                >
                    <Menu size={17} strokeWidth={1.8} />
                </button>
            {/if}

            <a
                href={resolve('/')}
                class="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-zinc-100/90 focus-visible:ring-2 focus-visible:ring-zinc-300/70 focus-visible:outline-none"
            >
                <img src="/logo.svg" alt="Jacob Lin logo" class="h-6 w-6" />
                <span class="text-sm font-medium tracking-tight">Jacob Lin</span>
            </a>
        </div>

        <UserMenu />
    </div>
</header>
