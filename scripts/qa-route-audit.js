const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const jsonPath = path.join(projectRoot, "qa-route-audit-result.json");
const markdownPath = path.join(projectRoot, "docs", "MAP_ROUTE_QA.md");

const PLAYER_W = 22;
const PLAYER_H = 32;
const WALK_STEP = 8;
const NPC_INTERACTION_DISTANCE = 42;
const DOOR_INTERACTION_DISTANCE = 48;
const SIGN_INTERACTION_DISTANCE = 38;
const EXAM_ROOM_INTERACTION_DISTANCE = 78;

function makeElement() {
    return {
        classList: { contains: () => true, add() { }, remove() { }, toggle() { } },
        style: {},
        dataset: {},
        innerHTML: "",
        textContent: "",
        value: "",
        addEventListener() { },
        querySelectorAll: () => [],
        querySelector: () => null,
        closest: () => null
    };
}

function loadGameData() {
    const canvas = makeElement();
    canvas.width = 1280;
    canvas.height = 768;
    canvas.getContext = () => new Proxy({}, {
        get(target, property) {
            if (!(property in target)) target[property] = () => { };
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });

    const context = {
        console,
        window: null,
        document: { getElementById: (id) => id === "game" ? canvas : makeElement() },
        localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
        requestAnimationFrame() { }
    };
    context.window = context;
    context.window.addEventListener = () => { };
    context.window.confirm = () => false;

    vm.createContext(context);
    const curriculumCode = fs.readFileSync(path.join(projectRoot, "curriculum.js"), "utf8");
    const gameCode = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
    const exposeData = `
    globalThis.__ROUTE_QA__ = {
      WORLD_LAYOUTS,
      WORLD,
      MINI_GAMES,
      BUILDING_DOORS,
      EXAM_PRACTICE_ROOMS,
      STORY_VISUALS,
      locationOrder,
      signs,
      props,
      scenery,
      sceneryFootprint,
      LOGICAL_TILE
    };
  `;
    vm.runInContext(`${curriculumCode}\n${gameCode}\n${exposeData}`, context, { filename: "route-qa-vm.js" });
    return context.__ROUTE_QA__;
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tileAt(layout, x, y, logicalTile) {
    const col = Math.floor(x / logicalTile);
    const row = Math.floor(y / logicalTile);
    return layout.map[row]?.[col] || "#";
}

function isHarborWater(layout, x, y) {
    if (!layout.harbor) return false;
    const inWater = x >= 704 && x <= 864 && y >= 192 && y <= 352;
    const onDock = x >= 704 && x <= 850 && y >= 274 && y <= 318;
    return inWater && !onDock;
}

function isBlocked(layout, x, y, logicalTile, sceneryRects = []) {
    const playerRect = { x, y, w: PLAYER_W, h: PLAYER_H };
    const buildingHit = (layout.buildings || []).some((building) => {
        const solid = { x: building.x - 6, y: building.y - 28, w: building.w + 12, h: building.h + 34 };
        return rectsOverlap(playerRect, solid);
    });
    if (buildingHit) return true;
    if (sceneryRects.some((r) => rectsOverlap(playerRect, r))) return true;

    const points = [
        [x + 2, y + 2],
        [x + PLAYER_W - 2, y + 2],
        [x + 2, y + PLAYER_H - 2],
        [x + PLAYER_W - 2, y + PLAYER_H - 2]
    ];
    return points.some(([px, py]) => "#~T".includes(tileAt(layout, px, py, logicalTile)) || isHarborWater(layout, px, py));
}

function reachablePositions(layout, logicalTile, sceneryRects = []) {
    const spawn = layout.spawn;
    const worldW = layout.map[0].length * logicalTile;
    const worldH = layout.map.length * logicalTile;
    const maxX = worldW - PLAYER_W;
    const maxY = worldH - PLAYER_H;
    const queue = [[spawn.x, spawn.y]];
    const visited = new Set([`${spawn.x},${spawn.y}`]);

    while (queue.length) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of [[WALK_STEP, 0], [-WALK_STEP, 0], [0, WALK_STEP], [0, -WALK_STEP]]) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx > maxX || ny > maxY || visited.has(key)) continue;
            if (isBlocked(layout, nx, ny, logicalTile, sceneryRects)) continue;
            visited.add(key);
            queue.push([nx, ny]);
        }
    }
    return visited;
}

