import { env } from '$env/dynamic/private';
import { OpenAI } from 'openai';
import type {
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionMessage,
	ChatCompletionTool,
	ChatCompletionToolMessageParam
} from 'openai/resources/index.mjs';
import { getGitHubActivities } from './data/github';
import { getHuggingfaceActivities } from './data/huggingface';
import { draw } from './draw';
import { createChatSystemPrompt } from './prompts/chat';

export const openai = new OpenAI({
	baseURL: env.OPENAI_API_URL,
	apiKey: env.OPENAI_API_KEY
});

async function getActivities(owner: Owner): Promise<Activity[]> {
	const github = await getGitHubActivities(owner.usernames.github);
	const huggingface = await getHuggingfaceActivities(owner.usernames.huggingface);
	return [...github, ...huggingface].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const owner: Owner = {
	name: 'Jacob Lin',
	timezone: 'Asia/Taipei',
	usernames: {
		github: 'JacobLinCool',
		huggingface: 'JacobLinCool'
	},
	extraInformations: {
		recentActivities: {
			fetcher: getActivities
		}
	}
};

const assistant: Assistant = {
	name: "Jacob's Secretary",
	owner
};

async function fetchExtraInformation(assistant: Assistant, key: string) {
	const info = assistant.owner.extraInformations[key];
	if (info && !info.fetched) {
		try {
			info.data = await info.fetcher(assistant.owner);
			info.fetched = true;
		} catch (error) {
			info.error = String(error);
		}
	}
}

export async function chat(
	conversations: (
		| {
				role: 'assistant' | 'user';
				text: string;
		  }
		| ChatCompletionMessage
		| ChatCompletionToolMessageParam
	)[],
	depth = 0
): Promise<{
	text: string;
	image?: string;
}> {
	conversations = conversations.slice(-10);

	const tools: ChatCompletionTool[] = [
		{
			type: 'function',
			function: {
				name: 'drawPicture',
				description:
					'Draw a picture of Jacob based on the given description of scene and wearing, you should start with "Jacob, a young man ..."',
				parameters: {
					type: 'object',
					properties: {
						description: { type: 'string' }
					},
					required: ['description']
				}
			}
		}
	];

	const unfetchedExtraInformationKeys = Object.entries(assistant.owner.extraInformations)
		.filter(([key, info]) => !info.fetched)
		.map(([key]) => key);
	if (unfetchedExtraInformationKeys.length > 0) {
		tools.push({
			type: 'function',
			function: {
				name: 'fetchExtraInformation',
				description: 'Fetch extra information about the owner',
				parameters: {
					type: 'object',
					properties: {
						key: {
							type: 'string',
							enum: unfetchedExtraInformationKeys
						}
					},
					required: ['key']
				}
			}
		});
	}

	const payload: ChatCompletionCreateParamsNonStreaming = {
		model: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
		messages: [
			{
				role: 'system',
				content: createChatSystemPrompt(assistant)
			},
			...conversations.map((m) => {
				if ('tool_calls' in m) {
					return m;
				} else if (m.role === 'tool') {
					return m;
				} else {
					return {
						role: m.role,
						// @ts-expect-error
						content: m.text
					};
				}
			})
		],
		max_completion_tokens: parseInt(env.OPENAI_CHAT_MAX_COMPLETION_TOKENS || '0') || 512,
		tools
	};
	console.dir(payload, { depth: null });

	const moderation = await openai.moderations.create({
		model: 'omni-moderation-latest',
		input: payload.messages.map((m) => m.content).join('\n')
	});
	console.dir(moderation, { depth: null });
	if (moderation.results.some((result) => result.flagged)) {
		return {
			text: 'I am sorry, I am not able to provide an answer to your question.'
		};
	}

	const res = await openai.chat.completions.create(payload);
	const choice = res.choices[0];
	console.dir(choice, { depth: null });

	let content = choice.message.content ?? '';
	let image: string | undefined = undefined;
	if (choice.message.tool_calls) {
		conversations.push(choice.message);
		for (const tool_call of choice.message.tool_calls) {
			if (tool_call.function.name === 'fetchExtraInformation') {
				await fetchExtraInformation(assistant, JSON.parse(tool_call.function.arguments).key);
				conversations.push({
					role: 'tool',
					content:
						owner.extraInformations[JSON.parse(tool_call.function.arguments).key].error || 'done.',
					tool_call_id: tool_call.id
				});
			} else if (tool_call.function.name === 'drawPicture') {
				const description = JSON.parse(tool_call.function.arguments).description;
				image = await draw(description);
				if (!content) {
					content = "I've drawn a picture based on the given description:\n> " + description;
				}
			}
		}
	}

	if (!content && !image) {
		if (depth < 3) {
			return await chat(conversations, depth + 1);
		} else {
			return {
				text: 'I am sorry, I am not able to provide an answer to your question.'
			};
		}
	}

	return {
		text: content,
		image
	};
}

export interface Assistant {
	owner: Owner;
	name: string;
}

export interface Owner {
	name: string;
	timezone: string;
	usernames: {
		github: string;
		huggingface: string;
	};
	extraInformations: Record<string, ExtraInformation>;
}

export interface ExtraInformation<T = any> {
	fetcher: (owner: Owner) => Promise<T>;
	data?: T;
	error?: string;
	fetched?: boolean;
}

export interface Activity {
	timestamp: Date;
	description: string;
	link?: string;
}
