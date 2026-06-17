import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4177;
const debugPort = 9300 + Math.floor(Math.random() * 500);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-qa-${Date.now()}`);
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
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
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
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${last && last.message ? last.message : last}`);
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

async function hideDialogues() {
  await evalJs(`(() => { hideDialogue?.(); hidePanel?.(); hideStoryPanel?.(); closeMiniGamePanel?.(); closeInventoryPanel?.(); closeProgressPanel?.(); closeCharacterPanel?.(); return true; })()`);
}

async function setNearNpc(npcId) {
  return evalJs(`(() => {
    const npc = npcById(${JSON.stringify(npcId)});
    if (!npc) return { ok:false, reason:'missing npc' };
    const candidates = [];
    for (let dy = -64; dy <= 64; dy += 8) {
      for (let dx = -64; dx <= 64; dx += 8) {
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
        return { ok:true, npc, player:{ x: state.player.x, y: state.player.y }, found: found.item.id };
      }
    }
    return { ok:false, reason:'no unblocked spot where findInteractable returns this npc', npc };
  })()`);
}

async function openNpcMenu(npcId) {
  const placed = await setNearNpc(npcId);
  if (!placed.ok) throw new Error(`Cannot stand near ${npcId}: ${placed.reason}`);
  await evalJs(`(() => { interact(); return { visible: !choicePanel.classList.contains('hidden'), title: choicePanel.textContent.slice(0, 120) }; })()`);
  await waitFor(async () => visible('#choicePanel'), `NPC menu ${npcId}`);
  return placed;
}

async function clickMenu(action, extra = '') {
  const selector = `button[data-menu="${action}"]${extra}`;
  await click(selector);
}

async function answerCorrect(selectorBase, attrName, correctIndex) {
  const before = await evalJs(`(() => [...document.querySelectorAll(${JSON.stringify(selectorBase)})].map((button, pos) => ({ pos, original: Number(button.dataset[${JSON.stringify(attrName)}]), text: button.textContent.trim() })))()`);
  const correctButton = before.find((entry) => entry.original === correctIndex);
  if (!correctButton) throw new Error(`Correct answer ${correctIndex} not rendered for ${selectorBase}; rendered ${JSON.stringify(before)}`);
  await click(`${selectorBase}[data-${attrName.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${correctIndex}"]`);
  await delay(950);
  return before;
}

async function completeQuestViaUi(questId) {
  const quest = await evalJs(`(() => {
    const q = QUESTS[${JSON.stringify(questId)}];
    return q ? { id:${JSON.stringify(questId)}, title:q.title, giver:q.giver, target:q.target, correct:q.correct, answers:q.answers } : null;
  })()`);
  if (!quest) throw new Error(`Quest not found: ${questId}`);
  report.steps.push(`Quest ${quest.title}: start`);

  await hideDialogues();
  await openNpcMenu(quest.giver);
  await clickMenu('quests');
  await click(`button[data-menu="acceptQuest"][data-quest="${questId}"]`);
  await delay(150);
  await hideDialogues();

  await openNpcMenu(quest.target);
  const askVisible = await evalJs(`(() => !!document.querySelector('button[data-menu="askQuest"]'))()`);
  if (!askVisible) throw new Error(`Ask quest button missing for target ${quest.target}`);
  await clickMenu('askQuest');
  await delay(150);
  await hideDialogues();

  await openNpcMenu(quest.giver);
  const turnInVisible = await evalJs(`(() => !!document.querySelector('button[data-menu="turnIn"]'))()`);
  if (!turnInVisible) throw new Error(`Turn-in button missing for giver ${quest.giver}`);
  await clickMenu('turnIn');
  await waitFor(async () => evalJs(`(() => document.querySelectorAll('button[data-quest-answer]').length > 0)()`), `quest answers ${questId}`);
  const renderedOrder = await answerCorrect('button[data-quest-answer]', 'questAnswer', quest.correct);
  await hideDialogues();

  const completed = await evalJs(`(() => state.completedQuests.has(${JSON.stringify(questId)}))()`);
  if (!completed) throw new Error(`Quest did not complete: ${questId}`);
  report.steps.push(`Quest ${quest.title}: complete; answer order ${renderedOrder.map((item) => item.original).join(',')}`);
  return { quest, renderedOrder };
}

