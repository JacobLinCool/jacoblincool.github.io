import { browser, dev } from '$app/environment';
import { publicAnalyticsConfig } from '$lib/config/public-analytics';

export type AnalyticsAuthState = 'signed_out' | 'anonymous' | 'google';
export type AnalyticsPromptSource = 'composer' | 'chip' | 'deep_dive';
export type TurnLatencyBand = 'lt3s' | '3to8s' | 'gt8s';
export type ResponseLengthBand = 'short' | 'medium' | 'long';

type GaEventParams = Record<string, string | number | boolean | undefined>;

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

const GA_SCRIPT_MARKER = 'data-jacob-ga-script';

let analyticsConfigured = false;
let currentAuthState: AnalyticsAuthState = 'signed_out';

const isGaRuntimeEnabled = () =>
    browser && !dev && publicAnalyticsConfig.gaEnabled && Boolean(publicAnalyticsConfig.gaMeasurementId);

const ensureGtagStub = () => {
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => {
        window.dataLayer?.push(args);
    };
};

const ensureGtagScript = (measurementId: string) => {
    if (document.querySelector(`script[${GA_SCRIPT_MARKER}="true"]`)) {
        return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.setAttribute(GA_SCRIPT_MARKER, 'true');
    document.head.appendChild(script);
};

const trackGaEvent = (name: string, params: GaEventParams = {}) => {
    if (!initGa()) {
        return;
    }

    window.gtag?.('event', name, {
        auth_state: currentAuthState,
        ...params
    });
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

export const normalizePageLocation = (url: URL | string) => {
    const baseOrigin =
        browser && typeof window.location?.origin === 'string'
            ? window.location.origin
            : 'https://jacoblin.cool';
    const normalized = typeof url === 'string' ? new URL(url, baseOrigin) : new URL(url.toString());

    return {
        pageLocation: `${normalized.origin}${normalized.pathname}${normalized.search}`,
        pagePath: `${normalized.pathname}${normalized.search}`
    };
};

export const initGa = () => {
    if (!isGaRuntimeEnabled()) {
        return false;
    }

    const measurementId = publicAnalyticsConfig.gaMeasurementId;
    if (!measurementId) {
        return false;
    }

    ensureGtagStub();
    ensureGtagScript(measurementId);

    if (!analyticsConfigured) {
        window.gtag?.('js', new Date());
        window.gtag?.('config', measurementId, {
            send_page_view: false,
            debug_mode: publicAnalyticsConfig.gaDebugMode
        });
        analyticsConfigured = true;
    }

    window.gtag?.('set', 'user_properties', {
        auth_state: currentAuthState
    });

    return true;
};

export const setAnalyticsAuthState = (authState: AnalyticsAuthState) => {
    currentAuthState = authState;

    if (!initGa()) {
        return;
    }

    window.gtag?.('set', 'user_properties', {
        auth_state: authState
    });
};

export const trackPageView = (url: URL | string) => {
    if (!initGa()) {
        return;
    }

    const { pageLocation, pagePath } = normalizePageLocation(url);
    trackGaEvent('page_view', {
        page_location: pageLocation,
        page_path: pagePath,
        page_title: document.title
    });
};

export const trackPromptChipClicked = (chipId: string) => {
    trackGaEvent('prompt_chip_clicked', {
        chip_id: chipId
    });
};

export const trackDeepDivePromptClicked = (targetItemId: string) => {
    trackGaEvent('deep_dive_prompt_clicked', {
        target_item_id: targetItemId
    });
};

export const trackChatTurnStarted = (promptSource: AnalyticsPromptSource) => {
    trackGaEvent('chat_turn_started', {
        prompt_source: promptSource
    });
};

export const trackChatTurnCompleted = (input: {
    promptSource: AnalyticsPromptSource;
    latencyMs: number;
    responseChars: number;
    toolCallsCount: number;
}) => {
    trackGaEvent('chat_turn_completed', {
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
    trackGaEvent('chat_turn_failed', {
        prompt_source: input.promptSource,
        turn_latency_band: resolveTurnLatencyBand(input.latencyMs),
        tool_calls_count: input.toolCallsCount
    });
};

export const trackContextStatusToggled = (collapsed: boolean) => {
    trackGaEvent('context_status_toggled', {
        panel_state: collapsed ? 'collapsed' : 'expanded'
    });
};

export const trackResponseCopied = (responseChars: number) => {
    trackGaEvent('response_copied', {
        response_length_band: resolveResponseLengthBand(responseChars)
    });
};

export const trackLoginModalOpened = () => {
    trackGaEvent('login_modal_opened');
};

export const trackLoginGoogleClicked = () => {
    trackGaEvent('login_google_clicked');
};

export const trackLoginSuccess = () => {
    trackGaEvent('login_success', {
        login_method: 'google'
    });
};
