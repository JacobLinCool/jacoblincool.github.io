import { renderChatMarkdown } from '$lib/utils/chat-markdown';
import { describe, expect, it } from 'vitest';

describe('renderChatMarkdown', () => {
    it('renders markdown links in a new tab', () => {
        const html = renderChatMarkdown('[Jacob](https://jacoblin.cool)');

        expect(html).toContain('href="https://jacoblin.cool"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noreferrer noopener"');
    });

    it('escapes raw html instead of rendering it', () => {
        const html = renderChatMarkdown('<script>alert(1)</script>');

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });

    it('blocks unsafe link protocols', () => {
        const html = renderChatMarkdown('[bad](javascript:alert(1))');

        expect(html).not.toContain('<a ');
        expect(html).toContain('<span>bad</span>');
    });
});
