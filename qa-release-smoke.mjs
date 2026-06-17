import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4185;
const debugPort = 11600 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-release-smoke-${Date.now()}`);
const reportPath = path.join(root, 'qa-release-smoke-result.json');
const report = {
  startedAt: new Date().toISOString(),
  url: `http://127.0.0.1:${port}/index.html`,
  steps: [],
  issues: [],
  regionChecks: [],
  finalState: null,
  deploymentSmoke: { status: 'not-run', reason: 'Deployment requires an explicit publish step and Static Web Apps token.' },
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function click(selector) {
  const ok = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error(`Missing clickable selector ${selector}`);
}

async function visible(selector) {
  return evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; })()`);
}

async function closePanels() {
  await evalJs(`(() => {
    hideDialogue?.();
    hidePanel?.();
    hideStoryPanel?.();
    closeMiniGamePanel?.();
    closeInventoryPanel?.();
    closeProgressPanel?.();
    closeCharacterPanel?.();
    closeSettingsPanel?.();
    return true;
  })()`);
}

async function setViewport(width, height, mobile = false, scale = 1) {
  await cdpRequest('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
}

async function startNewGame(name) {
  await evalJs('localStorage.clear(); location.reload(); true');
  await waitFor(async () => evalJs('document.readyState === "complete"'), 'reload');
  await waitFor(async () => visible('#titleScreen'), 'title screen');
  await click('#titleNewBtn');
  await waitFor(async () => visible('#customScreen'), 'custom screen');
  await evalJs(`(() => {
    document.querySelector('#customNameInput').value = ${JSON.stringify(name)};
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
  await click('#customStartBtn');
  await waitFor(async () => visible('#storyPanel'), 'intro story');
  await click('#storyContinueButton');
  await waitFor(async () => !(await visible('#storyPanel')), 'intro closed');
}

async function pressKey(key, code, duration = 300) {
  await cdpRequest('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key.startsWith('Arrow') ? 39 : key.toUpperCase().charCodeAt(0) });
  await delay(duration);
  await cdpRequest('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key.startsWith('Arrow') ? 39 : key.toUpperCase().charCodeAt(0) });
}

async function setNearNpc(npcId) {
  return evalJs(`(() => {
    const npc = npcById(${JSON.stringify(npcId)});
    if (!npc) return { ok:false, reason:'missing npc' };
    const candidates = [];
    for (let dy = -72; dy <= 72; dy += 8) {
      for (let dx = -72; dx <= 72; dx += 8) candidates.push({ x:npc.x + dx, y:npc.y + dy, distance:Math.hypot(dx, dy) });
    }
    candidates.sort((left, right) => left.distance - right.distance);
    for (const spot of candidates) {
      if (isBlocked(spot.x, spot.y, state.player.w, state.player.h)) continue;
      state.player.x = spot.x;
      state.player.y = spot.y;
      const found = findInteractable();
      if (found?.type === 'npc' && found.item.id === npc.id) {
        updateHud();
        return { ok:true, npc:{ id:npc.id, name:npc.name, miniGameId:npc.miniGameId || null }, player:{ x:state.player.x, y:state.player.y } };
      }
    }
    return { ok:false, reason:'no interaction spot', npc:{ id:npc.id, name:npc.name } };
  })()`);
}

async function openFirstNpcMenu(locationId) {
  const npcId = await evalJs(`WORLD[${JSON.stringify(locationId)}].npcs[0]?.id || null`);
  if (!npcId) throw new Error(`No NPC in ${locationId}`);
  const placed = await setNearNpc(npcId);
  if (!placed.ok) throw new Error(`Cannot stand near ${npcId}: ${placed.reason}`);
  await evalJs('interact(); true');
  await waitFor(async () => visible('#choicePanel'), `${locationId} NPC menu`);
  return placed.npc;
}

async function checkDesktopSmoke() {
  await setViewport(1440, 900, false, 1);
  await startNewGame('Release Desktop');
  const before = await evalJs('({ x: state.player.x, y: state.player.y })');
  await pressKey('ArrowRight', 'ArrowRight', 450);
  const after = await evalJs('({ x: state.player.x, y: state.player.y })');
  if (after.x <= before.x) throw new Error(`Keyboard movement did not move right: ${JSON.stringify({ before, after })}`);
  await openFirstNpcMenu('village');
  await click('button[data-menu="quests"]');
  await waitFor(async () => evalJs("choicePanel.textContent.includes('Quests')"), 'quest menu');
  await closePanels();
  for (const [button, panel] of [
    ['#inventoryOpenButton', '#inventoryPanel'],
    ['#progressOpenButton', '#progressPanel'],
    ['#characterOpenButton', '#characterPanel'],
    ['#miniGameOpenButton', '#progressPanel'],
    ['#settingsOpenButton', '#settingsPanel']
  ]) {
    await click(button);
    await waitFor(async () => visible(panel), `${panel} visible`);
    await closePanels();
  }
  await click('#settingsOpenButton');
  await waitFor(async () => visible('#settingsPanel'), 'settings panel');
  for (const key of ['largeText', 'highContrast', 'reducedMotion']) await click(`button[data-setting-toggle="${key}"]`);
  await evalJs('location.reload(); true');
  await waitFor(async () => evalJs('document.readyState === "complete"'), 'settings reload');
  const settingsPersisted = await evalJs(`(() => ({
    largeText: document.body.classList.contains('large-text'),
    highContrast: document.body.classList.contains('high-contrast'),
    reducedMotion: document.body.classList.contains('reduced-motion'),
    saved: JSON.parse(localStorage.getItem('citizenshipValleySettingsV1') || '{}')
  }))()`);
  if (!settingsPersisted.largeText || !settingsPersisted.highContrast || !settingsPersisted.reducedMotion) throw new Error(`Settings did not persist: ${JSON.stringify(settingsPersisted)}`);
  await click('#settingsOpenButton');
  await waitFor(async () => visible('#settingsPanel'), 'settings reset panel');
  await evalJs('window.confirm = () => true; true');
  await click('button[data-settings-reset-save]');
  await waitFor(async () => visible('#titleScreen'), 'title after reset');
  const saveCleared = await evalJs(`(() => ({ save: localStorage.getItem('citizenshipValleySaveV1'), settings: JSON.parse(localStorage.getItem('citizenshipValleySettingsV1') || '{}') }))()`);
  if (saveCleared.save) throw new Error('Settings reset save did not clear game save.');
  if (!saveCleared.settings.largeText) throw new Error('Settings reset save removed display settings.');
  report.steps.push('Desktop release smoke passed.');
}

async function dispatchTouch(selector, hold = 300) {
  const ok = await evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.setPointerCapture = () => {};
    el.releasePointerCapture = () => {};
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId: 7, pointerType:'touch' }));
    return true;
  })()`);
  if (!ok) throw new Error(`Missing touch selector ${selector}`);
  await delay(hold);
  await evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el?.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, pointerId: 7, pointerType:'touch' }));
    return true;
  })()`);
}

