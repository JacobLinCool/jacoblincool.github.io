<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TypingTexts from './TypingTexts.svelte';

	const { Story } = defineMeta({
		title: 'Example/TypingTexts',
		component: TypingTexts,
		tags: ['autodocs'],
		argTypes: {
			speedIn: { control: 'number' },
			speedOut: { control: 'number' },
			gap: { control: 'number' }
		},
		args: {
			texts: ['Hello', 'World', 'Svelte'],
			speedIn: 100,
			speedOut: 50,
			gap: 500
		}
	});
</script>

<Story name="Default" />

<Story
	name="Fast Typing"
	args={{ texts: ['Fast', 'Typing', 'Effect'], speedIn: 50, speedOut: 25, gap: 100 }}
/>

<Story
	name="Slow Typing"
	args={{ texts: ['Slow', 'Typing', 'Effect'], speedIn: 200, speedOut: 100, gap: 300 }}
/>
