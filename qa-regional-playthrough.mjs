import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4183;
const debugPort = 10600 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-regional-qa-${Date.now()}`);
const reportPath = path.join(root, 'qa-regional-playthrough-result.json');
const report = {
    startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/index.html`,
    setup: [],
    steps: [],
    issues: [],
    hosts: [],
    finalState: null,
    console: []
};

function contentType(file) {
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    if (file.endsWith('.json')) return 'application/json; charset=utf-8';
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

async function hidePanels() {
    await evalJs(`(() => {
    hideDialogue?.();
    hidePanel?.();
    hideStoryPanel?.();
    closeMiniGamePanel?.();
    closeInventoryPanel?.();
    closeProgressPanel?.();
    closeCharacterPanel?.();
    return true;
  })()`);
}

async function startNewGame() {
    await evalJs('localStorage.clear(); location.reload(); true');
    await waitFor(async () => evalJs('document.readyState === "complete"'), 'page reload');
    await waitFor(async () => visible('#titleScreen'), 'title screen');
    await click('#titleNewBtn');
    await waitFor(async () => visible('#customScreen'), 'custom screen');
    await evalJs(`(() => {
    document.querySelector('#customNameInput').value = 'Regional QA';
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
    await click('#customStartBtn');
    await waitFor(async () => visible('#storyPanel'), 'intro story');
    await click('#storyContinueButton');
    await waitFor(async () => !(await visible('#storyPanel')), 'intro closed');
    report.steps.push('Clean New Game started for regional playthrough.');
}

async function getRegionalMiniGameHosts() {
    return evalJs(`(() => locationOrder.flatMap((locationId) => {
    if (locationId === 'village') return [];
    const location = WORLD[locationId];
    return (location?.npcs || [])
      .filter((npc) => npc.miniGameId)
      .map((npc) => ({
        locationId,
        locationName: location.name,
        npcId: npc.id,
        npcName: npc.name,
        miniGameId: npc.miniGameId,
        miniGameTitle: MINI_GAMES[npc.miniGameId]?.title || null
      }));
  }))()`);
}

async function travelToLocation(locationId) {
    await hidePanels();
    await evalJs(`(() => {
    state.unlockedLocations.add(${JSON.stringify(locationId)});
    state.activeQuest = null;
    state.pendingGate = null;
    setLocation(${JSON.stringify(locationId)}, { skipSave: true });
    return true;
  })()`);
    await waitFor(async () => evalJs(`state.currentLocation === ${JSON.stringify(locationId)}`), `travel to ${locationId}`);
}

async function setNearNpc(npcId) {
    return evalJs(`(() => {
    const npc = npcById(${JSON.stringify(npcId)});
    if (!npc) return { ok:false, reason:'missing npc' };
    const candidates = [];
    for (let dy = -72; dy <= 72; dy += 8) {
      for (let dx = -72; dx <= 72; dx += 8) {
        candidates.push({ x: npc.x + dx, y: npc.y + dy, distance: Math.hypot(dx, dy) });
      }
    }
    candidates.sort((left, right) => left.distance - right.distance);
    for (const spot of candidates) {
      if (isBlocked(spot.x, spot.y, state.player.w, state.player.h)) continue;
      state.player.x = spot.x;
      state.player.y = spot.y;
      state.player.dir = 'down';
      const found = findInteractable();
      if (found?.type === 'npc' && found.item.id === npc.id) {
        updateHud();
        return { ok:true, player:{ x: state.player.x, y: state.player.y }, npc:{ id:npc.id, name:npc.name, miniGameId:npc.miniGameId } };
      }
    }
    return { ok:false, reason:'no unblocked interaction position', npc:{ id:npc.id, name:npc.name, x:npc.x, y:npc.y } };
  })()`);
}

async function openNpcMenu(npcId) {
    const placed = await setNearNpc(npcId);
    if (!placed.ok) throw new Error(`Cannot stand near ${npcId}: ${placed.reason}`);
    await evalJs(`(() => { interact(); return true; })()`);
    await waitFor(async () => visible('#choicePanel'), `NPC menu ${npcId}`);
}

async function openHostMiniGame(host) {
    await openNpcMenu(host.npcId);
    const buttonText = await evalJs(`(() => document.querySelector('button[data-menu="miniGame"]')?.textContent.trim() || null)()`);
    if (!buttonText) throw new Error(`${host.npcId} has no mini-game menu button.`);
    if (!buttonText.includes(host.miniGameTitle)) throw new Error(`${host.npcId} mini-game button text mismatch: ${buttonText}`);
    await click('button[data-menu="miniGame"]');
    await waitFor(async () => visible('#miniGamePanel'), `${host.npcId} mini-game panel`);
    const active = await evalJs(`(() => activeMiniGame ? { id: activeMiniGame.id, title: MINI_GAMES[activeMiniGame.id].title } : null)()`);
    if (!active || active.id !== host.miniGameId) throw new Error(`${host.npcId} opened ${active?.id || 'nothing'}, expected ${host.miniGameId}.`);
}

async function completeActiveMiniGame(host) {
    const roundCount = await evalJs(`MINI_GAMES[${JSON.stringify(host.miniGameId)}].rounds.length`);
    for (let round = 0; round < roundCount; round += 1) {
        const correct = await evalJs(`MINI_GAMES[${JSON.stringify(host.miniGameId)}].rounds[${round}].correct`);
        await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-minigame-choice="${correct}"]:not([disabled])'))()`), `${host.npcId} round ${round + 1}`);
        await click(`button[data-minigame-choice="${correct}"]`);
        await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-minigame-next]'))()`), `${host.npcId} round ${round + 1} feedback`);
        await click('button[data-minigame-next]');
    }
    await waitFor(async () => evalJs(`(() => document.querySelector('#miniGamePanelBody')?.textContent.includes('complete') || false)()`), `${host.npcId} result`);
    const result = await evalJs(`(() => {
    const score = state.miniGameScores[${JSON.stringify(host.miniGameId)}];
    const saved = JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || '{}').miniGameScores?.[${JSON.stringify(host.miniGameId)}];
    return { score, saved, journal: state.journal, storyFlags: state.storyFlags };
  })()`);
    if (!result.score || result.score.score !== roundCount || result.score.medal !== 'gold') {
        throw new Error(`${host.miniGameId} did not finish with saved gold score: ${JSON.stringify(result.score)}`);
    }
    if (!result.saved || result.saved.score !== roundCount || result.saved.medal !== 'gold') {
        throw new Error(`${host.miniGameId} did not persist a gold score: ${JSON.stringify(result.saved)}`);
    }
    await hidePanels();
    return result;
}