async function checkMobileSmoke() {
  await setViewport(390, 844, true, 2);
  await startNewGame('Release Mobile');
  const controls = await evalJs(`(() => {
    const rect = document.querySelector('#touchControls')?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  })()`);
  if (!controls || controls.width < 80 || controls.height < 80) throw new Error(`Touch controls not visible: ${JSON.stringify(controls)}`);
  const before = await evalJs('({ x: state.player.x, y: state.player.y })');
  await dispatchTouch('[data-touch-key="d"]', 400);
  const after = await evalJs('({ x: state.player.x, y: state.player.y })');
  if (after.x <= before.x) throw new Error(`Touch movement did not move right: ${JSON.stringify({ before, after })}`);
  await setNearNpc('mayor');
  await dispatchTouch('[data-touch-action="interact"]', 80);
  await waitFor(async () => visible('#choicePanel'), 'mobile touch interact menu');
  await closePanels();
  for (const [button, panel] of [
    ['#inventoryOpenButton', '#inventoryPanel'],
    ['#progressOpenButton', '#progressPanel'],
    ['#characterOpenButton', '#characterPanel'],
    ['#miniGameOpenButton', '#progressPanel'],
    ['#settingsOpenButton', '#settingsPanel']
  ]) {
    await click(button);
    await waitFor(async () => visible(panel), `${panel} mobile visible`);
    await closePanels();
  }
  report.steps.push('Mobile release smoke passed.');
}

