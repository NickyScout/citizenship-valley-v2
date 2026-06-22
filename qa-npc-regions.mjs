// Throwaway-ish NPC QA harness: loads the game, starts a new game, then dev-travels to a few
// regions and screenshots each so we can eyeball NPC hairstyle/role-kit variety across regions.
// Usage: node qa-npc-regions.mjs   (Chrome headless via CDP, mirrors qa-visual-smoke.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4187;
const debugPort = 10700 + Math.floor(Math.random() * 400);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-npc-qa-${Date.now()}`);
const screenshotDir = path.join(root, 'qa-screenshots');
const regions = ['rightsLaw', 'modernBritain', 'participation', 'democracy'];

const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://127.0.0.1:${port}`);
    const requested = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    const safePath = path.normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, '');
    const filePath = path.join(root, safePath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('Not found'); return;
    }
    const ct = filePath.endsWith('.html') ? 'text/html' : filePath.endsWith('.js') ? 'text/javascript'
        : filePath.endsWith('.css') ? 'text/css' : filePath.endsWith('.png') ? 'image/png' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let socket; const pending = new Map();
async function cdp(method, params = {}) {
    const id = ++cdp.id; socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
cdp.id = 0;
async function evalJs(expression, awaitPromise = true) {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
    return r.result.value;
}
async function waitFor(fn, label, timeout = 9000) {
    const start = Date.now(); let last;
    while (Date.now() - start < timeout) { try { last = await fn(); if (last) return last; } catch (e) { last = e; } await delay(120); }
    throw new Error(`Timeout ${label}: ${last?.message || last}`);
}
async function capture(name) {
    await delay(220);
    const r = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(screenshotDir, `${name}.png`), Buffer.from(r.data, 'base64'));
}

let chrome;
async function run() {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await new Promise((res) => server.listen(port, '127.0.0.1', res));
    chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${userDataDir}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });

    const ver = await waitFor(async () => {
        const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null);
        return resp?.ok ? resp.json() : null;
    }, 'Chrome DevTools', 15000);

    // Attach to the PAGE target (browser endpoint has no Page/Runtime domain).
    const pageInfo = await waitFor(async () => {
        const create = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).catch(() => null);
        if (create?.ok) return create.json();
        const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).catch(() => null);
        if (!list?.ok) return null;
        const pages = await list.json();
        return pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl) || null;
    }, 'Chrome page target');

    socket = new globalThis.WebSocket(pageInfo.webSocketDebuggerUrl);
    await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
    socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
            msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result || {});
        }
    };
    await cdp('Page.enable'); await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await waitFor(async () => evalJs('document.readyState === "complete"'), 'load');
    await waitFor(async () => evalJs(`!!document.querySelector('#titleScreen') && !document.querySelector('#titleScreen').classList.contains('hidden')`), 'title');
    await evalJs(`document.querySelector('#titleNewBtn').click(); true`);
    await waitFor(async () => evalJs(`!!document.querySelector('#customScreen') && !document.querySelector('#customScreen').classList.contains('hidden')`), 'custom');
    await evalJs(`document.querySelector('#customNameInput').value='NPC QA'; document.querySelector('button[data-preset="boyScholar"]')?.click(); document.querySelector('button[data-accent="forest"]')?.click(); true`);
    await evalJs(`document.querySelector('#customStartBtn').click(); true`);
    await waitFor(async () => evalJs(`!!document.querySelector('#storyPanel') && !document.querySelector('#storyPanel').classList.contains('hidden')`), 'story');
    await evalJs(`document.querySelector('#storyContinueButton').click(); true`);
    await delay(400);

    for (const region of regions) {
        await evalJs(`(() => { state.unlockedLocations.add(${JSON.stringify(region)}); setLocation(${JSON.stringify(region)}); state.journal=''; updateHud?.(); return true; })()`);
        await delay(500);
        await capture(`_region-${region}`);
        console.log(`captured ${region}`);
    }
    console.log('done');
}

run().then(async () => {
    try { chrome?.kill(); } catch { } server.close(); process.exit(0);
}).catch(async (e) => {
    console.error('FAIL', e.message);
    try { chrome?.kill(); } catch { } server.close(); process.exit(1);
});
