/** Load Firebase once; chat intent and account controls share the same auth session. */
let clientPromise: Promise<typeof import('$lib/firebase/client')> | null = null;
let tokenPromise: Promise<string> | null = null;

export const loadAuthClient = () => {
    clientPromise ??= import('$lib/firebase/client').catch((error) => {
        clientPromise = null;
        throw error;
    });
    return clientPromise;
};

export const ensureAuthToken = () => {
    tokenPromise ??= (async () => {
        const [{ auth }, { signInAnonymously }] = await Promise.all([
            loadAuthClient(),
            import('firebase/auth')
        ]);
        // Restore persisted identity before considering an anonymous sign-in.
        await auth.authStateReady();
        const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
        return user.getIdToken();
    })().finally(() => {
        tokenPromise = null;
    });
    return tokenPromise;
};
