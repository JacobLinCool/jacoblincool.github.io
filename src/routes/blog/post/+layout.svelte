<script lang="ts">
	import type { PostMetadata } from "$lib/server/blog";
	import "./base.css";
	import "./code.css";

	export let data: PostMetadata;
</script>

<svelte:head>
	<title>{data.meta.title} | Jacob Lin's Blog</title>
	<meta name="description" content={data.meta.description} />
	<meta name="keywords" content={data.meta.tags.join(", ")} />
	<meta name="author" content="Jacob Lin" />
	<meta name="date" content={data.meta.date} />
	<meta name="og:title" content={data.meta.title} />
	<meta name="og:description" content={data.meta.description} />
	<meta name="og:type" content="article" />
	<meta name="og:url" content={`https://jacoblin.cool/blog/post/${data.slug}`} />
	<meta name="og:image" content={data.meta.cover} />
</svelte:head>

<div id="blog">
	<h1 class="text-4xl leading-snug md:leading-snug md:text-6xl font-bold">
		{data.meta.title}
	</h1>
	{#if data.meta.tags.length}
		<div class="flex flex-wrap gap-2 mt-2">
			{#each data.meta.tags as tag}
				<a
					href="/blog/tag/{tag}"
					class="tag text-sm text-slate-500 hover:text-blue-700 transition-all"
				>
					#{tag}
				</a>
			{/each}
		</div>
	{/if}
	<hr class="border-2 border-slate-300 mt-2 mb-4" />
	<slot />
</div>
