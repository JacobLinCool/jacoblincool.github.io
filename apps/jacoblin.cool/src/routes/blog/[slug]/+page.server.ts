import { dev } from '$app/environment';
import { getPost } from '$lib/server/blog/posts';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
    const post = getPost(params.slug, dev);
    if (!post) error(404, 'This article is not available.');
    return { post };
};
