/** Translate transport/auth failures into recovery instructions without exposing SDK internals. */
export const chatErrorMessage = (error: unknown): string => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'auth/network-request-failed' || error instanceof TypeError) {
        return 'Could not connect to the chat service. Check your connection and retry.';
    }
    if (code === 'auth/too-many-requests') {
        return 'Too many connection attempts. Please wait a moment, then retry.';
    }
    if (typeof code === 'string' && code.startsWith('auth/')) {
        return 'Chat is currently unavailable. Please try again later.';
    }
    return error instanceof Error
        ? error.message
        : 'The response could not be completed. Please retry.';
};
