<script lang="ts">
	import type { PostMetadata } from "$lib/server/blog";

	export let data: { content: ConstructorOfATypedSvelteComponent; meta: PostMetadata };
</script>

<svelte:component this={data.content} />
