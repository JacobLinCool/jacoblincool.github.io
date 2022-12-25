<script lang="ts">
	import type { PostMetadata } from "$lib/server/blog";
	import "./base.css";
	import "./code.css";

	export let data: PostMetadata;
</script>

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
