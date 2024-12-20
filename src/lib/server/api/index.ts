import { env } from '$env/dynamic/private';
import { Client } from '@gradio/client';
import { Octokit } from '@octokit/rest';
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

export const space = await Client.connect(env.HUGGINFACE_VC_SPACE, {
	hf_token: env.HUGGINFACE_TOKEN as `hf_${string}`
});