function isNear(playerPosition, item, distance) {
    const ax = playerPosition.x + PLAYER_W / 2;
    const ay = playerPosition.y + PLAYER_H / 2;
    const bx = item.x + 12;
    const by = item.y + 14;
    return Math.hypot(ax - bx, ay - by) < distance;
}

function closestReachable(visited, item, distance) {
    let closest = null;
    for (const key of visited) {
        const [x, y] = key.split(",").map(Number);
        const player = { x, y };
        const range = Math.hypot((x + PLAYER_W / 2) - (item.x + 12), (y + PLAYER_H / 2) - (item.y + 14));
        if (!closest || range < closest.distance) closest = { x, y, distance: Math.round(range) };
        if (isNear(player, item, distance)) return { reachable: true, nearest: { x, y, distance: Math.round(range) } };
    }
    return { reachable: false, nearest: closest };
}

function propBounds(prop) {
    const dimensions = {
        barrel: { w: 22, h: 31 },
        ballotBox: { w: 46, h: 45 },
        banner: { w: 64, h: 55 },
        boat: { w: 66, h: 40 },
        campaignTable: { w: 60, h: 52 },
        crate: { w: 28, h: 26 },
        dataCards: { w: 50, h: 39 },
        debateBench: { w: 66, h: 42 },
        examDesk: { w: 58, h: 52 },
        finalGate: { w: 76, h: 58 },
        kiosk: { w: 52, h: 54 },
        lamp: { w: 21, h: 46 },
        notice: { w: 40, h: 46 },
        podium: { w: 52, h: 49 },
        poster: { w: 38, h: 48 },
        petitionStand: { w: 52, h: 54 },
        planningBoard: { w: 63, h: 55 },
        scales: { w: 50, h: 48 },
        sourceArchive: { w: 58, h: 49 },
        surveyBox: { w: 42, h: 41 },
        flowers: { w: 30, h: 24 },
        bench: { w: 66, h: 34 }
    };
    return { x: prop.x, y: prop.y, ...(dimensions[prop.type] || { w: 24, h: 24 }) };
}

function passCount(items) {
    return `${items.filter((item) => item.reachable).length}/${items.length}`;
}

function routeTarget(label, item, distance, visited) {
    const result = closestReachable(visited, item, distance);
    return { label, x: item.x, y: item.y, reachable: result.reachable, nearest: result.nearest };
}

