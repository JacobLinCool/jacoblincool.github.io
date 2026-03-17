import { browser } from '$app/environment';
import posthog from 'posthog-js';

export type AnalyticsAuthState = 'signed_out' | 'anonymous' | 'google';
export type AnalyticsPromptSource = 'composer' | 'chip' | 'deep_dive';
export type TurnLatencyBand = 'lt3s' | '3to8s' | 'gt8s';
export type ResponseLengthBand = 'short' | 'medium' | 'long';

type AnalyticsEventProperties = Record<string, string | number | boolean | undefined>;

let currentAuthState: AnalyticsAuthState = 'signed_out';

const captureEvent = (name: string, properties: AnalyticsEventProperties = {}) => {
    if (!browser) {
        return;
    }

    posthog.capture(name, {
        auth_state: currentAuthState,
        ...properties
    });
};

export const setAnalyticsAuthState = (authState: AnalyticsAuthState) => {
    currentAuthState = authState;
};

export const resolveTurnLatencyBand = (latencyMs: number): TurnLatencyBand => {
    if (latencyMs < 3000) {
        return 'lt3s';
    }

    if (latencyMs < 8000) {
        return '3to8s';
    }

    return 'gt8s';
};

export const resolveResponseLengthBand = (responseChars: number): ResponseLengthBand => {
    if (responseChars < 280) {
        return 'short';
    }

    if (responseChars < 900) {
        return 'medium';
    }

    return 'long';
};

export const trackPromptChipClicked = (chipId: string) => {
    captureEvent('prompt_chip_clicked', {
        chip_id: chipId
    });
};

export const trackDeepDivePromptClicked = (targetItemId: string) => {
    captureEvent('deep_dive_prompt_clicked', {
        target_item_id: targetItemId
    });
};

export const trackChatTurnStarted = (promptSource: AnalyticsPromptSource) => {
    captureEvent('chat_turn_started', {
        prompt_source: promptSource
    });
};

export const trackChatTurnCompleted = (input: {
    promptSource: AnalyticsPromptSource;
    latencyMs: number;
    responseChars: number;
    toolCallsCount: number;
}) => {
    captureEvent('chat_turn_completed', {
        prompt_source: input.promptSource,
        turn_latency_band: resolveTurnLatencyBand(input.latencyMs),
        response_length_band: resolveResponseLengthBand(input.responseChars),
        tool_calls_count: input.toolCallsCount
    });
};

export const trackChatTurnFailed = (input: {
    promptSource: AnalyticsPromptSource;
    latencyMs: number;
    toolCallsCount: number;
}) => {
    captureEvent('chat_turn_failed', {
        prompt_source: input.promptSource,
        turn_latency_band: resolveTurnLatencyBand(input.latencyMs),
        tool_calls_count: input.toolCallsCount
    });
};

export const trackContextStatusToggled = (collapsed: boolean) => {
    captureEvent('context_status_toggled', {
        panel_state: collapsed ? 'collapsed' : 'expanded'
    });
};

export const trackResponseCopied = (responseChars: number) => {
    captureEvent('response_copied', {
        response_length_band: resolveResponseLengthBand(responseChars)
    });
};

export const trackLoginModalOpened = () => {
    captureEvent('login_modal_opened');
};

export const trackLoginGoogleClicked = () => {
    captureEvent('login_google_clicked');
};

export const trackLoginSuccess = () => {
    captureEvent('login_success', {
        login_method: 'google'
    });
};
