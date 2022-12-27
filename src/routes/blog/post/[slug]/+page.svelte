<script lang="ts">
	export let data: { content: ConstructorOfATypedSvelteComponent };
</script>

<svelte:component this={data.content} />