function auditRoutes() {
    const data = loadGameData();
    const { WORLD_LAYOUTS, WORLD, MINI_GAMES, BUILDING_DOORS, EXAM_PRACTICE_ROOMS, STORY_VISUALS, locationOrder, signs, props, scenery, sceneryFootprint, LOGICAL_TILE } = data;
    const exteriorIds = locationOrder;
    const regions = exteriorIds.map((locationId) => {
        const location = WORLD[locationId];
        const layout = WORLD_LAYOUTS[locationId];
        const sceneryRects = (scenery || []).filter((s) => !s.location || s.location === locationId).map((s) => sceneryFootprint(s));
        const visited = reachablePositions(layout, LOGICAL_TILE, sceneryRects);
        const visual = STORY_VISUALS[location.name];
        const locationSigns = signs.filter((sign) => sign.location === locationId);
        const locationProps = props.filter((prop) => prop.location === locationId);
        const doors = BUILDING_DOORS.filter((door) => door.from === locationId);
        const miniGameHosts = (location.npcs || []).filter((npc) => npc.miniGameId && MINI_GAMES[npc.miniGameId]);
        const triggerProps = locationProps.filter((prop) => prop.miniGameId && MINI_GAMES[prop.miniGameId]);
        const travelGateHosts = location.next ? (location.npcs || []) : [];
        const examRooms = locationId === "examHall" ? EXAM_PRACTICE_ROOMS : [];

        const targets = {
            signs: locationSigns.map((sign) => routeTarget(sign.title, { ...sign, w: 22, h: 16 }, SIGN_INTERACTION_DISTANCE, visited)),
            npcs: (location.npcs || []).map((npc) => routeTarget(npc.name, npc, NPC_INTERACTION_DISTANCE, visited)),
            doors: doors.map((door) => routeTarget(door.label, { ...door, w: 24, h: 24 }, DOOR_INTERACTION_DISTANCE, visited)),
            miniGameHosts: miniGameHosts.map((npc) => routeTarget(`${MINI_GAMES[npc.miniGameId].title} host: ${npc.name}`, npc, NPC_INTERACTION_DISTANCE, visited)),
            triggerProps: triggerProps.map((prop) => routeTarget(`${MINI_GAMES[prop.miniGameId].title} trigger: ${prop.type}`, propBounds(prop), NPC_INTERACTION_DISTANCE, visited)),
            travelGateHosts: travelGateHosts.map((npc) => routeTarget(`Travel gate via ${npc.name}`, npc, NPC_INTERACTION_DISTANCE, visited)),
            examRooms: examRooms.map((room) => routeTarget(`${room.label} practice room`, room, EXAM_ROOM_INTERACTION_DISTANCE, visited))
        };

        const allTargets = Object.values(targets).flat();
        const issues = allTargets.filter((target) => !target.reachable).map((target) => `${location.name}: ${target.label} is not reachable`);
        return {
            id: locationId,
            name: location.name,
            spawn: layout.spawn,
            mainLandmark: visual?.landmark || "-",
            reachableTileCount: visited.size,
            summary: {
                signs: passCount(targets.signs),
                npcs: passCount(targets.npcs),
                doors: passCount(targets.doors),
                miniGameHosts: passCount(targets.miniGameHosts),
                triggerProps: passCount(targets.triggerProps),
                travelGateHosts: passCount(targets.travelGateHosts),
                examRooms: passCount(targets.examRooms)
            },
            targets,
            issues
        };
    });

    const issues = regions.flatMap((region) => region.issues);
    return {
        generatedAt: new Date().toISOString(),
        status: issues.length ? "failed" : "passed",
        exteriorRegionCount: regions.length,
        regions,
        issues
    };
}

function targetSummary(items) {
    if (!items.length) return "-";
    return `${passCount(items)} ${items.filter((item) => !item.reachable).map((item) => item.label).join("; ") || "passed"}`;
}

function markdownReport(report) {
    const lines = [
        "# Map Route QA",
        "",
        "Generated route QA for Map Phase 5. This report checks reachability from each exterior region spawn to landmarks/signs, NPCs, building doors, mini-game hosts, mini-game trigger props, travel-gate hosts, and Exam Hall practice rooms.",
        "",
        `Status: ${report.status}`,
        `Generated: ${report.generatedAt}`,
        "",
        "| Region | Signs | NPCs | Doors | Mini-game Hosts | Trigger Props | Travel Gate Hosts | Exam Rooms |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...report.regions.map((region) => `| ${region.name} | ${targetSummary(region.targets.signs)} | ${targetSummary(region.targets.npcs)} | ${targetSummary(region.targets.doors)} | ${targetSummary(region.targets.miniGameHosts)} | ${targetSummary(region.targets.triggerProps)} | ${targetSummary(region.targets.travelGateHosts)} | ${targetSummary(region.targets.examRooms)} |`),
        "",
        "## Issues",
        "",
        ...(report.issues.length ? report.issues.map((issue) => `- ${issue}`) : ["- None"]),
        "",
        "## Manual Follow-up",
        "",
        "- Automated route QA checks reachability, not subjective visual clarity.",
        "- Use Dev Travel for a short manual pass across all exterior regions after layout or asset changes.",
        "- Re-run `node scripts\\qa-route-audit.js --write`, `node scripts\\validate-world.js`, and `node qa-visual-smoke.mjs` after map changes."
    ];
    return `${lines.join("\n")}\n`;
}

const report = auditRoutes();
if (process.argv.includes("--write")) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, markdownReport(report), "utf8");
    console.log(`Wrote ${path.relative(projectRoot, jsonPath)} and ${path.relative(projectRoot, markdownPath)}`);
} else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (report.issues.length) process.exitCode = 1;
