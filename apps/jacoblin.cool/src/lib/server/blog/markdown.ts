import { Marked } from 'marked';

export const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return entities[char];
    });

const safeUrl = (href: string, image = false): string | null => {
    try {
        const url = new URL(href, 'https://jacoblin.cool');
        const protocols = image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
        return protocols.includes(url.protocol) ? href : null;
    } catch {
        return null;
    }
};

export type Heading = { id: string; text: string; depth: number };

export function renderBlogMarkdown(source: string) {
    const headings: Heading[] = [];
    const ids = new Set<string>();
    const markdown = new Marked({ async: false, gfm: true, breaks: false });
    const renderer = new markdown.Renderer();
    renderer.html = ({ text }) => escapeHtml(text);
    renderer.heading = function ({ tokens, depth }) {
        const text = this.parser.parseInline(tokens, new markdown.TextRenderer());
        const base = `section-${
            text
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, '-')
                .replace(/^-|-$/g, '') || 'heading'
        }`;
        let id = base;
        let suffix = 2;
        while (ids.has(id)) id = `${base}-${suffix++}`;
        ids.add(id);
        // The article title is the page's only h1.
        const level = Math.max(2, depth);
        if (level <= 3) headings.push({ id, text, depth: level });
        return `<h${level} id="${id}">${this.parser.parseInline(tokens)}</h${level}>`;
    };
    renderer.link = function ({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        const url = safeUrl(href);
        return url
            ? `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`
            : label;
    };
    renderer.image = ({ href, title, text }) => {
        const url = safeUrl(href, true);
        return url
            ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`
            : escapeHtml(text);
    };
    markdown.use({ renderer });
    return { html: markdown.parse(source) as string, headings };
}
