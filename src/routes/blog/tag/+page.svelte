<script lang="ts">
	export let data: { tags: string[] };
</script>

<svelte:head>
	<title>All Tags | Jacob Lin's Blog</title>
</svelte:head>

<div class="w-full pt-24 px-4 md:px-8 lg:px-16">
	<h1 class="text-4xl leading-snug md:leading-snug md:text-6xl font-bold">Tags</h1>
	<hr class="w-1/2 border-2 border-slate-300 my-4" />

	{#each data.tags as tag}
		<a href="/blog/tag/{tag}" class="tag text-sm text-slate-500 hover:text-blue-700 transition-all">
			#{tag}
		</a>
	{/each}
</div>
