import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = 4200;
const debugPort = 14600 + Math.floor(Math.random() * 400);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.join(process.env.TEMP || root, `citizenship-slice-${Date.now()}`);
const srcDir = 'assets/characters/portraits-src';
const outDir = path.join(root, 'assets/characters/portraits');

// Atlases have NO number badges; captions (names) are at the BOTTOM of each card.
// We keep the WHOLE card (full portrait + name caption), preserving its natural aspect.
// Both are uniform grids, so we slice mathematically (no gutter detection — the
// page background is warm cream, not pure white). Order per docs/NPC_CHARACTER_GUIDE.md §4.
// NPC-1 = 7×4 grid (28 cards, ids 1..28, includes elderGrace).
// NPC-2 = 2×2 grid (Ash dup + the 3 missing: sourceNia, coachLeon, scribePip).
const SOURCES = [
    {
        file: 'NPC-1.png',
        cols: 7,
        rows: 4,
        ids: [
            'mayor', 'priya', 'sam', 'rowan', 'noor', 'editorVale', 'historianIona',
            'aidMina', 'dataOmar', 'elderGrace', 'advocateFarah', 'sergeantBlake', 'mediatorChen', 'youthEllis',
            'speakerLark', 'mpRivers', 'managerSol', 'officerJune', 'heraldEwan', 'unionMorgan', 'charityAmina',
            'lobbyistPax', 'moderatorRae', 'surveyorTess', 'statJules', 'organiserKai', 'examinerMira', 'timeAsh'
        ]
    },
    {
        file: 'NPC-2.png',
        cols: 2,
        rows: 2,
        ids: ['timeAsh', 'sourceNia', 'coachLeon', 'scribePip']
    }
];

