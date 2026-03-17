import {
    getHomeApiPayload,
    getHomeStaticPayload,
    streamHomeMetrics
} from '$lib/server/content/home-service';
import { upsertDynamicSnapshot } from '$lib/server/repos/dynamic-snapshot-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { FakeFirestore } from '$lib/server/test-helpers/fake-firestore';
import { describe, expect, it, vi } from 'vitest';

const config: RuntimeConfig = {
    firestoreProjectId: 'demo-test',
    firestoreDatabaseId: '(default)',
    firestoreClientEmail: null,
    firestorePrivateKey: null,
    firestoreEmulatorHost: '127.0.0.1:8080',
    geminiApiBaseUrl: 'https://example.invalid/v1beta',
    geminiApiKey: 'test-key',
    geminiModel: 'gemini-3.1-flash-lite-preview',
    geminiMaxOutputTokens: 512,
    githubToken: null,
    githubUser: 'JacobLinCool',
    huggingfaceUser: 'JacobLinCool'
};

describe('home service', () => {
    it('returns static homepage data without blocking on metrics', () => {
        const payload = getHomeStaticPayload();

        expect(payload).toMatchObject({
            contentVersion: expect.any(String),
            homeUi: {
                sections: expect.any(Object)
            },
            chatConfig: {
                taglines: expect.any(Array),
                promptChips: expect.any(Array)
            }
        });
        expect(payload.homePayload).not.toHaveProperty('metrics');
    });

    it('streams cached dynamic metrics as a ready result', async () => {
        const db = new FakeFirestore();

        await upsertDynamicSnapshot(db as never, {
            source: 'github',
            entityKey: 'user:jacoblincool',
            payload: {
                followers: 321,
                publicRepos: 45,
                totalStars: 678,
                topRepo: {
                    name: 'rust-agent',
                    stars: 42,
                    url: 'https://github.com/JacobLinCool/rust-agent'
                }
            },
            ttlMs: 60_000
        });
        await upsertDynamicSnapshot(db as never, {
            source: 'huggingface',
            entityKey: 'user:jacoblincool',
            payload: {
                models: 4,
                spaces: 2,
                totalModelDownloads: 1200,
                topModel: {
                    id: 'JacobLinCool/demo-model',
                    downloads: 900
                },
                topSpace: {
                    id: 'JacobLinCool/demo-space',
                    likes: 25
                }
            },
            ttlMs: 60_000
        });

        const metrics = await streamHomeMetrics(
            db as never,
            vi.fn(async () => {
                throw new Error('Should not fetch when snapshots are fresh.');
            }) as typeof fetch,
            config
        );

        expect(metrics).toMatchObject({
            status: 'ready',
            data: {
                dynamicRevisions: {
                    'github:user:jacoblincool': expect.any(String),
                    'huggingface:user:jacoblincool': expect.any(String)
                },
                metrics: {
                    github: {
                        followers: 321,
                        publicRepos: 45,
                        totalStars: 678,
                        topRepo: {
                            name: 'rust-agent',
                            stars: 42
                        }
                    },
                    huggingface: {
                        models: 4,
                        spaces: 2,
                        totalModelDownloads: 1200
                    },
                    scholar: {
                        citations: expect.any(Number)
                    }
                }
            }
        });
    });

    it('keeps the page alive when streamed metrics fail', async () => {
        const db = new FakeFirestore();
        const fetchFn: typeof fetch = vi.fn(async () => {
            throw new Error('upstream unavailable');
        }) as typeof fetch;
        const isolatedConfig: RuntimeConfig = {
            ...config,
            githubUser: 'JacobLinCoolMetricsFailure',
            huggingfaceUser: 'JacobLinCoolMetricsFailure'
        };

        const metrics = await streamHomeMetrics(db as never, fetchFn, isolatedConfig);

        expect(metrics).toEqual({
            status: 'error',
            message: 'Live metrics are temporarily unavailable.'
        });
    });

    it('still serves the full api payload for /api/home', async () => {
        const db = new FakeFirestore();

        await upsertDynamicSnapshot(db as never, {
            source: 'github',
            entityKey: 'user:jacoblincool',
            payload: {
                followers: 1,
                publicRepos: 2,
                totalStars: 3,
                topRepo: {
                    name: 'demo',
                    stars: 4,
                    url: 'https://github.com/JacobLinCool/demo'
                }
            },
            ttlMs: 60_000
        });
        await upsertDynamicSnapshot(db as never, {
            source: 'huggingface',
            entityKey: 'user:jacoblincool',
            payload: {
                models: 5,
                spaces: 6,
                totalModelDownloads: 7,
                topModel: {
                    id: 'JacobLinCool/model',
                    downloads: 8
                },
                topSpace: {
                    id: 'JacobLinCool/space',
                    likes: 9
                }
            },
            ttlMs: 60_000
        });

        const payload = await getHomeApiPayload(
            db as never,
            vi.fn(async () => {
                throw new Error('Should not fetch when snapshots are fresh.');
            }) as typeof fetch,
            config
        );

        expect(payload.homePayload.metrics.github.followers).toBe(1);
        expect(payload.dynamicRevisions).toEqual({
            'github:user:jacoblincool': expect.any(String),
            'huggingface:user:jacoblincool': expect.any(String)
        });
    });
});
