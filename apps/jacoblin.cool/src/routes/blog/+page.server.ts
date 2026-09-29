import { dev } from '$app/environment';
import { getPosts } from '$lib/server/blog/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ posts: getPosts(dev), preview: dev });