function contentType(file) {
    if (file.endsWith('.png')) return 'image/png';
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    return 'application/octet-stream';
}
const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://127.0.0.1:${port}`);
    const requested = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    const safePath = path.normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, '');
    const filePath = path.join(root, safePath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const pending = new Map();
let socket;
async function cdp(method, params = {}) { const id = ++cdp.id; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method })); }
cdp.id = 0;
async function evalJs(expression, awaitPromise = true) { const result = await cdp('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function waitFor(fn, label, timeout = 15000) { const s = Date.now(); let last; while (Date.now() - s < timeout) { try { last = await fn(); if (last) return last; } catch (e) { last = e; } await delay(120); } throw new Error(`Timed out: ${label}: ${last?.message || last}`); }

const SLICER = (cols, rows) => `(async () => {
  const cols = ${cols}, rows = ${rows};
  const img = document.getElementById('src');
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  // background = warm cream page colour (not pure white).
  const isBg = (x, y) => { const i = (y * W + x) * 4; return data[i] > 240 && data[i+1] > 238 && data[i+2] > 236; };
  const rowBg = (y) => { let b = 0, n = 0; for (let x = 0; x < W; x += 2) { n++; if (isBg(x, y)) b++; } return b / n; };
  const colBg = (x) => { let b = 0, n = 0; for (let y = 0; y < H; y += 2) { n++; if (isBg(x, y)) b++; } return b / n; };

  // The atlas is a UNIFORM grid but can have a small/uneven cream margin (NPC-1 has a
  // ~24px top margin, so a blind even-division from y=0 drifts the lower rows and bleeds
  // the previous row's name caption into the next crop). Strategy: rough-trim the margin,
  // estimate the even pitch, then LOCK each interior boundary onto the real cream gap by
  // searching a window around its expected position. Robust to margin offset + slight
  // non-uniformity, while caption text (dark) keeps in-card bands from being false gaps.
  function trim(profileFn, length) {
    let a = 0; while (a < length - 1 && profileFn(a) > 0.96) a++;
    let b = length - 1; while (b > a && profileFn(b) > 0.96) b--;
    return [a, b];
  }
  function gapCenter(profileFn, lo, hi) {
    lo = Math.max(0, Math.round(lo)); hi = Math.round(hi);
    let bestS = -1, bestLen = -1, s = -1;
    for (let i = lo; i <= hi; i++) {
      const hiBg = profileFn(i) >= 0.9;
      if (hiBg && s < 0) s = i;
      if ((!hiBg || i === hi) && s >= 0) {
        const e = hiBg ? i : i - 1;
        if (e - s > bestLen) { bestLen = e - s; bestS = s; }
        s = -1;
      }
    }
    if (bestS < 0) { // no clear gap: argmax of background in window
      let ba = lo, bv = -1;
      for (let i = lo; i <= hi; i++) { const v = profileFn(i); if (v > bv) { bv = v; ba = i; } }
      return ba;
    }
    return bestS + bestLen / 2;
  }
  function cuts(profileFn, length, count) {
    const [a, b] = trim(profileFn, length);
    const pitch = (b - a) / count;
    const out = [a];
    for (let r = 1; r < count; r++) {
      const expected = a + r * pitch;
      out.push(gapCenter(profileFn, expected - pitch * 0.2, expected + pitch * 0.2));
    }
    out.push(b);
    return out;
  }
  const rowCuts = cuts(rowBg, H, rows);
  const colCuts = cuts(colBg, W, cols);

  const results = [];
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const y0 = rowCuts[r], y1 = rowCuts[r + 1];
      const x0 = colCuts[cc], x1 = colCuts[cc + 1];
      // small inset to sit just inside the card border / drop the gap centre line
      const padX = (x1 - x0) * 0.012;
      const padY = (y1 - y0) * 0.012;
      const sx = Math.round(x0 + padX);
      const sy = Math.round(y0 + padY);
      const sw = Math.round((x1 - x0) - padX * 2);
      const sh = Math.round((y1 - y0) - padY * 2);
      const outW = 320;
      const outH = Math.round(outW * sh / sw);
      const oc = document.createElement('canvas'); oc.width = outW; oc.height = outH;
      const octx = oc.getContext('2d');
      octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
      octx.drawImage(c, sx, sy, sw, sh, 0, 0, outW, outH);
      results.push(oc.toDataURL('image/png').split(',')[1]);
    }
  }
  return JSON.stringify({ count: results.length, rowCuts: rowCuts.map((v) => Math.round(v)), colCuts: colCuts.map((v) => Math.round(v)), pngs: results });
})()`;

let chrome;
async function run() {
    fs.mkdirSync(outDir, { recursive: true });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    fs.writeFileSync(path.join(root, '__slice.html'), '<!doctype html><meta charset=utf-8><body style="margin:0"><img id=src></body>');
    chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await waitFor(async () => { const r = await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null); return r?.ok ? r.json() : null; }, 'devtools');
    const pageInfo = await waitFor(async () => { const cr = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).catch(() => null); if (cr?.ok) return cr.json(); return null; }, 'page');
    socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', (event) => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(method + ': ' + m.error.message)); else resolve(m.result || {}); } });
    await cdp('Runtime.enable');
    await cdp('Page.enable');
    await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/__slice.html` });
    await waitFor(async () => evalJs('document.readyState === "complete"'), 'page load');

    const saved = [];
    for (const src of SOURCES) {
        await evalJs(`new Promise((res, rej) => { const im = document.getElementById('src'); im.onload = () => res(true); im.onerror = rej; im.src = '/${srcDir}/${src.file}?cb=' + Date.now(); })`);
        await delay(150);
        const parsed = JSON.parse(await evalJs(SLICER(src.cols, src.rows)));
        if (parsed.count !== src.ids.length) {
            console.error(`WARNING ${src.file}: produced ${parsed.count} crops but mapped ${src.ids.length} ids`);
        }
        console.error(`${src.file} rowCuts=${JSON.stringify(parsed.rowCuts)} colCuts=${JSON.stringify(parsed.colCuts)}`);
        parsed.pngs.forEach((b64, i) => {
            const id = src.ids[i];
            if (!id) return;
            fs.writeFileSync(path.join(outDir, id + '.png'), Buffer.from(b64, 'base64'));
            saved.push(id);
        });
    }
    console.log(JSON.stringify({ savedCount: saved.length, saved }, null, 2));
}
run().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
    try { fs.unlinkSync(path.join(root, '__slice.html')); } catch { }
    try { socket?.close(); } catch { }
    try { chrome?.kill(); } catch { }
    server.close();
});
