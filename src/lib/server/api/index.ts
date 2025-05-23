import { env } from '$env/dynamic/private';
import { Octokit } from '@octokit/rest';
import { Client } from 'custom-gradio-client';
import { OpenAI } from 'openai';

export const openai = new OpenAI({
	baseURL: env.OPENAI_API_URL,
	apiKey: env.OPENAI_API_KEY
});

export const octokit = new Octokit({
	auth: env.GITHUB_TOKEN
});

// patch "The 'credentials' field on 'RequestInitializerDict' is not implemented."
// on Cloudflare Workers.
globalThis.fetch = ((f) => {
	type P = Parameters<typeof f>;
	return (input: P[0], init?: P[1]) => {
		if (init?.credentials) {
			delete init.credentials;
		}
		return f(input, init);
	};
})(globalThis.fetch);
globalThis.Request = ((OriginalRequest) => {
	type P = ConstructorParameters<typeof OriginalRequest>;
	return class Request extends OriginalRequest {
		constructor(input: P[0], init?: P[1]) {
			if (init?.credentials) {
				delete init.credentials;
			}
			super(input, init);
		}
	};
})(globalThis.Request);

let _space: Promise<Client> | null = null;
export async function getSpace() {
	if (_space) {
		return _space;
	}
	_space = Client.connect(env.HUGGINFACE_VC_SPACE, {
		hf_token: env.HUGGINFACE_TOKEN as `hf_${string}`
	});
	return _space;
}
