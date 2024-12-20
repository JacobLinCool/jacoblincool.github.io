export const config = {
	site: {
		title: 'Jacob Lin',
		description: "Jacob Lin's personal website",
		image: 'https://jacoblin.cool/banner.jpg',
		type: 'website',
		url: 'https://jacoblin.cool',
		logo: '/logo.svg'
	},
	personal: {
		name: 'Jacob Lin',
		titles: [
			...shuffle([
				'am a Passionate Developer',
				'am a Curious Lifelong Learner',
				'am a Maintainer of packages on NPM, PyPI, and crates.io',
				'am a Researcher of AI and Human-Computer Interaction',
				'am a 4th Year CS Student at NTNU',
				'am a GDG on Campus Lead'
			]),
			...shuffle([
				'like milk tea',
				"don't like coffee",
				'like to play Taiko no Tatsujin, but not good at it :P'
			])
		],
		starters: [
			'What projects are you currently working on?',
			'Draw me a portrait of Jacob!',
			'What is your favorite programming language?',
			'Why you ignore me?'
		]
	},
	navigation: {
		links: [
			{ href: '#about', label: 'About', question: 'Tell me about yourself' },
			{ href: '#projects', label: 'Projects', question: 'What projects have you done?' },
			{ href: '#contact', label: 'Contact', question: 'How can I contact you?' }
		]
	},
	ask: {
		defaultErrorMessage:
			'Sorry, I cannot answer that question right now. Jacob may forget to pay the server bill.'
	},
	owner: {
		name: 'Jacob Lin',
		timezone: 'Asia/Taipei',
		usernames: {
			github: 'JacobLinCool',
			huggingface: 'JacobLinCool'
		}
	}
} satisfies Config;

function shuffle<T>(array: T[]): T[] {
	array.sort(() => Math.random() - 0.5);
	return array;
}

export interface Config {
	site: {
		title: string;
		description: string;
		image: string;
		type: string;
		url: string;
		logo: string;
	};
	personal: {
		name: string;
		titles: string[];
		starters: string[];
	};
	navigation: {
		links: { href: string; label: string; question: string }[];
	};
	ask: {
		defaultErrorMessage: string;
	};
	owner: {
		name: string;
		timezone: string;
		usernames: {
			github: string;
			huggingface: string;
		};
	};
}
