import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4182;
const debugPort = 10100 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-visual-qa-${Date.now()}`);
const screenshotDir = path.join(root, 'qa-screenshots');
const reportPath = path.join(root, 'qa-visual-smoke-result.json');
const viewports = [
    { name: 'desktop', width: 1440, height: 900, mobile: false, scale: 1 },
    { name: 'mobile', width: 390, height: 844, mobile: true, scale: 2 }
];
const report = {
    startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/index.html`,
    screenshots: [],
    steps: [],
    issues: [],
    console: []
};

function contentType(file) {
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    if (file.endsWith('.svg')) return 'image/svg+xml';
    if (file.endsWith('.png')) return 'image/png';
    if (file.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://127.0.0.1:${port}`);
    const requested = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    const safePath = path.normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, '');
    const filePath = path.join(root, safePath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
});

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label, timeout = 8000) {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
        try {
            last = await fn();
            if (last) return last;
        } catch (error) {
            last = error;
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for ${label}: ${last?.message || last}`);
}

async function cdpRequest(method, params = {}) {
    const id = ++cdpRequest.id;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
    });
}
cdpRequest.id = 0;

async function evalJs(expression, awaitPromise = true) {
    const result = await cdpRequest('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true,
        userGesture: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
}

async function click(selector) {
    const ok = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`Missing clickable selector ${selector}`);
}

async function visible(selector) {
    return evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; })()`);
}

async function setViewport(viewport) {
    await cdpRequest('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.scale,
        mobile: viewport.mobile
    });
}

