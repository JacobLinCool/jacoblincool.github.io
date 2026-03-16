import { Marked, type Tokens } from 'marked';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SITE_ORIGIN = 'https://jacoblin.cool';

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const sanitizeUrl = (value: string | null | undefined) => {
    const href = value?.trim();
    if (!href) {
        return null;
    }

    if (href.startsWith('#') || href.startsWith('/')) {
        return href;
    }

    if (href.startsWith('./') || href.startsWith('../')) {
        return href;
    }

    try {
        const parsed = new URL(href, SITE_ORIGIN);
        if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
            return null;
        }
        return href;
    } catch {
        return null;
    }
};

const markedInstance = new Marked();
const renderer = new markedInstance.Renderer();

renderer.html = ({ text }) => escapeHtml(text);

renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const safeHref = sanitizeUrl(href);
    const label = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

    if (!safeHref) {
        return `<span>${label}</span>`;
    }

    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer noopener"${titleAttr}>${label}</a>`;
};

renderer.image = ({ href, title, text }: Tokens.Image) => {
    const safeHref = sanitizeUrl(href);
    if (!safeHref) {
        return escapeHtml(text);
    }

    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(text)}" loading="lazy"${titleAttr}>`;
};

const markdown = new Marked({
    async: false,
    breaks: true,
    gfm: true,
    renderer
});

export const renderChatMarkdown = (source: string) => markdown.parse(source) as string;
