<script lang="ts">
	import ArticleCard from "./ArticleCard.svelte";
	import type { PostMetadata } from "$lib/server/blog/db";
	import { onMount } from "svelte";

	export let slug: string;
	export let cover = false;

	let post: PostMetadata = {
		title: "Loading ...",
		slug: slug,
		description: "Loading ...",
		date: new Date().toISOString(),
		cover: "/blog-cover.png",
		readtime: "unknown time",
		tags: [],
		author: { name: "", slug: "" },
	};

	onMount(async () => {
		const res = await fetch(`/api/blog/posts/${slug}`);
		const data = await res.json();
		post = data;
	});
</script>

<ArticleCard {post} {cover} />