async function startNewGame(viewportName) {
    await evalJs('localStorage.clear(); location.reload(); true');
    await waitFor(async () => evalJs('document.readyState === "complete"'), `${viewportName} reload`);
    await waitFor(async () => visible('#titleScreen'), `${viewportName} title screen`);
    await click('#titleNewBtn');
    await waitFor(async () => visible('#customScreen'), `${viewportName} custom screen`);
    await evalJs(`(() => {
    document.querySelector('#customNameInput').value = ${JSON.stringify(`${viewportName} QA`)};
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
    await click('#customStartBtn');
    await waitFor(async () => visible('#storyPanel'), `${viewportName} intro story`);
    await click('#storyContinueButton');
    await waitFor(async () => !(await visible('#storyPanel')), `${viewportName} intro closed`);
}

async function closeOpenPanels() {
    await evalJs(`(() => {
    closeInventoryPanel?.();
    closeProgressPanel?.();
    closeCharacterPanel?.();
    closeMiniGamePanel?.();
    closeSettingsPanel?.();
    hideStoryPanel?.();
    hideDialogue?.();
    hidePanel?.();
    return true;
  })()`);
}

async function assertNoHorizontalOverflow(label) {
    const metrics = await evalJs(`(() => ({
    innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    shellWidth: document.querySelector('.game-shell')?.getBoundingClientRect().width || 0
  }))()`);
    const overflow = Math.max(metrics.bodyScrollWidth, metrics.docScrollWidth) - metrics.innerWidth;
    if (overflow > 4) report.issues.push({ severity: 'medium', area: 'layout', message: `${label} horizontal overflow ${overflow}px`, metrics });
}

async function assertCanvasNonBlank(label) {
    const sample = await evalJs(`(() => {
    const canvas = document.querySelector('#game');
    const ctx = canvas.getContext('2d');
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0;
    let varied = 0;
    for (let i = 0; i < image.length; i += 1600) {
      if (image[i + 3] > 0) nonTransparent += 1;
      if (image[i] !== image[0] || image[i + 1] !== image[1] || image[i + 2] !== image[2]) varied += 1;
    }
    return { nonTransparent, varied };
  })()`);
    if (sample.nonTransparent < 10 || sample.varied < 10) report.issues.push({ severity: 'high', area: 'canvas', message: `${label} canvas appears blank`, sample });
}

async function assertPanelFits(panelSelector, label) {
    const bounds = await evalJs(`(() => {
    const panel = document.querySelector(${JSON.stringify(panelSelector)});
    const card = panel?.querySelector('.menu-panel, .story-card, .intro-card');
    if (!panel || panel.classList.contains('hidden') || !card) return null;
    const rect = card.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, innerWidth, innerHeight };
  })()`);
    if (!bounds) {
        report.issues.push({ severity: 'high', area: 'layout', message: `${label} panel was not visible.` });
        return;
    }
    if (bounds.left < -2 || bounds.top < -2 || bounds.right > bounds.innerWidth + 2 || bounds.bottom > bounds.innerHeight + 2) {
        report.issues.push({ severity: 'medium', area: 'layout', message: `${label} panel extends outside viewport`, bounds });
    }
}

async function assertMobileControls(viewportName) {
    const controls = await evalJs(`(() => {
    const el = document.querySelector('#touchControls');
    const rect = el?.getBoundingClientRect();
    const style = el ? getComputedStyle(el) : null;
    return el && rect ? { display: style.display, visibility: style.visibility, opacity: Number(style.opacity), width: rect.width, height: rect.height } : null;
  })()`);
    if (!controls || controls.display === 'none' || controls.visibility === 'hidden' || controls.width < 80 || controls.height < 80) {
        report.issues.push({ severity: 'medium', area: 'mobile', message: `${viewportName} touch controls are not visible enough`, controls });
    }
}

async function capture(name) {
    await delay(150);
    const result = await cdpRequest('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const fileName = `${name}.png`;
    const filePath = path.join(screenshotDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    report.screenshots.push(path.relative(root, filePath).replace(/\\/g, '/'));
}

async function runViewport(viewport) {
    await setViewport(viewport);
    await cdpRequest('Page.navigate', { url: report.url });
    await waitFor(async () => evalJs('document.readyState === "complete"'), `${viewport.name} page load`);
    await startNewGame(viewport.name);
    await assertNoHorizontalOverflow(`${viewport.name} base`);
    await assertCanvasNonBlank(`${viewport.name} base`);
    if (viewport.mobile) await assertMobileControls(viewport.name);
    await capture(`${viewport.name}-game`);

    await closeOpenPanels();
    await click('#inventoryOpenButton');
    await waitFor(async () => visible('#inventoryPanel'), `${viewport.name} inventory`);
    await assertPanelFits('#inventoryPanel', `${viewport.name} inventory`);
    await assertNoHorizontalOverflow(`${viewport.name} inventory`);
    await capture(`${viewport.name}-inventory`);

    await closeOpenPanels();
    await click('#progressOpenButton');
    await waitFor(async () => visible('#progressPanel'), `${viewport.name} progress`);
    await assertPanelFits('#progressPanel', `${viewport.name} progress`);
    await click('button[data-progress-tab="curriculum"]');
    await waitFor(async () => evalJs(`document.querySelector('#progressPanelBody')?.textContent.includes('Curriculum')`), `${viewport.name} curriculum tab`);
    await assertNoHorizontalOverflow(`${viewport.name} progress`);
    await capture(`${viewport.name}-progress-curriculum`);

    await closeOpenPanels();
    await click('#characterOpenButton');
    await waitFor(async () => visible('#characterPanel'), `${viewport.name} character`);
    await assertPanelFits('#characterPanel', `${viewport.name} character`);
    await assertNoHorizontalOverflow(`${viewport.name} character`);
    await capture(`${viewport.name}-character`);

    await closeOpenPanels();
    await click('#miniGameOpenButton');
    await waitFor(async () => visible('#progressPanel'), `${viewport.name} mini-game hub`);
    await click('button[data-minigame-start="sourceDetective"]');
    await waitFor(async () => visible('#miniGamePanel'), `${viewport.name} active mini-game`);
    await assertPanelFits('#miniGamePanel', `${viewport.name} active mini-game`);
    await assertNoHorizontalOverflow(`${viewport.name} active mini-game`);
    await capture(`${viewport.name}-minigame`);

    await closeOpenPanels();
    await click('#settingsOpenButton');
    await waitFor(async () => visible('#settingsPanel'), `${viewport.name} settings`);
    await assertPanelFits('#settingsPanel', `${viewport.name} settings`);
    await assertNoHorizontalOverflow(`${viewport.name} settings`);
    await capture(`${viewport.name}-settings`);
    report.steps.push(`${viewport.name} screenshot smoke complete`);
}

async function run() {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    chrome = spawn(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--remote-allow-origins=*',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${userDataDir}`,
        'about:blank'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chromeMessages = [];
    chrome.stderr?.on('data', (chunk) => chromeMessages.push(String(chunk).trim()));
    chrome.stdout?.on('data', (chunk) => chromeMessages.push(String(chunk).trim()));

    await waitFor(async () => {
        if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}: ${chromeMessages.join('\n')}`);
        const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null);
        return response?.ok ? response.json() : null;
    }, 'Chrome DevTools', 15000);

    const pageInfo = await waitFor(async () => {
        const create = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).catch(() => null);
        if (create?.ok) return create.json();
        const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).catch(() => null);
        if (!list?.ok) return null;
        const pages = await list.json();
        return pages.find((page) => page.type === 'page' && page.webSocketDebuggerUrl) || null;
    }, 'Chrome page target');

    socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const { resolve, reject, method } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) reject(new Error(`${method}: ${message.error.message}`));
            else resolve(message.result || {});
            return;
        }
        if (message.method === 'Runtime.consoleAPICalled') {
            report.console.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
        }
        if (message.method === 'Runtime.exceptionThrown') {
            report.issues.push({ severity: 'high', area: 'console', message: message.params.exceptionDetails?.text || 'Runtime exception' });
        }
    });

    await cdpRequest('Runtime.enable');
    await cdpRequest('Page.enable');
    for (const viewport of viewports) {
        await runViewport(viewport);
    }
    if (!report.issues.length) report.issues.push({ severity: 'info', area: 'qa', message: 'Desktop/mobile visual smoke passed.' });
}

let chrome;
let socket;
const pending = new Map();

try {
    await run();
} catch (error) {
    report.issues.push({ severity: 'critical', area: 'automation', message: error.stack || error.message });
} finally {
    try { socket?.close(); } catch { }
    try { chrome?.kill(); } catch { }
    await new Promise((resolve) => server.close(resolve));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (error) {
        report.steps.push(`Chrome profile cleanup skipped: ${error.code || error.message}`);
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    const blockingIssues = report.issues.filter((issue) => issue.severity !== 'info');
    console.log(JSON.stringify({
        blockingIssues: blockingIssues.length,
        screenshots: report.screenshots.length,
        reportFile: path.basename(reportPath),
        screenshotDir: path.basename(screenshotDir)
    }, null, 2));
    if (blockingIssues.length) process.exitCode = 1;
}