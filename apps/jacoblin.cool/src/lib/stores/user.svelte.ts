import { browser } from '$app/environment';
import { page } from '$app/state';
import { auth, db } from '$lib/firebase/client';
import { notificationStore } from '$lib/stores/notification.svelte';
import {
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    signInWithEmailLink,
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

const EMAIL_LINK_STORAGE_KEY = 'auth.emailForSignIn';

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
                this.setProfileListener(user.uid);
            } else {
                this.profileUnsubscribe?.();
                this.profileUnsubscribe = null;
                this.state.profile = null;
                this.state.profileLoading = false;
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

    async sendMagicLink(email: string) {
        if (!browser) return;
        this.state.authError = null;
        this.state.message = null;

        const actionCodeSettings = {
            url: `${page.url.origin}/auth/complete`,
            handleCodeInApp: true
        };

        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
        this.state.message = 'Magic link sent. Check your inbox to continue.';
        notificationStore.success(this.state.message);
    }

    async completeMagicLink(email: string | null, url: string) {
        if (!browser) return false;
        this.state.authError = null;
        this.state.message = null;

        if (!isSignInWithEmailLink(auth, url)) {
            this.state.authError = 'This sign-in link is invalid or expired.';
            notificationStore.error(this.state.authError);
            return false;
        }

        const storedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
        const emailForSignIn = email || storedEmail || '';

        if (!emailForSignIn) {
            this.state.authError = 'Please enter your email to finish sign-in.';
            notificationStore.error(this.state.authError);
            return false;
        }

        const result = await signInWithEmailLink(auth, emailForSignIn, url);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        this.state.message = `Signed in as ${result.user.email ?? 'user'}.`;
        notificationStore.success(this.state.message);
        return true;
    }

    async signOut() {
        this.state.authError = null;
        this.state.message = null;
        await signOut(auth);
        notificationStore.info('Signed out.');
    }
}

export const userStore = UserStore.getInstance();
