<script lang="ts">
	import { onMount } from "svelte";
	import ArticleCard from "$lib/components/ArticleCard.svelte";
	import type { PostMetadata } from "$lib/server/blog/db";
	import { preload } from "$lib/preload";

	export let data: { posts: PostMetadata[] };

	onMount(() => {
		preload(data.posts.slice(0, 3).map((post) => `/blog/post/${post.slug}`));
	});
</script>

<svelte:head>
	<title>Jacob Lin's Blog</title>
</svelte:head>

<div class="w-full pt-24 px-4 md:px-8 lg:px-16">
	<h1 class="text-4xl leading-snug md:leading-snug md:text-6xl font-bold">Blog</h1>
	<hr class="w-1/2 border-2 border-slate-300 my-4" />

	<div>
		<p class="mb-4">I write about things I find interesting.</p>
	</div>

	<div class="w-full">
		{#each data.posts as post}
			<ArticleCard {post} />
		{/each}
	</div>
</div>