async function completeCurrentTravelGate(npcId = 'mayor') {
  await hideDialogues();
  await openNpcMenu(npcId);
  const travelVisible = await evalJs(`(() => !!document.querySelector('button[data-menu="travel"]'))()`);
  if (!travelVisible) throw new Error(`Travel button missing for ${npcId}`);
  await clickMenu('travel');
  for (let step = 0; step < 3; step += 1) {
    await waitFor(async () => evalJs(`(() => document.querySelectorAll('button[data-gate-answer]').length > 0)()`), `travel gate answers ${step + 1}`);
    const correct = await evalJs(`(() => {
      const gate = state.pendingGate;
      if (!gate) return null;
      return WORLD[gate.location].gateQuestions[gate.index].correct;
    })()`);
    const order = await answerCorrect('button[data-gate-answer]', 'gateAnswer', correct);
    report.steps.push(`Travel gate question ${step + 1}: answer order ${order.map((item) => item.original).join(',')}`);
  }
  await waitFor(async () => evalJs(`(() => state.currentLocation !== 'village')()`), 'travel gate moved to next region');
  if (await visible('#storyPanel')) await click('#storyContinueButton');
  await hideDialogues();
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
  const chromeErrors = [];
  chrome.stderr?.on('data', (chunk) => chromeErrors.push(String(chunk).trim()));
  chrome.stdout?.on('data', (chunk) => chromeErrors.push(String(chunk).trim()));
  report.setup.push(`Chrome started with remote debugging on ${debugPort}`);

  await waitFor(async () => {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}: ${chromeErrors.join('\n')}`);
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

  const wsUrl = pageInfo.webSocketDebuggerUrl;
  socket = new WebSocket(wsUrl);
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

  await evalJs('localStorage.clear(); location.reload(); true');
  await waitFor(async () => evalJs('document.readyState === "complete" && !!document.querySelector("#titleScreen")'), 'reload after clear');
  await waitFor(async () => visible('#titleScreen'), 'title screen visible');
  report.steps.push('Title screen visible after clean save');

  await click('#titleNewBtn');
  await waitFor(async () => visible('#customScreen'), 'custom screen visible');
  await evalJs(`(() => {
    document.querySelector('#customNameInput').value = 'QA Scout';
    document.querySelector('button[data-preset="girlLiberty"]').click();
    document.querySelector('button[data-accent="forest"]').click();
    return true;
  })()`);
  await click('#customStartBtn');
  await waitFor(async () => visible('#storyPanel'), 'intro story panel visible');
  report.steps.push('New Game customization completed; intro story shown');
  await click('#storyContinueButton');
  await waitFor(async () => !(await visible('#storyPanel')), 'intro story closed');

  const snapshot = await evalJs(`(() => ({
    version: document.body.dataset.appVersion,
    profile: state.profile,
    location: state.currentLocation,
    questIds: WORLD.village.questIds,
    npcs: npcs.map((npc) => ({ id:npc.id, name:npc.name, x:npc.x, y:npc.y, questIds:npc.questIds })),
    inventory: state.inventory,
    equipped: state.equipped,
    storySeen: [...state.storySeen]
  }))()`);
  report.steps.push(`Initial state: ${JSON.stringify(snapshot)}`);

  const expectedQuestIds = snapshot.questIds;
  if (!Array.isArray(expectedQuestIds) || expectedQuestIds.length === 0) {
    report.issues.push({ severity: 'high', area: 'quests', message: 'Village has no questIds.' });
  }

  const placement = [];
  for (const npc of snapshot.npcs) {
    const placed = await setNearNpc(npc.id);
    placement.push({ npc: npc.id, ...placed });
    if (!placed.ok) report.issues.push({ severity: 'high', area: 'reachability', message: `Could not stand near ${npc.name}: ${placed.reason}` });
  }
  report.steps.push(`NPC adjacency check: ${JSON.stringify(placement)}`);

  await openNpcMenu('priya');
  const priyaMiniGame = await evalJs(`(() => {
    const button = document.querySelector('button[data-menu="miniGame"]');
    return button ? button.textContent.trim() : null;
  })()`);
  if (!priyaMiniGame) report.issues.push({ severity: 'medium', area: 'mini-games', message: 'Priya has no visible first-location mini-game button.' });
  else report.steps.push(`First-location mini-game entry visible at Priya: ${priyaMiniGame}`);
  await hideDialogues();

  for (const questId of expectedQuestIds) {
    try {
      await completeQuestViaUi(questId);
    } catch (error) {
      report.issues.push({ severity: 'high', area: 'quest-flow', message: `${questId}: ${error.message}` });
      await hideDialogues();
    }
  }

  try {
    await completeCurrentTravelGate('mayor');
    report.steps.push('Travel gate completed; first region exited.');
  } catch (error) {
    report.issues.push({ severity: 'high', area: 'travel-gate', message: error.message });
    await hideDialogues();
  }

  const finalState = await evalJs(`(() => ({
    profile: state.profile,
    currentLocation: state.currentLocation,
    completedQuestCount: state.completedQuests.size,
    expectedQuestCount: WORLD.village.questIds.length,
    modernBritainUnlocked: state.unlockedLocations.has('modernBritain'),
    completedQuests: [...state.completedQuests],
    badges: state.badges,
    coins: state.coins,
    knowledge: state.knowledge,
    stats: state.stats,
    inventory: state.inventory,
    equipped: state.equipped,
    questText: state.quest,
    journal: state.journal,
    activeQuest: state.activeQuest,
    pendingGate: state.pendingGate,
    storySeen: [...state.storySeen],
    save: JSON.parse(localStorage.getItem('citizenshipValleySaveV1') || 'null')
  }))()`);
  report.finalState = finalState;

  if (finalState.completedQuestCount !== finalState.expectedQuestCount) {
    report.issues.push({ severity: 'high', area: 'completion', message: `Completed ${finalState.completedQuestCount}/${finalState.expectedQuestCount} village quests.` });
  }
  if (finalState.activeQuest) {
    report.issues.push({ severity: 'medium', area: 'completion', message: `activeQuest remained after run: ${JSON.stringify(finalState.activeQuest)}` });
  }
  if (!finalState.save || finalState.save.completedQuests?.length !== finalState.expectedQuestCount) {
    report.issues.push({ severity: 'medium', area: 'save', message: 'Save did not persist all completed village quests.' });
  }

  const answerOrders = report.steps.filter((step) => step.includes('answer order'));
  const allFirst = answerOrders.length && answerOrders.every((step) => /answer order 0[,)]/.test(step));
  if (allFirst) {
    report.issues.push({ severity: 'medium', area: 'answers', message: 'All rendered correct quest answers appeared first during this run; shuffle may not be visibly effective in this sample.' });
  }

  if (!report.issues.length) {
    report.issues.push({ severity: 'info', area: 'qa', message: 'No blocking issues found in automated first-location quest flow. See limitations in the saved report.' });
  }
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
  fs.writeFileSync(path.join(root, 'qa-first-location-playthrough-result.json'), JSON.stringify(report, null, 2));
  await delay(500);
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (error) {
    report.setup.push(`Chrome profile cleanup skipped: ${error.code || error.message}`);
    fs.writeFileSync(path.join(root, 'qa-first-location-playthrough-result.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify({ issues: report.issues.length, finalState: report.finalState && { completedQuestCount: report.finalState.completedQuestCount, expectedQuestCount: report.finalState.expectedQuestCount, coins: report.finalState.coins, knowledge: report.finalState.knowledge }, reportFile: 'qa-first-location-playthrough-result.json' }, null, 2));
}
