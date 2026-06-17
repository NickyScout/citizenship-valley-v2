import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4184;
const debugPort = 11100 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-regional-quests-${Date.now()}`);
const reportPath = path.join(root, 'qa-regional-quests-playthrough-result.json');
const startLocation = 'modernBritain';
const report = {
    startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/index.html`,
    setup: [],
    steps: [],
    issues: [],
    regions: [],
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
    document.querySelector('#customNameInput').value = 'Regional Quests QA';
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
    await click('#customStartBtn');
    await waitFor(async () => visible('#storyPanel'), 'intro story');
    await click('#storyContinueButton');
    await waitFor(async () => !(await visible('#storyPanel')), 'intro closed');
}

async function switchToStartLocation() {
    await hidePanels();
    await evalJs(`(() => {
    state.unlockedLocations.add(${JSON.stringify(startLocation)});
    state.activeQuest = null;
    state.pendingGate = null;
    setLocation(${JSON.stringify(startLocation)}, { skipSave: true });
    return true;
  })()`);
    await waitFor(async () => evalJs(`state.currentLocation === ${JSON.stringify(startLocation)}`), `switch to ${startLocation}`);
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
        return { ok:true, npc:{ id:npc.id, name:npc.name }, player:{ x: state.player.x, y: state.player.y } };
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

async function clickMenu(action, extra = '') {
    await click(`button[data-menu="${action}"]${extra}`);
}

async function answerCorrect(selectorBase, attrName, correctIndex) {
    const before = await evalJs(`(() => [...document.querySelectorAll(${JSON.stringify(selectorBase)})].map((button, pos) => ({ pos, original: Number(button.dataset[${JSON.stringify(attrName)}]), text: button.textContent.trim() })))()`);
    const correctButton = before.find((entry) => entry.original === correctIndex);
    if (!correctButton) throw new Error(`Correct answer ${correctIndex} not rendered for ${selectorBase}; rendered ${JSON.stringify(before)}`);
    await click(`${selectorBase}[data-${attrName.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase())}="${correctIndex}"]`);
    await delay(850);
    return before;
}

async function completeQuestViaUi(questId) {
    const quest = await evalJs(`(() => {
    const q = QUESTS[${JSON.stringify(questId)}];
    return q ? { id:${JSON.stringify(questId)}, title:q.title, giver:q.giver, target:q.target, correct:q.correct } : null;
  })()`);
    if (!quest) throw new Error(`Quest not found: ${questId}`);

    await hidePanels();
    await openNpcMenu(quest.giver);
    await clickMenu('quests');
    await click(`button[data-menu="acceptQuest"][data-quest="${questId}"]`);
    await delay(120);
    await hidePanels();

    await openNpcMenu(quest.target);
    await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-menu="askQuest"]'))()`), `${questId} ask button`);
    await clickMenu('askQuest');
    await delay(120);
    await hidePanels();

    await openNpcMenu(quest.giver);
    await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-menu="turnIn"]'))()`), `${questId} turn-in button`);
    await clickMenu('turnIn');
    await waitFor(async () => evalJs(`(() => document.querySelectorAll('button[data-quest-answer]').length > 0)()`), `${questId} answers`);
    const order = await answerCorrect('button[data-quest-answer]', 'questAnswer', quest.correct);
    await hidePanels();

    const completed = await evalJs(`state.completedQuests.has(${JSON.stringify(questId)})`);
    if (!completed) throw new Error(`Quest did not complete: ${questId}`);
    return { quest, order: order.map((entry) => entry.original) };
}

async function completeTravelGate(locationId) {
    const gateNpcId = await evalJs(`(() => WORLD[${JSON.stringify(locationId)}].npcs[0]?.id || null)()`);
    if (!gateNpcId) throw new Error(`No NPC available for ${locationId} travel gate.`);
    await hidePanels();
    await openNpcMenu(gateNpcId);
    await waitFor(async () => evalJs(`(() => !!document.querySelector('button[data-menu="travel"]'))()`), `${locationId} travel button`);
    await clickMenu('travel');
    for (let step = 0; step < 3; step += 1) {
        await waitFor(async () => evalJs(`(() => document.querySelectorAll('button[data-gate-answer]').length > 0)()`), `${locationId} gate answers ${step + 1}`);
        const correct = await evalJs(`(() => {
      const gate = state.pendingGate;
      return gate ? WORLD[gate.location].gateQuestions[gate.index].correct : null;
    })()`);
        await answerCorrect('button[data-gate-answer]', 'gateAnswer', correct);
    }
    await waitFor(async () => evalJs(`state.currentLocation !== ${JSON.stringify(locationId)}`), `${locationId} gate transition`);
    if (await visible('#storyPanel')) await click('#storyContinueButton');
    await hidePanels();
}

