import { PUBLIC_JACOB_CHAT_AUDIO_ENABLED } from '$env/static/public';
import { parseBooleanPublicValue } from '$lib/config/public-env';

export const publicFeatureFlags = {
    chatAudioEnabled: parseBooleanPublicValue(PUBLIC_JACOB_CHAT_AUDIO_ENABLED, true)
} as const;
