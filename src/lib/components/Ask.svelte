<script lang="ts">
	import { fly } from 'svelte/transition';
	import { marked } from 'marked';

	let {
		ask,
		starters,
		conversations = []
	}: {
		ask: (q: string) => Promise<void>;
		starters: string[];
		conversations?: {
			role: 'assistant' | 'user';
			text: string;
			image?: string;
		}[];
	} = $props();

	let question = $state('');
	let asking = $state(false);

	let input: HTMLInputElement;

	export async function _ask(q?: string) {
		if (asking) {
			return;
		}
		if (q) {
			question = q;
		}
		asking = true;
		await ask(question);
		question = '';
		asking = false;
		scrollToBottom();

		setTimeout(() => {
			input?.focus();
		}, 0);
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.isComposing) {
			_ask();
		}
	}

	// svelte-ignore non_reactive_update
	let chatContainer: HTMLDivElement;

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	function renderMarkdown(text: string) {
		return marked(text);
	}
</script>

<div class="contents">
	{#if conversations.length > 0}
		<div
			class="my-4 flex max-h-[50vh] flex-col overflow-y-auto md:max-h-[75vh]"
			bind:this={chatContainer}
		>
			{#each conversations as conversation}
				<div
					class="mb-2 max-w-[90%] rounded-lg border border-gray-700 bg-gray-800 bg-opacity-50 p-2 {conversation.role ===
					'assistant'
						? 'self-start text-left'
						: 'self-end text-right'}"
				>
					<!-- <p class="font-bold">{conversation.role === 'assistant' ? name : 'You'}</p> -->
					<p class="prose prose-invert">{@html renderMarkdown(conversation.text)}</p>
					<!-- Render markdown content -->
					{#if conversation.image}
						<img src={conversation.image} alt="Response" class="mt-2 rounded-lg" />
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	<input
		bind:this={input}
		bind:value={question}
		disabled={asking}
		type="text"
		placeholder="Ask me questions ..."
		onkeypress={handleKeyPress}
		class="w-full rounded-full border-2 border-gray-700 bg-transparent p-4 transition-all focus:border-blue-600 focus:outline-none"
		class:animate-pulse={asking}
	/>
	{#if conversations.length === 0}
		<div class="mt-4" transition:fly={{ y: 20, duration: 300 }}>
			<div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
				{#each starters as starter}
					<button
						onclick={() => _ask(starter)}
						class="rounded-lg border border-gray-700 bg-transparent p-2 text-left">{starter}</button
					>
				{/each}
			</div>
		</div>
	{/if}
</div>
