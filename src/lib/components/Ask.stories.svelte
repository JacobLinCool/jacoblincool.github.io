<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Ask from './Ask.svelte';

	const { Story } = defineMeta({
		title: 'Example/Ask',
		component: Ask,
		tags: ['autodocs'],
		argTypes: {
			ask: { action: 'ask' },
			starters: { control: 'object' },
			conversations: { control: 'object' }
		},
		args: {
			starters: ['What is your name?', 'What do you do?', 'Tell me a joke.'],
			conversations: []
		}
	});
</script>

<Story name="Default" />

<Story
	name="With Conversations"
	args={{
		conversations: [
			{ role: 'user', text: 'Hello!' },
			{ role: 'assistant', text: 'Hi there! How can I help you today?' }
		]
	}}
/>

<Story
	name="Custom Starters"
	args={{
		starters: ['How are you?', 'What is your favorite color?', 'Tell me a fun fact.']
	}}
/>
