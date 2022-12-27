<script lang="ts">
	import { onMount } from "svelte";
	import type { PostMetadata } from "$lib/server/blog/db";
	import { preload } from "$lib/preload";
	import "./base.css";
	import "./code.css";

	export let data: PostMetadata;

	onMount(() => {
		preload(
			data.tags.map((tag) => `/blog/tag/${tag.slug}`),
			500,
		);
	});
</script>

<svelte:head>
	<title>{data.title} | Jacob Lin's Blog</title>
	<meta name="description" content={data.description} />
	<meta name="keywords" content={data.tags.map((t) => t.name).join(", ")} />
	<meta name="author" content={data.author.name} />
	<meta name="date" content={data.date} />
	<meta name="og:title" content={data.title} />
	<meta name="og:description" content={data.description} />
	<meta name="og:type" content="article" />
	<meta name="og:url" content={`https://jacoblin.cool/blog/post/${data.slug}`} />
	<meta name="og:image" content={data.cover} />
</svelte:head>

<div id="blog">
	<h1 class="text-4xl leading-snug md:leading-snug md:text-6xl font-bold">
		{data.title}
	</h1>
	{#if data.tags.length}
		<div class="flex flex-wrap gap-2 mt-2">
			{#each data.tags as tag}
				<a
					href="/blog/tag/{tag.slug}"
					class="tag text-sm text-slate-500 hover:text-blue-700 transition-all"
				>
					#{tag.name}
				</a>
			{/each}
		</div>
	{/if}
	<hr class="border-2 border-slate-300 mt-2 mb-4" />
	<slot />
</div>