async function checkRegionSpot() {
  await setViewport(1440, 900, false, 1);
  await evalJs('localStorage.clear(); location.reload(); true');
  await waitFor(async () => evalJs('document.readyState === "complete"'), 'region reload');
  await startNewGame('Release Regions');
  const regions = await evalJs('locationOrder.slice()');
  for (const region of regions) {
    await closePanels();
    await evalJs(`(() => {
      const select = document.querySelector('#devLocationSelect');
      select.value = ${JSON.stringify(region)};
      document.querySelector('#devTravelButton').click();
      return true;
    })()`);
    await waitFor(async () => evalJs(`state.currentLocation === ${JSON.stringify(region)}`), `${region} dev travel`);
    if (await visible('#storyPanel')) await click('#storyContinueButton');
    const firstNpc = await openFirstNpcMenu(region);
    await closePanels();
    const hostCount = await evalJs(`WORLD[${JSON.stringify(region)}].npcs.filter((npc) => npc.miniGameId).length`);
    let miniText = null;
    if (hostCount) {
      const hostId = await evalJs(`WORLD[${JSON.stringify(region)}].npcs.find((npc) => npc.miniGameId)?.id || null`);
      const host = await setNearNpc(hostId);
      if (!host.ok) throw new Error(`Cannot stand near mini-game host ${hostId}: ${host.reason}`);
      await evalJs('interact(); true');
      await waitFor(async () => visible('#choicePanel'), `${region} mini-game host menu`);
      miniText = await evalJs(`document.querySelector('button[data-menu="miniGame"]')?.textContent.trim() || null`);
      if (!miniText) throw new Error(`${region} mini-game host ${hostId} has no Mini-game button.`);
    }
    await closePanels();
    report.regionChecks.push({ region, firstNpc, hostCount, firstMenuMiniGame: miniText });
  }
  report.steps.push('Region spot check passed.');
}

async function run() {
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
    if (message.method === 'Runtime.consoleAPICalled') report.console.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
    if (message.method === 'Runtime.exceptionThrown') report.issues.push({ severity:'high', area:'console', message: message.params.exceptionDetails?.text || 'Runtime exception' });
  });
  await cdpRequest('Runtime.enable');
  await cdpRequest('Page.enable');
  await cdpRequest('Page.navigate', { url: report.url });
  await waitFor(async () => evalJs('document.readyState === "complete"'), 'page load');
  await checkDesktopSmoke();
  await checkMobileSmoke();
  await checkRegionSpot();
  report.finalState = await evalJs(`(() => ({
    currentLocation: state.currentLocation,
    settings: JSON.parse(localStorage.getItem('citizenshipValleySettingsV1') || '{}'),
    saveExists: Boolean(localStorage.getItem('citizenshipValleySaveV1'))
  }))()`);
  if (!report.issues.length) report.issues.push({ severity: 'info', area: 'qa', message: 'Local release smoke passed.' });
}

let chrome;
let socket;
const pending = new Map();

try {
  await run();
} catch (error) {
  report.issues.push({ severity: 'critical', area: 'automation', message: error.stack || error.message });
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  await new Promise((resolve) => server.close(resolve));
  await delay(300);
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (error) {
    report.steps.push(`Chrome profile cleanup skipped: ${error.code || error.message}`);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const blockingIssues = report.issues.filter((issue) => issue.severity !== 'info');
  console.log(JSON.stringify({
    blockingIssues: blockingIssues.length,
    steps: report.steps.length,
    regions: report.regionChecks.length,
    deploymentSmoke: report.deploymentSmoke.status,
    reportFile: path.basename(reportPath)
  }, null, 2));
  if (blockingIssues.length) process.exitCode = 1;
}