async function verifyFinalGateMenu(locationId) {
    const npcId = await evalJs(`(() => WORLD[${JSON.stringify(locationId)}].npcs[0]?.id || null)()`);
    if (!npcId) throw new Error(`No NPC available for ${locationId} final gate menu.`);
    await openNpcMenu(npcId);
    await clickMenu('travel');
    const hasFinalExam = await evalJs(`(() => !!document.querySelector('button[data-menu="finalExam"]'))()`);
    if (!hasFinalExam) throw new Error(`${locationId} final travel menu did not show finalExam action.`);
    await hidePanels();
}

async function completeCurrentRegion() {
    const location = await evalJs(`(() => {
    const location = WORLD[state.currentLocation];
    return { id: state.currentLocation, name: location.name, next: location.next, questIds: [...location.questIds] };
  })()`);
    const beforeCount = await evalJs('state.completedQuests.size');
    const completedQuestIds = [];
    for (const questId of location.questIds) {
        const result = await completeQuestViaUi(questId);
        completedQuestIds.push(questId);
        report.steps.push(`${location.name}: completed ${result.quest.title}; order ${result.order.join(',')}`);
    }
    const unfinished = await evalJs(`WORLD[${JSON.stringify(location.id)}].questIds.filter((id) => !state.completedQuests.has(id))`);
    if (unfinished.length) throw new Error(`${location.name} still has unfinished quests: ${unfinished.join(', ')}`);

    if (location.next) {
        await completeTravelGate(location.id);
        report.steps.push(`${location.name}: travel gate completed to ${location.next}.`);
    } else {
        await verifyFinalGateMenu(location.id);
        report.steps.push(`${location.name}: final gate menu verified.`);
    }

    const afterCount = await evalJs('state.completedQuests.size');
    report.regions.push({ ...location, completedQuestIds, completedDelta: afterCount - beforeCount });
}

async function runRegionalQuestFlow() {
    await switchToStartLocation();
    while (true) {
        const current = await evalJs('state.currentLocation');
        await completeCurrentRegion();
        const next = await evalJs('state.currentLocation');
        if (current === 'examHall' || next === current) break;
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
    await runRegionalQuestFlow();
    report.finalState = await evalJs(`(() => ({
    profile: state.profile,
    currentLocation: state.currentLocation,
    completedQuestCount: state.completedQuests.size,
    completedQuests: [...state.completedQuests],
    badges: state.badges,
    unlockedLocations: [...state.unlockedLocations],
    storyFlags: state.storyFlags,
    activeQuest: state.activeQuest,
    pendingGate: state.pendingGate,
    save: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || 'null')
  }))()`);
    const expectedRegionalQuestCount = report.regions.reduce((sum, region) => sum + region.questIds.length, 0);
    if (report.finalState.completedQuestCount !== expectedRegionalQuestCount) {
        report.issues.push({ severity: 'high', area: 'completion', message: `Completed ${report.finalState.completedQuestCount}/${expectedRegionalQuestCount} regional quests.` });
    }
    if (report.finalState.currentLocation !== 'examHall') report.issues.push({ severity: 'high', area: 'travel-gate', message: `Expected final location examHall, got ${report.finalState.currentLocation}.` });
    if (report.finalState.activeQuest) report.issues.push({ severity: 'medium', area: 'completion', message: `activeQuest remained: ${JSON.stringify(report.finalState.activeQuest)}` });
    if (report.finalState.pendingGate) report.issues.push({ severity: 'medium', area: 'completion', message: `pendingGate remained: ${JSON.stringify(report.finalState.pendingGate)}` });
    if (!report.issues.length) report.issues.push({ severity: 'info', area: 'qa', message: 'Full regional quest/travel-gate playthrough passed.' });
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
        regions: report.regions.length,
        completedQuestCount: report.finalState?.completedQuestCount ?? null,
        finalLocation: report.finalState?.currentLocation ?? null,
        reportFile: path.basename(reportPath)
    }, null, 2));
    if (blockingIssues.length) process.exitCode = 1;
}