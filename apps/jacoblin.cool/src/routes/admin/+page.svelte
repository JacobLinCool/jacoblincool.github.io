<script lang="ts">
    import { onMount } from 'svelte';
    import { auth } from '$lib/firebase/client';

    type ApiState<T> = {
        loading: boolean;
        error: string | null;
        data: T;
    };

    let contentState = $state<ApiState<Record<string, unknown> | null>>({
        loading: false,
        error: null,
        data: null
    });

    let dynamicState = $state<ApiState<Array<Record<string, unknown>>>>({
        loading: false,
        error: null,
        data: []
    });

    let conversationState = $state<ApiState<Array<Record<string, unknown>>>>({
        loading: false,
        error: null,
        data: []
    });

    let syncEntityKey = $state('');
    let syncSource = $state<'github' | 'huggingface'>('github');
    let syncKind = $state('');
    let syncResult = $state<string | null>(null);

    const getToken = async () => {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Sign in first to use admin APIs.');
        }
        return user.getIdToken();
    };

    const fetchWithAuth = async (input: string, init?: RequestInit) => {
        const token = await getToken();
        const response = await fetch(input, {
            ...init,
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
                ...(init?.headers ?? {})
            }
        });

        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
            error?: string;
        };
        if (!response.ok) {
            throw new Error(payload.error ?? `Request failed with status ${response.status}`);
        }

        return payload;
    };

    const loadContent = async () => {
        contentState.loading = true;
        contentState.error = null;

        try {
            contentState.data = await fetchWithAuth('/api/admin/content?locale=en');
        } catch (error) {
            contentState.error = error instanceof Error ? error.message : 'Failed to load content';
        } finally {
            contentState.loading = false;
        }
    };

    const loadDynamic = async () => {
        dynamicState.loading = true;
        dynamicState.error = null;

        try {
            const payload = (await fetchWithAuth('/api/admin/dynamic')) as {
                snapshots?: Array<Record<string, unknown>>;
            };
            dynamicState.data = payload.snapshots ?? [];
        } catch (error) {
            dynamicState.error =
                error instanceof Error ? error.message : 'Failed to load snapshots';
        } finally {
            dynamicState.loading = false;
        }
    };

    const loadConversations = async () => {
        conversationState.loading = true;
        conversationState.error = null;

        try {
            const payload = (await fetchWithAuth('/api/admin/conversations')) as {
                conversations?: Array<Record<string, unknown>>;
            };
            conversationState.data = payload.conversations ?? [];
        } catch (error) {
            conversationState.error =
                error instanceof Error ? error.message : 'Failed to load conversations';
        } finally {
            conversationState.loading = false;
        }
    };

    const forceSync = async () => {
        syncResult = null;

        try {
            const payload = (await fetchWithAuth(`/api/admin/sync/${syncSource}`, {
                method: 'POST',
                body: JSON.stringify({
                    entityKey: syncEntityKey.trim() || undefined,
                    kind: syncKind.trim() || undefined
                })
            })) as { snapshot?: { revision?: string } };
            syncResult = `Synced. revision=${payload.snapshot?.revision ?? 'n/a'}`;
            await Promise.all([loadDynamic(), loadConversations()]);
        } catch (error) {
            syncResult = error instanceof Error ? error.message : 'Sync failed';
        }
    };

    onMount(() => {
        void Promise.all([loadContent(), loadDynamic(), loadConversations()]);
    });
</script>

<section class="mx-auto max-w-6xl space-y-6 py-6">
    <header class="space-y-2">
        <p class="text-xs tracking-[0.18em] text-zinc-400 uppercase">Admin Panel</p>
        <h1 class="text-2xl font-semibold text-zinc-100">Content, Sync, and Conversations</h1>
    </header>

    <article class="rounded-2xl border border-white/10 bg-black/25 p-4">
        <h2 class="text-lg font-medium text-zinc-100">Force Dynamic Sync</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-4">
            <label class="text-sm text-zinc-300">
                Source
                <select
                    class="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
                    bind:value={syncSource}
                >
                    <option value="github">github</option>
                    <option value="huggingface">huggingface</option>
                </select>
            </label>
            <label class="text-sm text-zinc-300 sm:col-span-2">
                Entity key (optional)
                <input
                    class="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
                    placeholder="JacobLinCool/d1-manager or user:jacoblincool"
                    bind:value={syncEntityKey}
                />
            </label>
            <label class="text-sm text-zinc-300">
                Kind (optional)
                <input
                    class="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
                    placeholder="github_repo_detail"
                    bind:value={syncKind}
                />
            </label>
        </div>
        <div class="mt-3 flex items-center gap-3">
            <button
                type="button"
                class="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100"
                onclick={() => void forceSync()}
            >
                Force Sync
            </button>
            {#if syncResult}
                <p class="text-sm text-zinc-300">{syncResult}</p>
            {/if}
        </div>
    </article>

    <article class="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-zinc-100">Static Content Snapshot</h2>
            <button
                type="button"
                class="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200"
                onclick={() => void loadContent()}
            >
                Reload
            </button>
        </div>
        {#if contentState.loading}
            <p class="mt-3 text-sm text-zinc-400">Loading content...</p>
        {:else if contentState.error}
            <p class="mt-3 text-sm text-rose-300">{contentState.error}</p>
        {:else}
            <pre
                class="mt-3 max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-200">{JSON.stringify(
                    contentState.data,
                    null,
                    2
                )}</pre>
        {/if}
    </article>

    <article class="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-zinc-100">Dynamic Snapshots</h2>
            <button
                type="button"
                class="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200"
                onclick={() => void loadDynamic()}
            >
                Reload
            </button>
        </div>
        {#if dynamicState.loading}
            <p class="mt-3 text-sm text-zinc-400">Loading snapshots...</p>
        {:else if dynamicState.error}
            <p class="mt-3 text-sm text-rose-300">{dynamicState.error}</p>
        {:else}
            <pre
                class="mt-3 max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-200">{JSON.stringify(
                    dynamicState.data,
                    null,
                    2
                )}</pre>
        {/if}
    </article>

    <article class="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-zinc-100">Recent Conversations</h2>
            <button
                type="button"
                class="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200"
                onclick={() => void loadConversations()}
            >
                Reload
            </button>
        </div>
        {#if conversationState.loading}
            <p class="mt-3 text-sm text-zinc-400">Loading conversations...</p>
        {:else if conversationState.error}
            <p class="mt-3 text-sm text-rose-300">{conversationState.error}</p>
        {:else}
            <pre
                class="mt-3 max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-200">{JSON.stringify(
                    conversationState.data,
                    null,
                    2
                )}</pre>
        {/if}
    </article>
</section>
