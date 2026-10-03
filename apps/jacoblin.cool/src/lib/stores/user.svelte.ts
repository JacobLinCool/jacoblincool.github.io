import { browser } from '$app/environment';
import {
    identifyAnalyticsUser,
    resetAnalyticsUser,
    setAnalyticsAuthState
} from '$lib/services/analytics/posthog';
import { loadAuthClient } from '$lib/services/auth-session';
import { notificationStore } from '$lib/stores/notification.svelte';
import type { User } from 'firebase/auth';

class UserStore {
    static instance: UserStore | null = null;
    state = $state<{ user: User | null; loading: boolean }>({ user: null, loading: true });
    private observerPromise: Promise<void> | null = null;

    static getInstance() {
        UserStore.instance ??= new UserStore();
        return UserStore.instance;
    }

    /** The account observer lives for the browser session, including route changes. */
    private observeAuth() {
        this.observerPromise ??= Promise.all([loadAuthClient(), import('firebase/auth')])
            .then(([{ auth }, { onAuthStateChanged }]) => {
                onAuthStateChanged(auth, (user) => {
                    const previousUser = this.state.user;
                    if (
                        previousUser &&
                        !previousUser.isAnonymous &&
                        previousUser.uid !== user?.uid
                    ) {
                        resetAnalyticsUser();
                    }
                    this.state.user = user;
                    this.state.loading = false;
                    setAnalyticsAuthState(
                        user ? (user.isAnonymous ? 'anonymous' : 'google') : 'signed_out'
                    );
                    if (user && !user.isAnonymous) identifyAnalyticsUser(user.uid);
                });
            })
            .catch((error) => {
                this.observerPromise = null;
                this.state.loading = false;
                throw error;
            });
        return this.observerPromise;
    }

    init() {
        if (!browser) return;
        // A failed passive restoration can be retried by chat/account intent.
        void this.observeAuth().catch(() => undefined);
    }

    prepare() {
        this.init();
    }

    async signInWithGoogle() {
        await this.observeAuth();
        const [{ auth }, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([
            loadAuthClient(),
            import('firebase/auth')
        ]);
        await signInWithPopup(auth, new GoogleAuthProvider());
    }

    async signOut() {
        await this.observeAuth();
        const [{ auth }, { signOut }] = await Promise.all([
            loadAuthClient(),
            import('firebase/auth')
        ]);
        await signOut(auth);
        notificationStore.info('Signed out.');
    }
}

export const userStore = UserStore.getInstance();
