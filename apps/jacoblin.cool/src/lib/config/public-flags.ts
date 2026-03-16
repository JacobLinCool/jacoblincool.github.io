import { PUBLIC_JACOB_CHAT_AUDIO_ENABLED } from '$env/static/public';

const parseBooleanFlag = (value: string | undefined, defaultValue: boolean) => {
    if (!value) {
        return defaultValue;
    }

    const normalized = value.trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    return defaultValue;
};

export const publicFeatureFlags = {
    chatAudioEnabled: parseBooleanFlag(PUBLIC_JACOB_CHAT_AUDIO_ENABLED, true)
} as const;
