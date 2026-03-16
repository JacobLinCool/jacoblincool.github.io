import { dev } from '$app/environment';
import {
    createRemoteJWKSet,
    decodeJwt,
    decodeProtectedHeader,
    jwtVerify,
    type JWTPayload
} from 'jose';

const FIREBASE_JWKS_URL =
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export type VerifiedFirebaseUser = {
    uid: string;
    isAnonymous: boolean;
    email: string | null;
    payload: JWTPayload;
};

const extractBearerToken = (authorization: string | null) => {
    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token.trim() || null;
};

export const verifyFirebaseIdToken = async (
    token: string,
    projectId: string
): Promise<VerifiedFirebaseUser> => {
    let payload: JWTPayload;

    try {
        const verified = await jwtVerify(token, jwks, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId
        });
        payload = verified.payload;
    } catch (error) {
        if (!dev) {
            throw error;
        }

        const header = decodeProtectedHeader(token);
        if (header.alg !== 'none') {
            throw error;
        }

        const decoded = decodeJwt(token);
        if (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now()) {
            throw new Error('Firebase emulator token has expired.');
        }

        payload = decoded;
    }

    const uid =
        (typeof payload.user_id === 'string' && payload.user_id) ||
        (typeof payload.sub === 'string' && payload.sub) ||
        null;

    if (!uid) {
        throw new Error('Firebase token payload does not include a uid.');
    }

    const firebaseClaim = payload.firebase as
        | {
              sign_in_provider?: string;
          }
        | undefined;

    const email = typeof payload.email === 'string' ? payload.email : null;

    return {
        uid,
        isAnonymous: firebaseClaim?.sign_in_provider === 'anonymous',
        email,
        payload
    };
};

export const requireFirebaseUser = async (
    request: Request,
    projectId: string
): Promise<VerifiedFirebaseUser> => {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
        throw new Error('Missing bearer token.');
    }

    return verifyFirebaseIdToken(token, projectId);
};
