<script lang="ts">
	import { page } from "$app/stores";

	const links = [
		["About", "/about"],
		["Contact", "/contact"],
	] as const;
</script>

<nav class="w-full p-2">
	<div class="w-full h-20 bg-slate-200 rounded-lg shadow shadow-slate-300 p-2">
		<div class="h-full flex flex-row justify-between">
			<div class="flex flex-row">
				<a class="flex flex-row items-center" href="/">
					<div class="flex flex-row items-center">
						<div class="w-10 h-10 bg-slate-300 rounded-lg shadow shadow-slate-300">
							<img src="/logo.png" alt="Jacob's Logo" class="w-full h-full rounded-lg" />
						</div>
						<div class="ml-2 text-slate-700 font-bold">Jacob Lin</div>
					</div>
				</a>
			</div>
			<div class="flex flex-row">
				{#each links as [display, href]}
					<div class="flex flex-row items-center mr-2">
						<div
							class="ml-2 text-slate-700 font-bold transition-all"
							class:font-bold={href === $page.url.pathname}
						>
							<a {href}>{display}</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</nav>
