export interface Tag {
	name: string;
	slug?: string;
	sub?: Record<string, Tag>;
	inheritable?: boolean;
}

const all: Tag = {
	name: "All",
	inheritable: false,
	sub: {
		web: {
			name: "Web",
			sub: {
				svelte: {
					name: "Svelte",
					sub: {
						sveltekit: {
							name: "SvelteKit",
						},
					},
				},
			},
		},
		school: {
			name: "School",
			sub: {
				university: {
					name: "University",
				},
			},
		},
	},
};

export default all;
