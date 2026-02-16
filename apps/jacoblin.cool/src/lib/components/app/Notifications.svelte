<script lang="ts">
    import { onDestroy } from 'svelte';
    import { notificationStore, type NotificationLevel } from '$lib/stores/notification.svelte';

    let timers = $state<Record<string, ReturnType<typeof setTimeout>>>({});

    const levelClasses: Record<NotificationLevel, string> = {
        info: 'border-cyan-300/45 bg-cyan-400/18 text-cyan-50',
        success: 'border-emerald-300/45 bg-emerald-400/18 text-emerald-50',
        warning: 'border-amber-300/45 bg-amber-400/18 text-amber-50',
        error: 'border-rose-300/45 bg-rose-400/20 text-rose-50'
    };

    $effect(() => {
        const activeIds = new Set(notificationStore.state.items.map((item) => item.id));

        for (const item of notificationStore.state.items) {
            if (timers[item.id]) {
                continue;
            }

            const timeoutId = setTimeout(() => {
                notificationStore.remove(item.id);
                delete timers[item.id];
            }, 3400);

            timers[item.id] = timeoutId;
        }

        for (const [id, timeoutId] of Object.entries(timers)) {
            if (activeIds.has(id)) {
                continue;
            }
            clearTimeout(timeoutId);
            delete timers[id];
        }
    });

    onDestroy(() => {
        for (const timeoutId of Object.values(timers)) {
            clearTimeout(timeoutId);
        }
        timers = {};
    });
</script>

<div class="pointer-events-none fixed top-20 right-4 z-60 flex w-[min(92vw,24rem)] flex-col gap-2">
    {#each notificationStore.state.items as item (item.id)}
        <div
            role="status"
            class={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/35 backdrop-blur-xl ${levelClasses[item.level]}`}
        >
            {item.message}
        </div>
    {/each}
</div>