async function runRegionalHosts() {
    const hosts = await getRegionalMiniGameHosts();
    const uniqueGames = new Set(hosts.map((host) => host.miniGameId));
    if (hosts.length < 7) report.issues.push({ severity: 'high', area: 'coverage', message: `Expected at least 7 regional mini-game hosts, found ${hosts.length}.`, hosts });
    if (uniqueGames.size < 7) report.issues.push({ severity: 'medium', area: 'coverage', message: `Expected 7 unique mini-games, found ${uniqueGames.size}.`, games: [...uniqueGames] });

    for (const host of hosts) {
        try {
            await travelToLocation(host.locationId);
            await openHostMiniGame(host);
            const result = await completeActiveMiniGame(host);
            report.hosts.push({ ...host, score: result.score, saved: result.saved, storyFlags: result.storyFlags });
            report.steps.push(`${host.locationName}: ${host.npcName} launched and completed ${host.miniGameTitle}.`);
        } catch (error) {
            report.issues.push({ severity: 'high', area: 'regional-host', message: `${host.locationId}:${host.npcId}:${host.miniGameId} - ${error.message}` });
            await hidePanels();
        }
    }
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
    await runRegionalHosts();
    report.finalState = await evalJs(`(() => ({
    profile: state.profile,
    currentLocation: state.currentLocation,
    miniGameScores: state.miniGameScores,
    achievements: [...state.achievements],
    storyFlags: state.storyFlags,
    save: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || 'null')
  }))()`);
    if (!report.issues.length) report.issues.push({ severity: 'info', area: 'qa', message: 'Regional mini-game host playthrough passed.' });
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
    await delay(300);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (error) {
        report.setup.push(`Chrome profile cleanup skipped: ${error.code || error.message}`);
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    const blockingIssues = report.issues.filter((issue) => issue.severity !== 'info');
    console.log(JSON.stringify({
        blockingIssues: blockingIssues.length,
        hosts: report.hosts.length,
        uniqueGames: [...new Set(report.hosts.map((host) => host.miniGameId))].length,
        reportFile: path.basename(reportPath)
    }, null, 2));
    if (blockingIssues.length) process.exitCode = 1;
}