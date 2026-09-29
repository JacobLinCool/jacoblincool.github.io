<script lang="ts">
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { deLocalizeUrl } from '$lib/paraglide/runtime';
    import { Menu } from '@lucide/svelte';
    import UserMenu from '$lib/components/app/UserMenu.svelte';
    import { siteConfig } from '$lib/config/site';
    import { uiStore } from '$lib/stores/ui.svelte';

    let {
        sidebarId = 'app-sidebar',
        showSidebar = true,
        showAccountMenu = true
    }: { sidebarId?: string; showSidebar?: boolean; showAccountMenu?: boolean } = $props();

    const sidebarExpanded = $derived(
        showSidebar && (uiStore.state.isSidebarOpenDesktop || uiStore.state.isSidebarOpenMobile)
    );
    const pathname = $derived(deLocalizeUrl(page.url).pathname);
</script>

<header class="sticky top-0 z-20 border-b border-white/8 bg-black/65">
    <div
        class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6"
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
                <img src="/logo.svg" alt={siteConfig.identity.logoAlt} class="h-6 w-6" />
                <span class="text-sm font-medium tracking-tight">{siteConfig.identity.name}</span>
            </a>
        </div>

        <div class="flex items-center gap-2 sm:gap-5">
            <nav aria-label="Main navigation" class="flex items-center gap-1 sm:gap-3">
                <a
                    href={resolve('/publications')}
                    aria-current={pathname === '/publications' ? 'page' : undefined}
                    class="nav-link">Publications</a
                >
                <a
                    href={resolve('/blog')}
                    aria-current={pathname.startsWith('/blog') ? 'page' : undefined}
                    class="nav-link">Blog</a
                >
            </nav>
            {#if showAccountMenu}<UserMenu />{/if}
        </div>
    </div>
</header>

<style>
    .nav-link {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding-inline: 0.4rem;
        font-size: 0.8125rem;
        color: #d4d4d8;
        text-decoration: none;
    }
    .nav-link:hover,
    .nav-link[aria-current='page'] {
        color: #a7f3d0;
    }
    .nav-link[aria-current='page'] {
        text-decoration: underline;
        text-underline-offset: 0.4em;
    }
</style>
