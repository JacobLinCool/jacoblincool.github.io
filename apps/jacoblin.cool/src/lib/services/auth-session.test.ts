import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, signInAnonymously, getIdToken } = vi.hoisted(() => {
    const getIdToken = vi.fn();
    return {
        getIdToken,
        auth: {
            currentUser: null as null | { getIdToken: typeof getIdToken },
            authStateReady: vi.fn()
        },
        signInAnonymously: vi.fn()
    };
});
vi.mock('$lib/firebase/client', () => ({ auth }));
vi.mock('firebase/auth', () => ({ signInAnonymously }));

beforeEach(() => {
    vi.resetModules();
    auth.currentUser = null;
    auth.authStateReady.mockReset().mockResolvedValue(undefined);
    getIdToken.mockReset().mockResolvedValue('session-token');
    signInAnonymously.mockReset().mockResolvedValue({ user: { getIdToken } });
});

describe('auth preparation', () => {
    it('shares one sign-in between intent preparation and sending', async () => {
        const { ensureAuthToken } = await import('./auth-session');
        const prepared = ensureAuthToken();
        const submitted = ensureAuthToken();
        expect(prepared).toBe(submitted);
        await expect(Promise.all([prepared, submitted])).resolves.toEqual([
            'session-token',
            'session-token'
        ]);
        expect(signInAnonymously).toHaveBeenCalledOnce();
        expect(getIdToken).toHaveBeenCalledOnce();
    });

    it('waits for persisted identity before creating an anonymous session', async () => {
        auth.authStateReady.mockImplementation(async () => {
            auth.currentUser = { getIdToken };
        });
        const { ensureAuthToken } = await import('./auth-session');
        await expect(ensureAuthToken()).resolves.toBe('session-token');
        expect(signInAnonymously).not.toHaveBeenCalled();
    });

    it('allows a real send to retry failed preparation', async () => {
        signInAnonymously.mockRejectedValueOnce(new Error('offline'));
        const { ensureAuthToken } = await import('./auth-session');
        await expect(ensureAuthToken()).rejects.toThrow('offline');
        await expect(ensureAuthToken()).resolves.toBe('session-token');
        expect(signInAnonymously).toHaveBeenCalledTimes(2);
    });
});
