#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firestore } from 'fires2rest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readEnv = (key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const projectId =
    readEnv('FIRESTORE_PROJECT_ID') ||
    readEnv('FIREBASE_PROJECT_ID') ||
    readEnv('PUBLIC_FIREBASE_PROJECT_ID');

if (!projectId) {
    throw new Error('Missing FIRESTORE_PROJECT_ID or PUBLIC_FIREBASE_PROJECT_ID.');
}

const emulatorHost = readEnv('FIRESTORE_EMULATOR_HOST');
const clientEmail = readEnv('FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL') || readEnv('GOOGLE_CLIENT_EMAIL');
const privateKey =
    (readEnv('FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY') || readEnv('GOOGLE_PRIVATE_KEY'))?.replace(
        /\\n/g,
        '\n'
    ) || null;

const db = emulatorHost
    ? Firestore.useEmulator({
          emulatorHost,
          projectId,
          admin: true
      })
    : (() => {
          if (!clientEmail || !privateKey) {
              throw new Error(
                  'Missing service account credentials. Set FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.'
              );
          }

          return Firestore.useServiceAccount(projectId, {
              clientEmail,
              privateKey
          });
      })();

const filePath = process.argv[2] || path.join(__dirname, '../data/content.seed.v1.json');
const raw = await fs.readFile(filePath, 'utf-8');
const seed = JSON.parse(raw);

if (typeof seed.versionId !== 'string' || !seed.versionId.trim()) {
    throw new Error('Invalid seed file: versionId is required.');
}

if (!Array.isArray(seed.locales) || seed.locales.length === 0) {
    throw new Error('Invalid seed file: locales must be a non-empty array.');
}

const publishLocales = Array.isArray(seed.publishLocales)
    ? seed.publishLocales.filter((value) => typeof value === 'string' && value.trim())
    : ['en'];

const now = new Date().toISOString();
await db.doc(`content_versions/${seed.versionId}`).set(
    {
        versionId: seed.versionId,
        status: 'draft',
        updatedAt: now,
        updatedBy: 'seed-script'
    },
    { merge: true }
);

for (const localeConfig of seed.locales) {
    if (!localeConfig || typeof localeConfig.locale !== 'string') {
        continue;
    }

    await db.doc(`content_versions/${seed.versionId}/entries/content-bundle-${localeConfig.locale}`).set(
        {
            kind: 'content_bundle',
            locale: localeConfig.locale,
            updatedAt: now,
            payload: {
                home: seed.template.home,
                chat: seed.template.chat
            }
        },
        { merge: true }
    );
}

const byLocale = Object.fromEntries(publishLocales.map((locale) => [locale, seed.versionId]));
await db.doc('content_state/published').set(
    {
        byLocale,
        updatedAt: now,
        updatedBy: 'seed-script'
    },
    { merge: true }
);

console.log(`Seeded content version ${seed.versionId} for locales: ${publishLocales.join(', ')}`);
