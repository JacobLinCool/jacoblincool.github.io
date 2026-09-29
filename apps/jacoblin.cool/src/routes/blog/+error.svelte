<script lang="ts">
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
</script>

<svelte:head
    ><title>{page.status} · Blog · Jacob Lin</title><meta
        name="robots"
        content="noindex"
    /></svelte:head
>
<div class="reading-page py-12">
    <h1 class="text-3xl font-medium">
        {page.status === 404 ? 'Article not found' : 'Unable to load this article'}
    </h1>
    <p class="mt-4 text-zinc-300">
        {page.status === 404
            ? 'This article may have moved or is not published yet.'
            : 'Please try again in a moment.'}
    </p>
    <a href={resolve('/blog')} class="reading-link mt-6 inline-block">Back to all posts</a>
</div>
