import { env } from '$env/dynamic/private';
import { config } from '$lib/config';
import { openai } from '$lib/server/api';
import type {
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionMessage,
	ChatCompletionTool,
	ChatCompletionToolMessageParam
} from 'openai/resources/index.mjs';
import { extendConfig, type ServerConfig } from './config';
import { draw } from './draw';
import { createChatSystemPrompt } from './prompts/chat';

const serverConfig = extendConfig(config);

async function fetchExtraInformation(config: ServerConfig, key: string) {
	const info = config.owner.extraInformations[key];
	if (info && !info.fetched) {
		try {
			info.data = await info.fetcher(config.owner);
			info.fetched = true;
		} catch (error) {
			info.error = String(error);
		}
	}
}

export async function* chatStream(
	conversations: (
		| { role: 'assistant' | 'user'; text: string }
		| ChatCompletionMessage
		| ChatCompletionToolMessageParam
	)[],
	depth = 0
): AsyncGenerator<{ type: 'tool' | 'content' | 'image' | 'done'; data: any }> {
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

	const unfetchedExtraInformationKeys = Object.entries(serverConfig.owner.extraInformations)
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
				content: createChatSystemPrompt(serverConfig)
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
		yield {
			type: 'done',
			data: 'I am sorry, I am not able to provide an answer to your question.'
		};
		return;
	}

	const stream = await openai.chat.completions.create({
		...payload,
		stream: true
	});

	let buffer = '';
	let functionArguments = '';
	let functionName = '';
	let isCollectingFunctionArgs = false;
	for await (const chunk of stream) {
		const choice = chunk.choices[0];
		const delta = choice.delta;
		if (!choice || !delta) {
			continue;
		}

		const content = delta.content || '';
		buffer += content;
		if (content) {
			yield { type: 'content', data: content };
		}

		if (delta.tool_calls) {
			isCollectingFunctionArgs = true;
			const toolCall = delta.tool_calls[0];

			if (toolCall.function?.name) {
				functionName = toolCall.function.name;
			}

			if (toolCall.function?.arguments) {
				functionArguments += toolCall.function.arguments;
			}
		}

		if (choice.finish_reason === 'tool_calls' && isCollectingFunctionArgs) {
			console.log(`Function call '${functionName}' is complete.`);

			const args = JSON.parse(functionArguments);
			console.log('Complete function arguments:', args);

			yield { type: 'tool', data: JSON.stringify({ name: functionName, args }) };

			if (functionName === 'fetchExtraInformation') {
				await fetchExtraInformation(serverConfig, args.key);
			} else if (functionName === 'drawPicture') {
				const description = args.description;

				const messages = [
					'I ',
					'am ',
					'drawing ',
					'a ',
					'picture ',
					'with ',
					'[FLUXd-jacob-v0.1]',
					'(https://huggingface.co/JacobLinCool/FLUXd-jacob-v0.1) ',
					'based ',
					'on ',
					'the ',
					'following ',
					'description:',
					'\n> '
				];
				for (const message of messages) {
					yield { type: 'content', data: message };
				}
				for (const part of description.split(' ')) {
					yield { type: 'content', data: part + ' ' };
				}

				const image = await draw(description);
				yield { type: 'image', data: image };

				yield { type: 'done', data: null };
				return;
			}

			functionArguments = '';
			functionName = '';
			isCollectingFunctionArgs = false;
		}
	}

	if (buffer.length === 0 && depth < 3) {
		yield* chatStream(conversations, depth + 1);
		return;
	}

	yield { type: 'done', data: null };
}

// Move these interfaces to a shared types file if needed by other components
export interface ExtraInformation<T = any> {
	fetcher: (owner: ServerConfig['owner']) => Promise<T>;
	data?: T;
	error?: string;
	fetched?: boolean;
}

export interface Activity {
	timestamp: Date;
	description: string;
	link?: string;
}
