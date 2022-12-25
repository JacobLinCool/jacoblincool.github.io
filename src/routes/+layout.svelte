<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";
	import Nav from "$lib/components/Nav.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import { page } from "$app/stores";
	import { Mouse } from "$lib/mouse";
	import { touchable } from "$lib/misc";

	let mouse: Mouse;
	let show_nav = false;
	let hover_nav = false;
	let show_footer = false;
	let hover_footer = false;

	onMount(() => {
		show_nav = touchable();

		mouse = new Mouse();

		const edge = touchable() ? 50 : 10;
		mouse.on("change", (e) => {
			if (e.y[0] <= edge) {
				show_nav = true;
			} else if (!hover_nav) {
				show_nav = false;
			}

			if (e.y[1] <= edge) {
				show_footer = true;
			} else if (!hover_footer) {
				show_footer = false;
			}
		});
	});

	const duration = 300;
</script>

<div
	class="fixed w-full z-50 transition-transform transform-gpu"
	style="transform: translateY({show_nav
		? 0
		: -100}%); transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.15);"
	on:mouseenter={() => (hover_nav = true)}
	on:mouseleave={() => (hover_nav = false)}
>
	<Nav />
</div>

{#key $page.url.href}
	<div class="w-full h-full" in:fly={{ y: -5, duration: duration }}>
		<slot />
	</div>
{/key}

<div
	class="fixed bottom-0 w-full z-50 transition-transform transform-gpu"
	style="transform: translateY({show_footer
		? 0
		: 100}%); transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.15);"
	on:mouseenter={() => (hover_footer = true)}
	on:mouseleave={() => (hover_footer = false)}
>
	<Footer />
</div>
