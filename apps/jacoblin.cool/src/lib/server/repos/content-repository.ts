import type { Firestore } from 'fires2rest';
import type { CanonicalContentBundle } from '$lib/types/home';

type PublishedContentState = {
    byLocale?: Record<string, string>;
    updatedAt?: string;
};

type ContentBundleEntry = {
    kind?: string;
    locale?: string;
    updatedAt?: string;
    payload?: Omit<CanonicalContentBundle, 'locale' | 'versionId' | 'updatedAt'>;
};

const PUBLISHED_STATE_DOC_PATH = 'content_state/published';

const readBundleEntry = async (
    db: Firestore,
    versionId: string,
    locale: string
): Promise<ContentBundleEntry | null> => {
    const snapshot = await db
        .doc(`content_versions/${versionId}/entries/content-bundle-${locale}`)
        .get();

    if (!snapshot.exists) {
        return null;
    }

    return snapshot.data() as ContentBundleEntry;
};

const ensurePayload = (
    entry: ContentBundleEntry | null,
    locale: string,
    versionId: string
): CanonicalContentBundle => {
    if (!entry?.payload) {
        throw new Error(
            `Missing canonical content bundle for locale=${locale} version=${versionId}. Run seed import first.`
        );
    }

    return {
        locale,
        versionId,
        updatedAt: entry.updatedAt ?? new Date().toISOString(),
        ...entry.payload
    };
};

export type PublishedContentResult = {
    versionId: string;
    locale: string;
    bundle: CanonicalContentBundle;
};

export const getPublishedContent = async (
    db: Firestore,
    requestedLocale: string
): Promise<PublishedContentResult> => {
    const publishedSnap = await db.doc(PUBLISHED_STATE_DOC_PATH).get();
    if (!publishedSnap.exists) {
        throw new Error('Missing content_state/published document. Run seed import and publish first.');
    }

    const published = publishedSnap.data() as PublishedContentState;
    const byLocale = published.byLocale ?? {};
    const resolvedLocale = byLocale[requestedLocale] ? requestedLocale : 'en';
    const versionId = byLocale[resolvedLocale];

    if (!versionId) {
        throw new Error(
            `No published content version found for locale=${requestedLocale} (and no en fallback).`
        );
    }

    const entry = await readBundleEntry(db, versionId, resolvedLocale);
    return {
        versionId,
        locale: resolvedLocale,
        bundle: ensurePayload(entry, resolvedLocale, versionId)
    };
};

export type ImportContentInput = {
    versionId: string;
    locales: CanonicalContentBundle[];
    publishLocales: string[];
    actorUid: string;
};

export const importContentBundle = async (db: Firestore, input: ImportContentInput) => {
    const now = new Date().toISOString();
    const versionRef = db.doc(`content_versions/${input.versionId}`);

    await versionRef.set(
        {
            versionId: input.versionId,
            status: 'draft',
            updatedAt: now,
            updatedBy: input.actorUid
        },
        { merge: true }
    );

    for (const localeBundle of input.locales) {
        await db
            .doc(`content_versions/${input.versionId}/entries/content-bundle-${localeBundle.locale}`)
            .set(
                {
                    kind: 'content_bundle',
                    locale: localeBundle.locale,
                    updatedAt: now,
                    payload: {
                        home: localeBundle.home,
                        chat: localeBundle.chat
                    }
                },
                { merge: true }
            );
    }

    const byLocale = Object.fromEntries(
        input.publishLocales.map((locale) => [locale, input.versionId])
    );

    await db.doc(PUBLISHED_STATE_DOC_PATH).set(
        {
            byLocale,
            updatedAt: now,
            updatedBy: input.actorUid
        },
        { merge: true }
    );
};

export const publishContentVersion = async (
    db: Firestore,
    versionId: string,
    locales: string[],
    actorUid: string
) => {
    const now = new Date().toISOString();
    const byLocale = Object.fromEntries(locales.map((locale) => [locale, versionId]));

    await db.doc(`content_versions/${versionId}`).set(
        {
            versionId,
            status: 'published',
            publishedAt: now,
            updatedAt: now,
            updatedBy: actorUid
        },
        { merge: true }
    );

    await db.doc(PUBLISHED_STATE_DOC_PATH).set(
        {
            byLocale,
            updatedAt: now,
            updatedBy: actorUid
        },
        { merge: true }
    );
};
