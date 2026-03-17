import { browser } from '$app/environment';
import { auth } from '$lib/firebase/client';
import { setAnalyticsAuthState } from '$lib/services/analytics/posthog';
import { notificationStore } from '$lib/stores/notification.svelte';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    signOut,
    type User
} from 'firebase/auth';
import posthog from 'posthog-js';

class UserStore {
    static instance: UserStore | null = null;
    state = $state<{
        user: User | null;
        loading: boolean;
    }>({
        user: null,
        loading: true
    });

    private authUnsubscribe: (() => void) | null = null;
    private anonymousBootstrapAttempted = false;

    static getInstance() {
        UserStore.instance ??= new UserStore();
        return UserStore.instance;
    }

    init() {
        if (!browser || this.authUnsubscribe) {
            return () => undefined;
        }

        this.state.loading = true;
        this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
            this.state.user = user;
            this.state.loading = false;

            if (user) {
                setAnalyticsAuthState(user.isAnonymous ? 'anonymous' : 'google');
                if (!user.isAnonymous) {
                    posthog.identify(user.uid);
                }
                this.anonymousBootstrapAttempted = true;
            } else {
                posthog.reset();
                setAnalyticsAuthState('signed_out');
                if (!this.anonymousBootstrapAttempted) {
                    this.anonymousBootstrapAttempted = true;
                    void signInAnonymously(auth).catch((error) => {
                        notificationStore.error(
                            error instanceof Error
                                ? error.message
                                : 'Unable to initialize anonymous auth.'
                        );
                    });
                }
            }
        });

        return () => {
            this.authUnsubscribe?.();
            this.authUnsubscribe = null;
        };
    }

    async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    }

    async signOut() {
        await signOut(auth);
        notificationStore.info('Signed out.');
    }
}

export const userStore = UserStore.getInstance();
