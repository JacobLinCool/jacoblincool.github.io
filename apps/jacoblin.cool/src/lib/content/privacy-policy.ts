export type PrivacySectionId =
    | 'overview'
    | 'information-we-use'
    | 'how-we-use-it'
    | 'third-party-services'
    | 'cookies-and-browser-state'
    | 'what-we-do-not-use'
    | 'updates';

export type PrivacySectionLink = {
    id: PrivacySectionId;
    label: string;
};

export type PrivacyInformationItem = {
    id: string;
    title: string;
    description: string;
};

export type PrivacyServiceItem = {
    id: string;
    name: string;
    purpose: string;
    possibleData: string;
    processingScope: string;
};

export type PrivacyPolicyContent = {
    footerLinkLabel: string;
    eyebrow: string;
    title: string;
    summary: string;
    updatedAt: string;
    sectionLinks: readonly PrivacySectionLink[];
    overview: readonly string[];
    informationWeUse: readonly PrivacyInformationItem[];
    howWeUseIt: readonly string[];
    thirdPartyServices: readonly PrivacyServiceItem[];
    cookiesAndBrowserState: readonly string[];
    whatWeDoNotUse: readonly string[];
    updates: readonly string[];
};

export const privacyPolicyContent = {
    footerLinkLabel: 'Privacy',
    eyebrow: 'Privacy',
    title: 'Privacy Information',
    summary:
        'This page explains what data this site stores, what limited analytics and operational signals it records, and which third-party services are involved in delivering the current site.',
    updatedAt: 'March 17, 2026',
    sectionLinks: [
        { id: 'overview', label: 'Overview' },
        { id: 'information-we-use', label: 'Information we use' },
        { id: 'how-we-use-it', label: 'How we use it' },
        { id: 'third-party-services', label: 'Third-party services' },
        { id: 'cookies-and-browser-state', label: 'Cookies and browser state' },
        { id: 'what-we-do-not-use', label: 'What we do not use' },
        { id: 'updates', label: 'Updates' }
    ],
    overview: [
        'This site includes an interactive chat experience, optional Google sign-in, automatic anonymous authentication for chat continuity, production analytics, and a few live integrations that pull public profile data. Some information is stored directly by the site, and some is handled by third-party providers that support hosting, authentication, model inference, analytics, and public-data lookups.',
        'If you use the chat, your messages, assistant replies, and compact carry-over summaries may be stored so the site can continue a current conversation over time and across internal context rollovers. If you explicitly sign in with Google, basic account details may be attached to your session instead of an anonymous identity.',
        'Do not put secrets, passwords, or highly sensitive personal information into the chat. This page describes the current technical behavior of the site as implemented today, including current limits in deletion, export, and retention controls.'
    ],
    informationWeUse: [
        {
            id: 'anonymous-session',
            title: 'Anonymous session identifiers',
            description:
                'If you do not sign in, the site still creates an anonymous Firebase-authenticated session so it can associate your conversation with a stable UID.'
        },
        {
            id: 'google-profile',
            title: 'Google sign-in profile fields',
            description:
                'If you explicitly choose Google sign-in, the site may receive your email address, display name, profile photo, and the Google-linked identity behind your Firebase account.'
        },
        {
            id: 'chat-content',
            title: 'Chat messages, assistant replies, and carry-over summaries',
            description:
                'The site stores the text you send, the replies generated for you, and compact carry-over summaries used to continue the current conversation when an older conversation chapter is rolled over.'
        },
        {
            id: 'conversation-state',
            title: 'Conversation state and model usage metadata',
            description:
                'The backend stores conversation heads, turn sequencing, status transitions, tool-call events, model metadata, and usage metadata returned by the model provider.'
        },
        {
            id: 'analytics-events',
            title: 'Production analytics events',
            description:
                'Production deployments send limited Google Analytics 4 events such as page views, prompt-chip clicks, login interactions, chat start/completion states, context-status toggles, and copy actions. Raw chat content, raw assistant replies, Firebase UID values, and Google account profile fields are not sent to Google Analytics.'
        },
        {
            id: 'operational-logs',
            title: 'Server-side operational log metadata',
            description:
                'The backend emits structured operational logs that can include request ids, trace ids, timing, tool-call metadata, conversation token counters, rollover events, and model usage counters. These logs are meant for debugging and observability, and they do not intentionally include raw prompt or reply text.'
        },
        {
            id: 'locale-cookie',
            title: 'Language preference cookie',
            description:
                'The site uses a locale cookie to remember language preference. The current cookie name in code is PARAGLIDE_LOCALE.'
        },
        {
            id: 'request-metadata',
            title: 'Platform and request metadata',
            description:
                'Standard infrastructure metadata such as IP address, user agent, timing, and security-related request signals may be processed by hosting and identity providers as part of serving the site.'
        }
    ],
    howWeUseIt: [
        'To authenticate visitors, including automatic anonymous chat sessions and optional Google-linked sessions, so the site can keep a single current conversation per user identity.',
        'To store conversations, replies, carry-over summaries, internal conversation state, and model usage metadata needed for the chat feature and conversation continuity to work.',
        'To generate chat responses and carry-over summaries through the configured model provider.',
        'To fetch and cache public profile metrics from GitHub and Hugging Face for the site UI and tool-assisted answers.',
        'To measure high-level product usage in production through limited GA4 events rather than raw transcript collection.',
        'To monitor reliability and debug problems through structured backend logs and ordinary hosting-level request processing.',
        'To remember language preference and deliver the site through the configured runtime platform.'
    ],
    thirdPartyServices: [
        {
            id: 'firebase-auth',
            name: 'Firebase Authentication',
            purpose:
                'Creates the site session and provides the identity token used to authorize chat requests.',
            possibleData:
                'Anonymous UID, Firebase auth state, Firebase ID tokens, and linked identity metadata when applicable.',
            processingScope:
                'Can process authentication-related user data, but it is not the service used to generate chat answers.'
        },
        {
            id: 'google-sign-in',
            name: 'Google Sign-In',
            purpose:
                'Lets you sign in with a Google account through the site login flow.',
            possibleData:
                'Email address, display name, profile photo, and Google account identity data you choose to expose during sign-in.',
            processingScope:
                'Only used if you actively choose Google sign-in. It can process identity data, but not your chat prompt by itself.'
        },
        {
            id: 'firestore',
            name: 'Firestore',
            purpose:
                'Stores conversation records, messages, assistant outputs, event logs, carry-over summaries, and cached external profile snapshots.',
            possibleData:
                'Anonymous or Google-linked UID, locale, message text, assistant replies, carry-over summaries, model usage metadata, tool-call events, and cached public GitHub or Hugging Face data.',
            processingScope:
                'This service stores user-submitted chat data and site-generated conversation state.'
        },
        {
            id: 'gemini',
            name: 'Google Gemini API',
            purpose:
                'Generates chat answers and internal carry-over summaries for multi-turn conversations.',
            possibleData:
                'Current prompt, recent conversation context, carry-over summary text, and the site context needed to answer your question.',
            processingScope:
                'This service processes user-submitted chat data in order to produce answers.'
        },
        {
            id: 'google-analytics',
            name: 'Google Analytics',
            purpose:
                'Measures page views and a small set of high-level interaction events in production deployments.',
            possibleData:
                'Page URLs, page titles, coarse interaction events, auth-state labels such as signed_out or anonymous, and derived response-length or latency bands.',
            processingScope:
                'Used for product analytics in production. It is not used to send raw chat transcripts, raw assistant replies, Firebase UID values, or Google account profile fields.'
        },
        {
            id: 'github-api',
            name: 'GitHub API',
            purpose:
                'Fetches live public profile and repository information used by the site and chat tools.',
            possibleData:
                'Public GitHub profile metrics and public repository metadata for the configured account.',
            processingScope:
                'Used for public profile data only. It is not sent your private chat messages.'
        },
        {
            id: 'huggingface-api',
            name: 'Hugging Face API',
            purpose:
                'Fetches live public model and space information used by the site and chat tools.',
            possibleData:
                'Public Hugging Face profile, model, and Space metadata for the configured account.',
            processingScope:
                'Used for public profile data only. It is not sent your private chat messages.'
        },
        {
            id: 'cloudflare',
            name: 'Cloudflare',
            purpose:
                'Provides the runtime, delivery layer, and infrastructure-level request handling for the deployed SvelteKit application.',
            possibleData:
                'Standard request metadata such as IP address, user agent, timing, security signals, and structured backend log fields emitted by the chat runtime.',
            processingScope:
                'Processes infrastructure-level request data as part of hosting and delivering the site, and may receive structured operational logs produced by the backend.'
        },
        {
            id: 'google-fonts',
            name: 'Google Fonts',
            purpose:
                'Serves the Space Grotesk font loaded by the global site stylesheet.',
            possibleData:
                'Browser requests for font CSS and font files, which may include IP address, user agent, and referrer information visible to Google as the font host.',
            processingScope:
                'Only involved when the browser loads font resources. It does not receive your chat content from the site backend.'
        }
    ],
    cookiesAndBrowserState: [
        'The current codebase uses a locale cookie named PARAGLIDE_LOCALE to remember language preference. It is not an advertising or retargeting cookie.',
        'If you use Google sign-in or anonymous auth, browser-side authentication persistence is handled through Firebase rather than a custom app-defined cookie designed for tracking.',
        'When Google Analytics is enabled in production, Google may use its own browser storage or cookies to support page-view and event measurement.',
        'The site does not currently use localStorage for locale persistence because the active Paraglide strategy is cookie-based.',
        'If you press the copy button on a response, the site writes that response text to your clipboard at your request. It does not silently mirror chat text into clipboard state.',
        'The current codebase does not implement a separate consent banner or consent-gating flow for analytics cookies.'
    ],
    whatWeDoNotUse: [
        'The site does not currently ship advertising tags, retargeting pixels, or marketing beacons.',
        'The site does not currently use Hotjar, FullStory, PostHog session replay, screen-recording tools, heatmap tools, or similar session-replay instrumentation.',
        'Google Analytics is not used to send raw chat transcripts, raw assistant replies, Firebase UID values, or Google account profile fields.',
        'The site does not use live Google Scholar API access. Scholar references on the site are static content or ordinary external links.'
    ],
    updates: [
        'This privacy information is accurate as of the last updated date shown above. If the site’s data practices change, this page will be updated to reflect those changes.',
        'The current codebase does not expose a user-facing export or deletion workflow for stored conversations, and it does not publish a fixed in-app retention window. This page therefore describes current implementation behavior rather than promising future retention or self-service data controls.',
        'If you have questions or concerns about the site’s data practices, please reach out through the contact information provided on the site.'
    ]
} as const satisfies PrivacyPolicyContent;
