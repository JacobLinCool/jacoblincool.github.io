import type { CanonicalContentBundle } from '$lib/types/home';
import contentBundle from '../../../../data/content.bundle.v2.json';

type StaticContentFile = {
    versionId: string;
    updatedAt?: string;
    publishLocales?: string[];
    locales?: Array<{ locale?: string }>;
    template: {
        home: CanonicalContentBundle['home'];
        chat: CanonicalContentBundle['chat'];
    };
};

export type StaticPublishedContentResult = {
    versionId: string;
    locale: string;
    bundle: CanonicalContentBundle;
};

const staticContent = contentBundle as StaticContentFile;

const supportedLocales = new Set(
    (Array.isArray(staticContent.locales) ? staticContent.locales : [])
        .map((entry) => (typeof entry?.locale === 'string' ? entry.locale.trim() : ''))
        .filter(Boolean)
);

const publishedLocales = new Set(
    (Array.isArray(staticContent.publishLocales) ? staticContent.publishLocales : ['en'])
        .map((locale) => (typeof locale === 'string' ? locale.trim() : ''))
        .filter(Boolean)
);

const resolveLocale = (requestedLocale: string) => {
    if (publishedLocales.has(requestedLocale)) {
        return requestedLocale;
    }

    if (publishedLocales.has('en')) {
        return 'en';
    }

    const firstPublishedLocale = publishedLocales.values().next().value;
    if (typeof firstPublishedLocale === 'string') {
        return firstPublishedLocale;
    }

    const firstSupportedLocale = supportedLocales.values().next().value;
    if (typeof firstSupportedLocale === 'string') {
        return firstSupportedLocale;
    }

    throw new Error('Static content bundle has no configured locales.');
};

export const getStaticPublishedContent = (
    requestedLocale: string
): StaticPublishedContentResult => {
    const locale = resolveLocale(requestedLocale);

    return {
        versionId: staticContent.versionId,
        locale,
        bundle: {
            locale,
            versionId: staticContent.versionId,
            updatedAt: staticContent.updatedAt ?? '2026-03-16T00:00:00.000Z',
            home: staticContent.template.home,
            chat: staticContent.template.chat
        }
    };
};
