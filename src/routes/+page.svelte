<script lang="ts">
	import Ask from '$lib/components/Ask.svelte';
	import TypingTexts from '$lib/components/TypingTexts.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { askQuestion } from '$lib/chat-client';
	import Head from '$lib/components/Head.svelte';

	let conversations: {
		role: 'assistant' | 'user';
		text: string;
		image?: string;
	}[] = $state([]);

	let askComponent: Ask | null = $state(null);

	class UpdateQueue {
		private queue: string[] = [];
		private processing = false;
		private callback: (text: string) => void;

		constructor(callback: (text: string) => void) {
			this.callback = callback;
		}

		async add(text: string) {
			this.queue.push(text);
			if (!this.processing) {
				this.processing = true;
				await this.process();
			}
		}

		async process() {
			while (this.queue.length > 0) {
				const text = this.queue.shift()!;
				this.callback(text);
				await new Promise((resolve) => setTimeout(resolve, 125));
			}
			this.processing = false;
		}

		async wait() {
			while (this.processing) {
				await new Promise((resolve) => setTimeout(resolve, 125));
			}
		}
	}

	async function ask(question: string) {
		console.log(`Asking: ${question}`);
		conversations = [
			...conversations,
			{ role: 'user', text: question },
			{ role: 'assistant', text: '' }
		];

		try {
			let usingTool = false;
			const updateQueue = new UpdateQueue((text) => {
				if (usingTool) {
					usingTool = false;
					conversations[conversations.length - 1].text = '';
				}
				conversations = conversations.map((conv, i) =>
					i === conversations.length - 1 ? { ...conv, text: conv.text + text } : conv
				);
			});

			const result = await askQuestion(conversations.slice(0, -1), {
				tool(message) {
					usingTool = true;
					conversations = [...conversations.slice(0, -1), { role: 'assistant', text: message }];
				},
				content: (text) => {
					updateQueue.add(text);
				},
				image: (imageUrl) => {
					conversations = conversations.map((conv, i) =>
						i === conversations.length - 1 ? { ...conv, image: imageUrl } : conv
					);
				},
				audio(audioUrl) {
					const audio = new Audio(audioUrl);
					audio.play();
				}
			});
			await updateQueue.wait();
		} catch (err) {
			console.error(err);
			conversations = [
				...conversations.slice(0, -1),
				{
					role: 'assistant',
					text: 'Sorry, I cannot answer that question right now. Jacob may forget to pay the server bill.'
				}
			];
		}
	}

	let started = $derived(conversations.length > 0);

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
		'am a Researcher of AI and Human-Computer Interaction',
		'am a 4th Year CS Student at NTNU',
		'am a GDG on Campus Lead',
		'like milk tea',
		"don't like coffee",
		'like to play Taiko no Tatsujin, but not good at it :P'
	];
	titles.sort(() => Math.random() - 0.5);
</script>

<Head />

{#if askComponent}
	<Navigation ask={askComponent._ask} />
{/if}

<main class="relative z-10 flex h-screen items-center justify-center bg-black p-8 text-white">
	<section class="w-full max-w-prose">
		<h1 class="mb-4 font-bold transition-all" class:text-6xl={!started} class:text-2xl={started}>
			Jacob Lin
		</h1>
		<p class="mb-8 transition-all" class:text-xl={!started} class:text-base={started}>
			I <TypingTexts texts={titles} speedIn={80} speedOut={40} />
		</p>
		<Ask bind:this={askComponent} {ask} {starters} {conversations} />
	</section>
</main>
