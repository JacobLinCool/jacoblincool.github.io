import { dev } from '$app/environment';
import { Firestore } from 'fires2rest';
import type { RuntimeConfig } from './runtime-env';

type CacheRecord = {
    key: string;
    db: Firestore;
};

let cached: CacheRecord | null = null;

const buildCacheKey = (config: RuntimeConfig) =>
    [
        config.firestoreProjectId,
        config.firestoreDatabaseId,
        config.firestoreClientEmail ?? 'none',
        config.firestoreEmulatorHost ?? 'prod'
    ].join('::');

export const getAdminDb = (config: RuntimeConfig): Firestore => {
    const key = buildCacheKey(config);
    if (cached?.key === key) {
        return cached.db;
    }

    const useEmulator = dev && Boolean(config.firestoreEmulatorHost);

    const db = useEmulator
        ? Firestore.useEmulator({
              emulatorHost: config.firestoreEmulatorHost ?? '127.0.0.1:8080',
              projectId: config.firestoreProjectId,
              databaseId: config.firestoreDatabaseId,
              admin: true
          })
        : (() => {
              if (!config.firestoreClientEmail || !config.firestorePrivateKey) {
                  throw new Error(
                      'Missing FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL/FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY for Firestore service-account access.'
                  );
              }

              return Firestore.useServiceAccount(
                  config.firestoreProjectId,
                  {
                      clientEmail: config.firestoreClientEmail,
                      privateKey: config.firestorePrivateKey
                  },
                  config.firestoreDatabaseId
              );
          })();

    cached = { key, db };
    return db;
};
