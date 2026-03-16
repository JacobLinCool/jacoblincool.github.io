<script lang="ts">
    import { browser } from '$app/environment';
    import { ChevronDown, LogIn, LogOut, UserRound } from '@lucide/svelte';
    import { trackLoginModalOpened } from '$lib/services/analytics/ga';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { userStore } from '$lib/stores/user.svelte';

    let panelRef = $state<HTMLDivElement | null>(null);
    let triggerRef = $state<HTMLButtonElement | null>(null);

    const user = $derived(userStore.state.user);
    const isAuthed = $derived(Boolean(user && !user.isAnonymous));
    const userAvatar = $derived(isAuthed ? (user?.photoURL ?? null) : null);
    const isSheet = $derived(uiStore.state.accountMenuPresentation === 'sheet');

    const displayName = $derived(isAuthed ? (user?.displayName ?? null) : null);
    const email = $derived(isAuthed ? (user?.email ?? null) : null);

    $effect(() => {
        if (!browser || !uiStore.state.isUserMenuOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                uiStore.closeUserMenu();
                triggerRef?.focus();
            }
        };

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (isSheet) {
                return;
            }

            const target = event.target as Node;
            if (!panelRef?.contains(target) && !triggerRef?.contains(target)) {
                uiStore.closeUserMenu();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    });

    const openLoginModal = () => {
        uiStore.closeUserMenu();
        trackLoginModalOpened();
        uiStore.openLoginModal();
    };

    const handleSignOut = async () => {
        await userStore.signOut();
        uiStore.closeUserMenu();
    };
</script>

{#snippet profileSummary()}
    <div class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left">
        <span
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-200"
        >
            {#if userAvatar}
                <img src={userAvatar} alt="Profile" class="h-full w-full object-cover" />
            {:else}
                <UserRound size={20} strokeWidth={1.5} />
            {/if}
        </span>
        <div class="min-w-0">
            {#if displayName}
                <p class="truncate text-sm font-medium text-zinc-100">{displayName}</p>
            {/if}
            {#if email}
                <p class="truncate text-xs text-zinc-400">{email}</p>
            {/if}
        </div>
    </div>
{/snippet}

<div class="relative">
    <button
        bind:this={triggerRef}
        type="button"
        class="inline-flex h-9 items-center gap-1 rounded-full border border-white/12 bg-white/3 px-1 text-zinc-200 transition hover:border-white/20 hover:bg-white/6"
        onclick={() => uiStore.toggleUserMenu()}
        aria-haspopup="menu"
        aria-expanded={uiStore.state.isUserMenuOpen}
        aria-label="Open account menu"
    >
        <span
            class="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-200"
        >
            {#if userAvatar}
                <img src={userAvatar} alt="Profile" class="h-full w-full object-cover" />
            {:else}
                <UserRound size={15} strokeWidth={1.7} />
            {/if}
        </span>
        <ChevronDown size={14} strokeWidth={1.7} class="mr-1 text-zinc-400" />
    </button>

    {#if uiStore.state.isUserMenuOpen && !isSheet}
        <div
            bind:this={panelRef}
            role="menu"
            class="absolute top-11 right-0 z-30 w-56 rounded-2xl border border-white/12 bg-zinc-950/96 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
            {#if isAuthed}
                {@render profileSummary()}

                <div class="mt-1 border-t border-white/8 pt-1">
                    <button
                        type="button"
                        class="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/8"
                        onclick={handleSignOut}
                        role="menuitem"
                    >
                        <LogOut size={16} strokeWidth={1.8} class="text-zinc-300" />
                        Sign out
                    </button>
                </div>
            {:else}
                <button
                    type="button"
                    class="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/8"
                    onclick={openLoginModal}
                    role="menuitem"
                >
                    <LogIn size={16} strokeWidth={1.8} class="text-zinc-300" />
                    Sign in
                </button>
            {/if}
        </div>
    {/if}
</div>

{#if uiStore.state.isUserMenuOpen && isSheet}
    <div class="fixed inset-0 z-40 sm:hidden">
        <button
            type="button"
            class="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
            onclick={() => uiStore.closeUserMenu()}
            aria-label="Close account menu"
        ></button>

        <div
            bind:this={panelRef}
            role="menu"
            class="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/12 bg-zinc-950/96 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
            <p class="mb-3 px-1 text-xs tracking-[0.18em] text-zinc-500 uppercase">Account</p>

            {#if isAuthed}
                <div class="mb-2">
                    {@render profileSummary()}
                </div>

                <button
                    type="button"
                    class="inline-flex h-11 w-full items-center gap-2 rounded-xl border border-white/12 px-3 text-sm text-zinc-100 transition hover:bg-white/8"
                    onclick={handleSignOut}
                    role="menuitem"
                >
                    <LogOut size={16} strokeWidth={1.8} class="text-zinc-300" />
                    Sign out
                </button>
            {:else}
                <button
                    type="button"
                    class="inline-flex h-11 w-full items-center gap-2 rounded-xl border border-white/12 px-3 text-sm text-zinc-100 transition hover:bg-white/8"
                    onclick={openLoginModal}
                    role="menuitem"
                >
                    <LogIn size={16} strokeWidth={1.8} class="text-zinc-300" />
                    Sign in
                </button>
            {/if}
        </div>
    </div>
{/if}
