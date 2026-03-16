import { browser } from '$app/environment';
import { auth, db } from '$lib/firebase/client';
import { notificationStore } from '$lib/stores/notification.svelte';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    signOut,
    type User
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export type UserProfile = {
    id: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    badges?: string[];
    createdAt?: string | null;
};

class UserStore {
    static instance: UserStore | null = null;
    state = $state<{
        user: User | null;
        profile: UserProfile | null;
        loading: boolean;
        profileLoading: boolean;
        authError: string | null;
        message: string | null;
    }>({
        user: null,
        profile: null,
        loading: true,
        profileLoading: true,
        authError: null,
        message: null
    });

    private authUnsubscribe: (() => void) | null = null;
    private profileUnsubscribe: (() => void) | null = null;
    private anonymousBootstrapAttempted = false;

    static getInstance() {
        UserStore.instance ??= new UserStore();
        return UserStore.instance;
    }

    private setProfileListener(uid: string) {
        this.profileUnsubscribe?.();
        this.state.profile = null;
        this.state.profileLoading = true;

        const profileRef = doc(db, 'profiles', uid);
        this.profileUnsubscribe = onSnapshot(
            profileRef,
            (snapshot) => {
                this.state.profile = snapshot.exists()
                    ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
                    : null;
                this.state.profileLoading = false;
            },
            (error) => {
                this.state.profile = null;
                this.state.profileLoading = false;
                this.state.authError = error.message;
                notificationStore.error(error.message);
            }
        );
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
                this.anonymousBootstrapAttempted = true;
                if (user.isAnonymous) {
                    this.profileUnsubscribe?.();
                    this.profileUnsubscribe = null;
                    this.state.profile = null;
                    this.state.profileLoading = false;
                } else {
                    this.setProfileListener(user.uid);
                }
            } else {
                this.profileUnsubscribe?.();
                this.profileUnsubscribe = null;
                this.state.profile = null;
                this.state.profileLoading = false;

                if (!this.anonymousBootstrapAttempted) {
                    this.anonymousBootstrapAttempted = true;
                    void signInAnonymously(auth).catch((error) => {
                        this.state.authError =
                            error instanceof Error
                                ? error.message
                                : 'Unable to initialize anonymous auth.';
                    });
                }
            }
        });

        return () => {
            this.authUnsubscribe?.();
            this.authUnsubscribe = null;
            this.profileUnsubscribe?.();
            this.profileUnsubscribe = null;
        };
    }

    async signInWithGoogle() {
        this.state.authError = null;
        this.state.message = null;

        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    }

    async signOut() {
        this.state.authError = null;
        this.state.message = null;
        await signOut(auth);
        notificationStore.info('Signed out.');
    }
}

export const userStore = UserStore.getInstance();
