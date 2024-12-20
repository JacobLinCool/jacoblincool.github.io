<script lang="ts">
	let {
		title = 'Jacob Lin',
		description = "Jacob Lin's personal website",
		image = 'https://jacoblin.cool/banner.jpg',
		type = 'website',
		url = 'https://jacoblin.cool'
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
