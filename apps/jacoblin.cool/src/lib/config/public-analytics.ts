import {
    PUBLIC_GA_DEBUG_MODE,
    PUBLIC_GA_ENABLED,
    PUBLIC_GA_MEASUREMENT_ID
} from '$env/static/public';
import { parseBooleanPublicValue, parseOptionalPublicString } from '$lib/config/public-env';

export const publicAnalyticsConfig = {
    gaMeasurementId: parseOptionalPublicString(PUBLIC_GA_MEASUREMENT_ID),
    gaEnabled: parseBooleanPublicValue(PUBLIC_GA_ENABLED, false),
    gaDebugMode: parseBooleanPublicValue(PUBLIC_GA_DEBUG_MODE, false)
} as const;
