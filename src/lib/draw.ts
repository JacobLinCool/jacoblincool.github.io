import { env } from '$env/dynamic/private';

export async function draw(prompt: string): Promise<string> {
	if (!prompt.includes('Jacob')) {
		prompt = 'Jacob. ' + prompt;
	}
	console.log('Generating image with prompt:', prompt);
	const response = await fetch(env.HUGGINFACE_IMAGE_API_URL, {
		method: 'POST',
		headers: {
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${env.HUGGINFACE_TOKEN}`,
			origin: 'https://huggingface.co',
			referer: 'https://huggingface.co/',
			'user-agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
			priority: 'u=1, i',
			'x-use-cache': 'false',
			'x-wait-for-model': 'true'
		},
		body: JSON.stringify({ inputs: prompt + ' natural photo cinematic' })
	});

	if (!response.ok) {
		throw new Error(`Failed to generate image: ${response.status}`);
	}
	console.log('Response headers:', Object.fromEntries(response.headers.entries()));

	const jpg = await response.arrayBuffer();
	const base64 = btoa(String.fromCharCode(...new Uint8Array(jpg)));
	return `data:image/jpeg;base64,${base64}`;
}
