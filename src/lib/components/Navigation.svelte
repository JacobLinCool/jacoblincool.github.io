<script lang="ts">
	import { config } from '$lib/config';
	let { ask }: { ask: (q: string) => Promise<void> } = $props();
	let isOpen = $state(false);

	const links = config.navigation.links;

	const handleLinkClick = async (question: string) => {
		await ask(question);
		isOpen = false;
	};
</script>

<nav class="fixed left-0 top-0 z-50 w-full p-4">
	<div class="mx-auto flex max-w-7xl items-center justify-between">
		<a href="/" class="text-2xl font-bold text-white">
			<img src={config.site.logo} alt="Logo" class="inline h-8 w-8 opacity-90" />
		</a>

		<!-- Mobile menu button -->
		<button class="text-white md:hidden" onclick={() => (isOpen = !isOpen)}>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if isOpen}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				{/if}
			</svg>
		</button>

		<!-- Desktop menu -->
		<div class="hidden space-x-8 md:flex">
			{#each links as { label, question }}
				<!-- svelte-ignore a11y_invalid_attribute -->
				<a
					href="javascript:void(0)"
					class="text-white transition-colors hover:text-gray-300"
					onclick={() => handleLinkClick(question)}
				>
					{label}
				</a>
			{/each}
		</div>
	</div>

	<!-- Mobile menu -->
	{#if isOpen}
		<div class="absolute left-0 top-full w-full bg-black/80 backdrop-blur-lg md:hidden">
			<div class="flex flex-col space-y-4 p-4">
				{#each links as { label, question }}
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a
						href="javascript:void(0)"
						class="text-white transition-colors hover:text-gray-300"
						onclick={() => handleLinkClick(question)}
					>
						{label}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</nav>
