#!/usr/bin/env node
/**
 * Opt-in UI fixture: from apps/jacoblin.cool, run `node scripts/inspect-chat-scroll.mjs`.
 * Open http://127.0.0.1:5175/__scroll_lab for viewport/scenario controls, or
 * http://127.0.0.1:5175/?__scroll_check=1&scenario=long for direct keyboard testing.
 * Uses the real layout and chat components with synthetic, in-memory messages only.
 * No production sources are rewritten; chat API requests and live home metrics are disabled.
 * This Vite process shares .svelte-kit/Paraglide output: finish builds/checks before launching.
 * CSS motion suppression is not OS/media-query emulation; use browser emulation for that.
 */
import { fileURLToPath } from 'node:url';
import { createServer, normalizePath } from 'vite';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const pagePath = normalizePath(
    fileURLToPath(new URL('../src/routes/+page.svelte', import.meta.url))
);
const loadPath = normalizePath(
    fileURLToPath(new URL('../src/routes/+page.server.ts', import.meta.url))
);
const fixturePath = fileURLToPath(
    new URL('../tests/fixtures/ChatScrollControls.svelte', import.meta.url)
);
const fixtureDirectory = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));

const actions = [
    ['idle', 'Idle'],
    ['short', 'Short'],
    ['long', 'Long'],
    ['huge', 'Huge answer'],
    ['pending', 'Pending'],
    ['expand', 'Expand status'],
    ['collapse', 'Collapse status'],
    ['burst', 'Stream burst'],
    ['start', 'Start stream'],
    ['done', 'Done'],
    ['stop', 'Stop'],
    ['error', 'Error'],
    ['new', 'New turn'],
    ['race', 'New turn + chunk'],
    ['clear', 'Clear'],
    ['top', 'Scroll top'],
    ['bottom', 'Scroll bottom'],
    ['older', 'Read older'],
    ['focus', 'Focus transcript'],
    ['latest', 'Jump latest'],
    ['report', 'Refresh measurements'],
    ['large-text', 'Larger text'],
    ['normal-text', 'Normal text']
];
const labHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat scroll lab</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:16px;background:#111827;color:#e5e7eb;font:14px system-ui,sans-serif}
header{max-width:1320px;margin:0 auto 16px}h1{margin:0 0 6px;font-size:20px}p{margin:6px 0;color:#cbd5e1}
.controls{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}button{border:1px solid #64748b;border-radius:6px;padding:7px 10px;background:#1e293b;color:inherit;cursor:pointer}
button:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}button:hover{background:#334155}button:disabled{opacity:.4;cursor:wait}
output{display:block;min-height:20px;font-variant-numeric:tabular-nums}.viewport{overflow:auto;padding-bottom:12px}iframe{display:block;margin:auto;border:1px solid #64748b;background:#010204;max-width:none}
#fixture-metrics{max-height:150px;overflow:auto;padding:8px;background:#0f172a;font:12px ui-monospace,monospace;white-space:pre-wrap}
a{color:#7dd3fc}label{display:inline-flex;gap:6px;align-items:center}
</style></head><body>
<header><h1>Chat scroll lab</h1>
<p>Synthetic conversations in the real homepage layout. Controls stay outside the measured viewport. No model requests.</p>
<div class="controls" aria-label="Viewport presets">
<button data-size="1280,800">Desktop</button><button data-size="390,844">Narrow</button>
<button data-size="390,480">Small</button><button data-size="800,360">Compact</button>
<label><input id="reduce-motion" type="checkbox">Reduce CSS motion</label>
</div>
<div class="controls" aria-label="Conversation scenarios">${actions.map(([action, label]) => `<button data-action="${action}" disabled>${label}</button>`).join('')}</div>
<output id="fixture-status" aria-label="Fixture status">Loading fixture…</output>
<pre id="fixture-metrics" aria-label="Fixture geometry">Waiting for rendered measurements…</pre>
<p>Short: 1 pair · Long: 30 pairs · Huge: one long answer with code and a table. CSS motion control does not emulate the OS preference.
<a href="/?__scroll_check=1&scenario=long" target="_blank" rel="noopener">Open direct keyboard fixture</a></p>
</header><div class="viewport"><iframe id="chat-frame" title="Chat scroll fixture" width="1280" height="800" src="/?__scroll_check=1&scenario=short"></iframe></div>
<script type="module">
const frame=document.getElementById('chat-frame');
const status=document.getElementById('fixture-status');
const metrics=document.getElementById('fixture-metrics');
const send=(action,value)=>frame.contentWindow.postMessage({type:'chat-scroll-command',action,value},location.origin);
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.action)));
document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{
 const [width,height]=button.dataset.size.split(',');frame.width=width;frame.height=height;
 status.textContent='Viewport '+width+' × '+height;send('report');
}));
document.getElementById('reduce-motion').addEventListener('change',event=>send('motion',event.target.checked));
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='chat-scroll-state')return;
 document.querySelectorAll('[data-action]').forEach(button=>button.disabled=false);
 status.textContent=event.data.scenario+' · '+event.data.messages+' messages · '+(event.data.streaming?'streaming':'settled')+' · '+event.data.chunks+' chunks · '+frame.width+' × '+frame.height+(event.data.error?' · '+event.data.error:'');
 metrics.textContent=JSON.stringify(event.data.metrics,null,2);
});
</script></body></html>`;

const fixturePlugin = {
    name: 'chat-scroll-inspection-only',
    enforce: 'pre',
    transform(source, id) {
        if (id.includes('?')) return null;
        if (normalizePath(id) === loadPath) {
            return {
                code: `import { getHomeStaticPayload } from '$lib/server/content/home-service';
export const load = () => ({home: getHomeStaticPayload(), homeMetrics: Promise.resolve({status: 'error', message: 'Live metrics are disabled in this local scroll fixture.'})});`,
                map: null
            };
        }
        if (normalizePath(id) !== pagePath) return null;
        const script = '<script lang="ts">';
        if (!source.includes(script))
            throw new Error('Scroll fixture could not locate the homepage script.');
        return {
            code:
                source.replace(
                    script,
                    `${script}\nimport ChatScrollControls from 'chat-scroll-fixture';\nimport { page as scrollFixturePage } from '$app/state';`
                ) +
                `\n{#if scrollFixturePage.url.searchParams.get('__scroll_check') === '1'}<ChatScrollControls />{/if}\n`,
            map: null
        };
    },
    configureServer(server) {
        // SvelteKit narrows Vite's file allowlist to source directories. Preserve it and
        // add just this opt-in fixture directory, which lives outside src/.
        server.config.server.fs.allow.push(fixtureDirectory);
        server.middlewares.use((request, response, next) => {
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            if (pathname === '/api/chat/stream') {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(
                    JSON.stringify({
                        error: 'Model requests are disabled in the scroll lab. Use the fixture controls.'
                    })
                );
                return;
            }
            if (pathname !== '/__scroll_lab') return next();
            response.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store'
            });
            response.end(labHtml);
        });
    }
};

const server = await createServer({
    root: appRoot,
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    plugins: [fixturePlugin],
    resolve: { alias: { 'chat-scroll-fixture': fixturePath } },
    server: { host: '127.0.0.1', port: 5175, strictPort: true, open: false }
});
await server.listen();
console.log('Chat scroll lab: http://127.0.0.1:5175/__scroll_lab');
console.log('Direct keyboard fixture: http://127.0.0.1:5175/?__scroll_check=1&scenario=long');
console.log(
    'Finish this session before running builds/checks that regenerate SvelteKit or Paraglide files.'
);
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
        await server.close();
        process.exit(0);
    });
}
