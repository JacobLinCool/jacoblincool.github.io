import { renderFeed } from '$lib/server/blog/feed';
import { getPosts } from '$lib/server/blog/posts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
    new Response(renderFeed(getPosts()), {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
