<script lang="ts">
	import LogosGithubIcon from "~icons/logos/github-icon";
	import LogosLinkedinIcon from "~icons/logos/linkedin-icon";
	import LogosDiscordIcon from "~icons/logos/discord-icon";

	const links = [
		[LogosGithubIcon, "https://github.com/JacobLinCool"],
		[LogosLinkedinIcon, "https://www.linkedin.com/in/jacoblincool/"],
		[LogosDiscordIcon, "https://discord.gg/Ff8q2SGut2"],
	] as const;
</script>

<nav class="w-full p-2">
	<div class="w-full h-20 bg-slate-200 rounded-lg shadow shadow-slate-300 p-2">
		<div class="h-full flex flex-row">
			{#each links as [Icon, href]}
				<a class="flex flex-row items-center" {href} target="_blank" rel="noreferrer">
					<div class="flex flex-row items-center mx-2 md:mx-4">
						<div class="w-10 h-10 rounded-lg">
							<Icon class="w-full h-full rounded-lg" />
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</nav>
