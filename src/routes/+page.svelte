<script lang="ts">
	import Ask from '$lib/components/Ask.svelte';
	import TypingTexts from '$lib/components/TypingTexts.svelte';
	import Navigation from '$lib/components/Navigation.svelte';

	let conversations: {
		role: 'assistant' | 'user';
		text: string;
		image?: string;
	}[] = [];

	let askComponent: Ask;

	async function ask(question: string) {
		console.log(`Asking: ${question}`);
		conversations = [...conversations, { role: 'user', text: question }];

		const res = await fetch('/api/ask', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ conversations })
		});

		if (!res.ok) {
			conversations = [
				...conversations,
				{
					role: 'assistant',
					text: 'Sorry, I cannot answer that question right now. Jacob may forget to pay the server bill.'
				}
			];
			return;
		}

		const { answer } = await res.json();
		console.log(answer);
		conversations = [...conversations, { role: 'assistant', ...answer }];
	}

	const starters = [
		'What projects are you currently working on?',
		'Draw me a portrait of Jacob!',
		'What is your favorite programming language?',
		'Why you ignore me?'
	];

	const titles = [
		'am a Passionate Developer',
		'am a Curious Lifelong Learner',
		'am a Maintainer of packages on NPM, PyPI, and crates.io',
		'am a Researcher of AI and HCI',
		'am a 4th Year CS Student at NTNU',
		'am a GDG on Campus Lead',
		'like milk tea',
		"don't like coffee",
		'like to play Taiko no Tatsujin, but not good at it :P'
	];
	titles.sort(() => Math.random() - 0.5);
</script>

{#if askComponent}
	<Navigation ask={askComponent._ask} />
{/if}

<main class="relative z-10 flex h-screen items-center justify-center bg-black p-8 text-white">
	<section class="w-full max-w-prose">
		<h1 class="mb-4 text-6xl font-bold">Jacob Lin</h1>
		<p class="mb-8 text-xl">
			I <TypingTexts texts={titles} speedIn={80} speedOut={40} />
		</p>
		<Ask bind:this={askComponent} {ask} {starters} {conversations} />
	</section>
</main>
