<script lang="ts">
    import { browser } from '$app/environment';
    import { X } from '@lucide/svelte';
    import { notificationStore } from '$lib/stores/notification.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { userStore } from '$lib/stores/user.svelte';

    let modalRef = $state<HTMLElement | null>(null);
    let closeButtonRef = $state<HTMLButtonElement | null>(null);
    let previousFocusedElement: HTMLElement | null = null;
    let isSubmitting = $state(false);

    const closeModal = () => {
        uiStore.closeLoginModal();
    };

    const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const trapFocus = (event: KeyboardEvent) => {
        if (!modalRef) {
            return;
        }

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
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    $effect(() => {
        if (!browser || !uiStore.state.isLoginModalOpen) {
            return;
        }

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

    const handleGoogleSignIn = async () => {
        isSubmitting = true;
        try {
            await userStore.signInWithGoogle();
            notificationStore.success('Signed in with Google.');
            closeModal();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unable to start Google sign-in.';
            notificationStore.warning(message);
        } finally {
            isSubmitting = false;
        }
    };
</script>

{#if uiStore.state.isLoginModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <button
            type="button"
            class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onclick={closeModal}
            aria-label="Close login modal"
        ></button>

        <div
            bind:this={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            class="relative w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
            <div class="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs tracking-[0.2em] text-cyan-200/70 uppercase">Account</p>
                    <h2 id="login-title" class="mt-2 text-2xl font-semibold text-slate-50">
                        Sign in
                    </h2>
                    <p class="mt-1 text-sm text-slate-300">
                        Continue with your identity to keep your current conversation available
                        across sessions.
                    </p>
                </div>

                <button
                    bind:this={closeButtonRef}
                    type="button"
                    class="btn h-9 w-9 rounded-xl btn-ghost btn-sm"
                    onclick={closeModal}
                    aria-label="Close login modal"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>

            <button
                type="button"
                class="btn h-12 w-full rounded-2xl border border-white/15 bg-white/10 text-slate-50 hover:bg-white/20"
                onclick={handleGoogleSignIn}
                disabled={isSubmitting}
            >
                <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                    <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.2 14.7 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z"
                    />
                </svg>
                <span>{isSubmitting ? 'Opening...' : 'Continue with Google'}</span>
            </button>
        </div>
    </div>
{/if}
