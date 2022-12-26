export const file = {
	...import.meta.glob("/blog/authors/**/*.md"),
	...import.meta.glob("blog/posts/**/*.md"),
} as Record<string, () => Promise<{ default: ConstructorOfATypedSvelteComponent }>>;
