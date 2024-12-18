<script lang="ts">
	import { onMount } from 'svelte';

	let {
		texts,
		speedIn = 100,
		speedOut = 50,
		gap = 500
	}: { texts: string[]; speedIn?: number; speedOut?: number; gap?: number } = $props();
	let currentText = $state('');
	let currentIndex = 0;
	let isDeleting = false;

	let ref: ReturnType<typeof setTimeout>;

	onMount(() => {
		typeEffect();
		return () => clearTimeout(ref);
	});

	function typeEffect() {
		const fullText = texts[currentIndex];
		if (isDeleting) {
			currentText = fullText.substring(0, currentText.length - 1);
		} else {
			currentText = fullText.substring(0, currentText.length + 1);
		}

		if (!isDeleting && currentText === fullText) {
			ref = setTimeout(() => {
				isDeleting = true;
				typeEffect();
			}, gap);
		} else if (isDeleting && currentText === '') {
			ref = setTimeout(() => {
				isDeleting = false;
				currentIndex = (currentIndex + 1) % texts.length;
				typeEffect();
			}, gap);
		} else {
			ref = setTimeout(typeEffect, isDeleting ? speedOut : speedIn);
		}
	}
</script>

{currentText}
