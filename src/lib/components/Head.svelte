<script lang="ts">
	import { config } from '$lib/config';
	let {
		title = config.site.title,
		description = config.site.description,
		image = config.site.image,
		type = config.site.type,
		url = config.site.url
	}: {
		title?: string;
		description?: string;
		image?: string;
		type?: string;
		url?: string;
	} = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	<!-- Open Graph -->
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />

	<!-- Other essential meta tags -->
	{#if url}
		<link rel="canonical" href={url} />
	{/if}
</svelte:head>
