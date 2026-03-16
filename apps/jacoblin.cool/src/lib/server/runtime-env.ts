import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export type RuntimeConfig = {
    firestoreProjectId: string;
    firestoreDatabaseId: string;
    firestoreClientEmail: string | null;
    firestorePrivateKey: string | null;
    firestoreEmulatorHost: string | null;
    geminiApiBaseUrl: string;
    geminiApiKey: string | null;
    geminiModel: string;
    geminiMaxOutputTokens: number;
    githubToken: string | null;
    githubUser: string;
    huggingfaceUser: string;
};

type EnvLike = Record<string, unknown> | undefined;

const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const readString = (key: string, platformEnv?: EnvLike): string | null => {
    const platformValue = platformEnv ? asString(platformEnv[key]) : null;
    if (platformValue) {
        return platformValue;
    }

    const privateValue = asString(privateEnv[key]);
    if (privateValue) {
        return privateValue;
    }

    return asString((publicEnv as Record<string, string | undefined>)[key]);
};

const readNumber = (key: string, fallback: number, platformEnv?: EnvLike) => {
    const raw = readString(key, platformEnv);
    if (!raw) {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
};

const normalizePrivateKey = (value: string | null) => (value ? value.replace(/\\n/g, '\n') : null);

export const readRuntimeConfig = (platformEnv?: EnvLike): RuntimeConfig => {
    const firestoreProjectId =
        readString('FIRESTORE_PROJECT_ID', platformEnv) ??
        readString('FIREBASE_PROJECT_ID', platformEnv) ??
        readString('PUBLIC_FIREBASE_PROJECT_ID', platformEnv);

    if (!firestoreProjectId) {
        throw new Error(
            'Missing Firestore project id. Set FIRESTORE_PROJECT_ID or PUBLIC_FIREBASE_PROJECT_ID.'
        );
    }

    return {
        firestoreProjectId,
        firestoreDatabaseId: readString('FIRESTORE_DATABASE_ID', platformEnv) ?? '(default)',
        firestoreClientEmail:
            readString('FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL', platformEnv) ??
            readString('GOOGLE_CLIENT_EMAIL', platformEnv),
        firestorePrivateKey: normalizePrivateKey(
            readString('FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY', platformEnv) ??
                readString('GOOGLE_PRIVATE_KEY', platformEnv)
        ),
        firestoreEmulatorHost: readString('FIRESTORE_EMULATOR_HOST', platformEnv),
        geminiApiBaseUrl:
            readString('GEMINI_API_BASE_URL', platformEnv) ??
            'https://generativelanguage.googleapis.com/v1beta',
        geminiApiKey: readString('GEMINI_API_KEY', platformEnv),
        geminiModel:
            readString('GEMINI_CHAT_MODEL', platformEnv) ?? 'gemini-3.1-flash-lite-preview',
        geminiMaxOutputTokens: readNumber('GEMINI_MAX_OUTPUT_TOKENS', 1024, platformEnv),
        githubToken:
            readString('GITHUB_TOKEN', platformEnv) ??
            readString('GITHUB_API_TOKEN', platformEnv),
        githubUser: readString('GITHUB_USER', platformEnv) ?? 'JacobLinCool',
        huggingfaceUser: readString('HUGGINGFACE_USER', platformEnv) ?? 'JacobLinCool'
    };
};
