<script lang="ts">
    import { browser } from '$app/environment';
    import { Compass, Settings, SquarePen, X } from '@lucide/svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    let { id }: { id: string } = $props();

    $effect(() => {
        if (!browser || !uiStore.state.isSidebarOpenMobile) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                uiStore.closeMobileSidebar();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    });
</script>

<aside
    {id}
    aria-label="Sidebar"
    class={`hidden border-r border-white/8 bg-zinc-950/72 backdrop-blur-xl lg:flex lg:flex-col lg:overflow-hidden lg:transition-[width] lg:duration-300 ${uiStore.state.isSidebarOpenDesktop ? 'lg:w-56' : 'lg:w-14'}`}
>
    <div class="flex h-full flex-col items-center gap-3 px-2 py-3">
        <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 text-zinc-300 transition hover:bg-white/7"
            aria-label="New conversation"
        >
            <SquarePen size={16} strokeWidth={1.8} />
        </button>

        <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 text-zinc-300 transition hover:bg-white/7"
            aria-label="Discover"
        >
            <Compass size={16} strokeWidth={1.8} />
        </button>

        {#if uiStore.state.isSidebarOpenDesktop}
            <div
                class="w-full rounded-2xl border border-dashed border-white/12 bg-white/2 px-3 py-3 text-xs leading-6 text-zinc-400"
            >
                Sidebar is intentionally empty for now.
            </div>
        {/if}

        <div class="mt-auto">
            <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 text-zinc-400 transition hover:bg-white/7 hover:text-zinc-200"
                aria-label="Settings"
            >
                <Settings size={16} strokeWidth={1.8} />
            </button>
        </div>
    </div>
</aside>

{#if uiStore.state.isSidebarOpenMobile}
    <button
        type="button"
        class="fixed inset-0 z-30 bg-black/55 backdrop-blur-[1px] lg:hidden"
        onclick={() => uiStore.closeMobileSidebar()}
        aria-label="Close sidebar"
    ></button>

    <aside
        id={`${id}-mobile`}
        aria-label="Sidebar"
        class="fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r border-white/10 bg-zinc-950/96 p-4 backdrop-blur-xl lg:hidden"
    >
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-medium tracking-wide text-zinc-200">Sidebar</h2>
            <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/8"
                onclick={() => uiStore.closeMobileSidebar()}
                aria-label="Close sidebar"
            >
                <X size={16} strokeWidth={1.8} />
            </button>
        </div>

        <div
            class="rounded-2xl border border-dashed border-white/14 bg-white/2 p-4 text-sm text-zinc-300"
        >
            Sidebar placeholder. Future navigation modules will appear here.
        </div>
    </aside>
{/if}
