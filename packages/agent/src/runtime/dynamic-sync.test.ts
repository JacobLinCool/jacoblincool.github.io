import { describe, expect, it, vi } from 'vitest';
import { resolveDynamicTarget } from './dynamic-sync.js';
import { createMemorySnapshotStore } from './snapshot-store.js';

const jsonResponse = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });

describe('resolveDynamicTarget', () => {
    it('reuses an existing snapshot when refresh fails', async () => {
        const snapshotStore = createMemorySnapshotStore();
        const successFetch = vi.fn(async () =>
            jsonResponse({
                id: 'JacobLinCool/demo-model',
                downloads: 123,
                likes: 7
            })
        ) as typeof fetch;

        const initial = await resolveDynamicTarget({
            snapshotStore,
            fetchFn: successFetch,
            config: {
                githubToken: null,
                githubUser: 'JacobLinCool',
                huggingfaceUser: 'JacobLinCool'
            },
            target: {
                kind: 'huggingface_model_detail',
                source: 'huggingface',
                entityKey: 'JacobLinCool/demo-model'
            }
        });

        const failingFetch = vi.fn(async () => {
            throw new Error('network down');
        }) as typeof fetch;

        const fallback = await resolveDynamicTarget({
            snapshotStore,
            fetchFn: failingFetch,
            config: {
                githubToken: null,
                githubUser: 'JacobLinCool',
                huggingfaceUser: 'JacobLinCool'
            },
            target: {
                kind: 'huggingface_model_detail',
                source: 'huggingface',
                entityKey: 'JacobLinCool/demo-model'
            },
            forceRefresh: true
        });

        expect(fallback.payload).toEqual(initial.payload);
        expect(fallback.revision).toEqual(initial.revision);
    });
});
