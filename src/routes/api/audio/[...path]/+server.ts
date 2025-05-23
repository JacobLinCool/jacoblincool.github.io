import { getSpace } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { path } = params;
	const space = await getSpace();
	const host = space.config?.root;
	if (!host) {
		throw new Error('Space host not found');
	}
	const url = `${host}${space.api_prefix || ''}/file=/${path}`;
	return fetch(url, {
		headers: {
			Authorization: `Bearer ${space.options.hf_token}`
		}
	});
};
