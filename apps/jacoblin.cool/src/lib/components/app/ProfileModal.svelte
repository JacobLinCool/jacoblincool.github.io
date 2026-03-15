<script lang="ts">
    import { browser } from '$app/environment';
    import { X, UserRound } from '@lucide/svelte';
    import { BADGE_REGISTRY } from '$lib/config/badges';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { userStore } from '$lib/stores/user.svelte';

    let modalRef = $state<HTMLElement | null>(null);
    let closeButtonRef = $state<HTMLButtonElement | null>(null);
    let previousFocusedElement: HTMLElement | null = null;

    const profile = $derived(userStore.state.profile);
    const user = $derived(userStore.state.user);
    const avatar = $derived(user?.photoURL ?? null);
    const displayName = $derived(profile?.displayName ?? user?.displayName ?? null);
    const email = $derived(profile?.email ?? user?.email ?? null);

    const resolvedBadges = $derived(
        (profile?.badges ?? [])
            .map((slug) => {
                const def = BADGE_REGISTRY[slug];
                return def ? { slug, ...def } : null;
            })
            .filter((b) => b != null)
    );

    const closeModal = () => {
        uiStore.closeProfileModal();
    };

    const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const trapFocus = (event: KeyboardEvent) => {
        if (!modalRef) return;

        const focusables = Array.from(
            modalRef.querySelectorAll<HTMLElement>(focusableSelectors)
        ).filter((node) => !node.hasAttribute('hidden'));

        if (focusables.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    $effect(() => {
        if (!browser || !uiStore.state.isProfileModalOpen) return;

        previousFocusedElement = document.activeElement as HTMLElement | null;

        queueMicrotask(() => {
            closeButtonRef?.focus();
        });

        const onKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeModal();
                return;
            }
            if (event.key === 'Tab') {
                trapFocus(event);
            }
        };

        document.addEventListener('keydown', onKeydown);
        return () => {
            document.removeEventListener('keydown', onKeydown);
            previousFocusedElement?.focus();
        };
    });
</script>

{#if uiStore.state.isProfileModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <button
            type="button"
            class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onclick={closeModal}
            aria-label="Close profile modal"
        ></button>

        <div
            bind:this={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            class="relative w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
            <div class="mb-5 flex items-start justify-between">
                <h2 id="profile-title" class="text-lg font-semibold text-slate-50">Profile</h2>
                <button
                    bind:this={closeButtonRef}
                    type="button"
                    class="btn h-9 w-9 rounded-xl btn-ghost btn-sm"
                    onclick={closeModal}
                    aria-label="Close profile modal"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>

            <div class="flex flex-col items-center gap-3 text-center">
                <span
                    class="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-200 ring-2 ring-white/10"
                >
                    {#if avatar}
                        <img src={avatar} alt="Profile" class="h-full w-full object-cover" />
                    {:else}
                        <UserRound size={36} strokeWidth={1.3} />
                    {/if}
                </span>

                {#if displayName}
                    <p class="text-lg font-medium text-zinc-100">{displayName}</p>
                {/if}
                {#if email}
                    <p class="-mt-2 text-sm text-zinc-400">{email}</p>
                {/if}
            </div>

            {#if resolvedBadges.length > 0}
                <div class="mt-5 border-t border-white/10 pt-4">
                    <p class="mb-2 text-xs tracking-wide text-zinc-500 uppercase">Badges</p>
                    <div class="flex flex-wrap gap-2">
                        {#each resolvedBadges as badge (badge.slug)}
                            <span
                                class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300"
                                title={badge.description}
                            >
                                {#if badge.icon}<span>{badge.icon}</span>{/if}
                                {badge.label}
                            </span>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}
