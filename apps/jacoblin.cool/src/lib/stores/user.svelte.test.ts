import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadAuthClient: vi.fn(),
    onAuthStateChanged: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    resetAnalyticsUser: vi.fn(),
    identifyAnalyticsUser: vi.fn(),
    setAnalyticsAuthState: vi.fn()
}));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/services/auth-session', () => ({ loadAuthClient: mocks.loadAuthClient }));
vi.mock('$lib/services/analytics/posthog', () => ({
    resetAnalyticsUser: mocks.resetAnalyticsUser,
    identifyAnalyticsUser: mocks.identifyAnalyticsUser,
    setAnalyticsAuthState: mocks.setAnalyticsAuthState
}));
vi.mock('$lib/stores/notification.svelte', () => ({ notificationStore: { info: vi.fn() } }));
vi.mock('firebase/auth', () => ({
    onAuthStateChanged: mocks.onAuthStateChanged,
    signInWithPopup: mocks.signInWithPopup,
    signOut: mocks.signOut,
    GoogleAuthProvider: class {}
}));

beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.loadAuthClient.mockResolvedValue({ auth: {} });
    mocks.onAuthStateChanged.mockReturnValue(vi.fn());
});

describe('account session observer', () => {
    it('recovers a failed passive initialization before an explicit sign-in', async () => {
        mocks.loadAuthClient.mockRejectedValueOnce(new Error('chunk unavailable'));
        const { userStore } = await import('./user.svelte');
        userStore.init();
        await vi.waitFor(() => expect(userStore.state.loading).toBe(false));
        expect(mocks.onAuthStateChanged).not.toHaveBeenCalled();

        await userStore.signInWithGoogle();
        expect(mocks.onAuthStateChanged).toHaveBeenCalledOnce();
        expect(mocks.signInWithPopup).toHaveBeenCalledOnce();
        const notify = mocks.onAuthStateChanged.mock.calls[0][1];
        const user = { uid: 'recovered-user', isAnonymous: false };
        notify(user);
        expect(userStore.state.user?.uid).toBe('recovered-user');
    });

    it('resets analytics identity for cross-tab sign-out and account switches', async () => {
        const { userStore } = await import('./user.svelte');
        await userStore.signInWithGoogle();
        const notify = mocks.onAuthStateChanged.mock.calls[0][1];
        notify({ uid: 'first-user', isAnonymous: false });
        notify(null);
        expect(mocks.resetAnalyticsUser).toHaveBeenCalledOnce();
        expect(userStore.state.user).toBeNull();

        notify({ uid: 'first-user', isAnonymous: false });
        notify({ uid: 'second-user', isAnonymous: false });
        expect(mocks.resetAnalyticsUser).toHaveBeenCalledTimes(2);
        expect(mocks.identifyAnalyticsUser).toHaveBeenLastCalledWith('second-user');
        expect(userStore.state.user?.uid).toBe('second-user');
    });
});
