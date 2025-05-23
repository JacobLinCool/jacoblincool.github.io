export interface Tag {
	name: string;
	slug?: string;
	description?: string;
	sub?: Record<string, Tag>;
	inheritable?: boolean;
}

const all: Tag = {
	name: 'All',
	inheritable: false,
	sub: {
		web: {
			name: 'Web',
			sub: {
				svelte: {
					name: 'Svelte',
					sub: {
						sveltekit: {
							name: 'SvelteKit'
						}
					}
				}
			}
		},
		school: {
			name: 'School',
			sub: {
				university: {
					name: 'University',
					sub: {
						ntnu: {
							name: 'NTNU'
						}
					}
				}
			}
		},
		project: {
			name: 'Project',
			sub: {
				unicourse: {
					name: 'UniCourse'
				}
			}
		}
	}
};

export default all;
