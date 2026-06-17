import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4181;
const debugPort = 9600 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-ui-qa-${Date.now()}`);
const reportPath = path.join(root, 'qa-ui-regression-result.json');
const report = {
    startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/index.html`,
    setup: [],
    steps: [],
    issues: [],
    finalState: null,
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

async function textIncludes(selector, expected) {
    return evalJs(`(() => document.querySelector(${JSON.stringify(selector)})?.textContent.includes(${JSON.stringify(expected)}) || false)()`);
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

async function startNewGame() {
    await evalJs('localStorage.clear(); location.reload(); true');
    await waitFor(async () => evalJs('document.readyState === "complete"'), 'page reload');
    await waitFor(async () => visible('#titleScreen'), 'title screen');
    await click('#titleNewBtn');
    await waitFor(async () => visible('#customScreen'), 'customization screen');
    await evalJs(`(() => {
    document.querySelector('#customNameInput').value = 'UI Scout';
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
    await click('#customStartBtn');
    await waitFor(async () => visible('#storyPanel'), 'intro story panel');
    const snapshot = await evalJs(`(() => ({
    profile: state.profile,
    location: state.currentLocation,
    coins: state.coins,
    inventory: state.inventory,
    saveVersion: state.saveVersion,
    saved: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || 'null')
  }))()`);
    if (snapshot.profile.name !== 'UI Scout') throw new Error(`Profile name was ${snapshot.profile.name}`);
    if (snapshot.profile.presetId !== 'girlLiberty') throw new Error(`Profile preset was ${snapshot.profile.presetId}`);
    if (snapshot.profile.accent !== 'forest') throw new Error(`Profile accent was ${snapshot.profile.accent}`);
    if (!snapshot.saved || snapshot.saved.saveVersion !== snapshot.saveVersion) throw new Error('New game save was not persisted with the active save version.');
    report.steps.push(`New Game customization passed: ${JSON.stringify(snapshot.profile)}`);
    await click('#storyContinueButton');
    await waitFor(async () => !(await visible('#storyPanel')), 'intro story closed');
}

async function checkMenuButton(buttonSelector, panelSelector, bodySelector, expectedText) {
    await closeOpenPanels();
    await click(buttonSelector);
    await waitFor(async () => visible(panelSelector), `${panelSelector} visible`);
    await waitFor(async () => textIncludes(bodySelector, expectedText), `${panelSelector} contains ${expectedText}`);
    report.steps.push(`${buttonSelector} opened ${panelSelector}`);
}

async function openMenus() {
    await checkMenuButton('#inventoryOpenButton', '#inventoryPanel', '#inventoryPanelBody', 'Backpack');
    await checkMenuButton('#progressOpenButton', '#progressPanel', '#progressPanelBody', 'Story');
    await checkMenuButton('#characterOpenButton', '#characterPanel', '#characterPanelBody', 'Readiness formula');
    await checkMenuButton('#miniGameOpenButton', '#progressPanel', '#progressPanelBody', 'Source Detective');
    await closeOpenPanels();
}

async function checkSettings() {
    await checkMenuButton('#settingsOpenButton', '#settingsPanel', '#settingsPanelBody', 'Large text');
    for (const key of ['largeText', 'highContrast', 'reducedMotion']) {
        await click(`button[data-setting-toggle="${key}"]`);
    }
    const state = await evalJs(`(() => ({
        largeText: document.body.classList.contains('large-text'),
        highContrast: document.body.classList.contains('high-contrast'),
        reducedMotion: document.body.classList.contains('reduced-motion'),
        saved: JSON.parse(localStorage.getItem('citizenshipValleySettingsV1') || '{}')
    }))()`);
    if (!state.largeText || !state.highContrast || !state.reducedMotion) throw new Error(`Settings body classes missing: ${JSON.stringify(state)}`);
    if (!state.saved.largeText || !state.saved.highContrast || !state.saved.reducedMotion) throw new Error(`Settings were not saved: ${JSON.stringify(state.saved)}`);
    report.steps.push('Settings accessibility toggles persisted.');
    await closeOpenPanels();
}

async function completeMiniGame(id) {
    await click('#miniGameOpenButton');
    await waitFor(async () => visible('#progressPanel'), 'mini-game hub');
    await click(`button[data-minigame-start="${id}"]`);
    await waitFor(async () => visible('#miniGamePanel'), 'active mini-game panel');
    const roundCount = await evalJs(`MINI_GAMES[${JSON.stringify(id)}].rounds.length`);
    for (let round = 0; round < roundCount; round += 1) {
        const correct = await evalJs(`MINI_GAMES[${JSON.stringify(id)}].rounds[${round}].correct`);
        await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-minigame-choice="${correct}"]:not([disabled])'))()`), `mini-game round ${round + 1} choices`);
        await click(`button[data-minigame-choice="${correct}"]`);
        await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-minigame-next]'))()`), `mini-game round ${round + 1} feedback`);
        await click('button[data-minigame-next]');
    }
    await waitFor(async () => textIncludes('#miniGamePanelBody', 'gold'), 'mini-game result');
    const result = await evalJs(`(() => ({
    score: state.miniGameScores[${JSON.stringify(id)}],
    achievements: [...state.achievements],
    coins: state.coins,
    stats: state.stats,
    savedScore: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || '{}').miniGameScores?.[${JSON.stringify(id)}]
  }))()`);
    if (!result.score || result.score.medal !== 'gold') throw new Error(`Mini-game result was not gold: ${JSON.stringify(result.score)}`);
    if (!result.savedScore || result.savedScore.medal !== 'gold') throw new Error('Mini-game score was not saved.');
    report.steps.push(`Mini-game ${id} completed: ${JSON.stringify(result.score)}`);
}

async function run() {
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    report.setup.push(`Static server started on ${port}`);

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
    report.setup.push(`Chrome started with remote debugging on ${debugPort}`);

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
    await cdpRequest('Page.navigate', { url: report.url });
    await waitFor(async () => evalJs('document.readyState === "complete"'), 'page load');

    await startNewGame();
    await openMenus();
    await checkSettings();
    await completeMiniGame('sourceDetective');

    report.finalState = await evalJs(`(() => ({
    profile: state.profile,
    currentLocation: state.currentLocation,
    saveVersion: state.saveVersion,
    sourceDetective: state.miniGameScores.sourceDetective,
    achievements: [...state.achievements],
    save: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || 'null')
  }))()`);
    if (!report.issues.length) report.issues.push({ severity: 'info', area: 'qa', message: 'UI regression scenarios passed.' });
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
        report.setup.push(`Chrome profile cleanup skipped: ${error.code || error.message}`);
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    const blockingIssues = report.issues.filter((issue) => issue.severity !== 'info');
    console.log(JSON.stringify({
        blockingIssues: blockingIssues.length,
        steps: report.steps.length,
        finalState: report.finalState && {
            profile: report.finalState.profile,
            sourceDetective: report.finalState.sourceDetective
        },
        reportFile: path.basename(reportPath)
    }, null, 2));
    if (blockingIssues.length) process.exitCode = 1;
}