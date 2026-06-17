const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const PLAYER_W = 22;
const PLAYER_H = 32;
const WALK_STEP = 8;
const NPC_INTERACTION_DISTANCE = 42;
const DOOR_INTERACTION_DISTANCE = 48;
const NPC_DOOR_CONFLICT_DISTANCE = 76;
const STUDY_STATION_INTERACTION_DISTANCE = 64;
const INTERIOR_EXIT_INTERACTION_DISTANCE = 54;
const EXAM_ROOM_INTERACTION_DISTANCE = 78;

function makeElement() {
    return {
        classList: {
            contains: () => true,
            add() { },
            remove() { },
            toggle() { }
        },
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
        document: {
            getElementById: (id) => id === "game" ? canvas : makeElement()
        },
        localStorage: {
            getItem: () => null,
            setItem() { },
            removeItem() { }
        },
        requestAnimationFrame() { }
    };
    context.window = context;
    context.window.addEventListener = () => { };
    context.window.confirm = () => false;

    vm.createContext(context);
    const curriculumCode = fs.readFileSync(path.join(projectRoot, "curriculum.js"), "utf8");
    const gameCode = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
    const exposeData = `
    globalThis.__WORLD_VALIDATION__ = {
      WORLD_LAYOUTS,
      WORLD,
      QUESTS,
    MINI_GAMES,
    BUILDING_DOORS,
    INTERIOR_EXITS,
    STUDY_STATIONS,
    PROP_ASSETS,
      locationOrder,
      signs,
      props,
      scenery,
      sceneryFootprint,
      EXAM_PRACTICE_ROOMS,
      LOGICAL_TILE,
      regionBuildingLabel,
      state,
      curriculumIndex: window.GCSE_CURRICULUM_INDEX || {}
    };
  `;

    vm.runInContext(`${curriculumCode}\n${gameCode}\n${exposeData}`, context, { filename: "world-validation-vm.js" });
    return context.__WORLD_VALIDATION__;
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

function isNearInteractable(playerPosition, item, distance) {
    const ax = playerPosition.x + PLAYER_W / 2;
    const ay = playerPosition.y + PLAYER_H / 2;
    const bx = item.x + 12;
    const by = item.y + 14;
    return Math.hypot(ax - bx, ay - by) < distance;
}

function interactableDistance(a, b) {
    const ax = a.x + 12;
    const ay = a.y + 14;
    const bx = b.x + 12;
    const by = b.y + 14;
    return Math.hypot(ax - bx, ay - by);
}

function findReachablePositions(layout, logicalTile, sceneryRects = []) {
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

function canReachInteractable(visited, item, distance) {
    for (const key of visited) {
        const [x, y] = key.split(",").map(Number);
        if (isNearInteractable({ x, y }, item, distance)) return true;
    }
    return false;
}

function reachableInteractables(visited, items, distance) {
    return items.filter((item) => canReachInteractable(visited, item, distance));
}

function validateAnswerSet(failures, owner, check) {
    if (!check || typeof check.question !== "string" || !check.question.trim()) {
        failures.push(`${owner} is missing a question.`);
        return;
    }
    if (!Array.isArray(check.answers) || check.answers.length < 2) {
        failures.push(`${owner} needs at least two answers.`);
        return;
    }
    if (!Number.isInteger(check.correct) || check.correct < 0 || check.correct >= check.answers.length) {
        failures.push(`${owner} has an invalid correct answer index.`);
    }
}

function questLocationId(WORLD, questId, quest) {
    if (quest.location && WORLD[quest.location]) return quest.location;
    return Object.keys(WORLD).find((locationId) => WORLD[locationId].questIds?.includes(questId));
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
    const size = dimensions[prop.type] || { w: 24, h: 24 };
    return { x: prop.x, y: prop.y, w: size.w, h: size.h };
}

function propTouchesTile(layout, prop, tile, logicalTile) {
    const bounds = propBounds(prop);
    const points = [
        [bounds.x, bounds.y],
        [bounds.x + bounds.w - 1, bounds.y],
        [bounds.x, bounds.y + bounds.h - 1],
        [bounds.x + bounds.w - 1, bounds.y + bounds.h - 1]
    ];
    return points.some(([x, y]) => tileAt(layout, x, y, logicalTile) === tile);
}

function validateWorld() {
    const data = loadGameData();
    const failures = [];
    const { WORLD_LAYOUTS, WORLD, QUESTS, MINI_GAMES, BUILDING_DOORS, INTERIOR_EXITS, STUDY_STATIONS, PROP_ASSETS, TILE_ASSETS, TREE_ASSET, HERO_ASSETS, locationOrder, props, scenery, sceneryFootprint, EXAM_PRACTICE_ROOMS, LOGICAL_TILE, curriculumIndex, regionBuildingLabel, state } = data;

    if (!Array.isArray(locationOrder) || locationOrder.length === 0) failures.push("locationOrder must list at least one location.");

    Object.entries(PROP_ASSETS || {}).forEach(([type, assetPath]) => {
        if (!fs.existsSync(path.join(projectRoot, assetPath))) failures.push(`Prop asset ${type} points to missing file ${assetPath}.`);
    });

    Object.entries(TILE_ASSETS || {}).forEach(([type, assetPath]) => {
        if (!fs.existsSync(path.join(projectRoot, assetPath))) failures.push(`Tile asset ${type} points to missing file ${assetPath}.`);
    });

    if (TREE_ASSET && !fs.existsSync(path.join(projectRoot, TREE_ASSET))) failures.push(`Tree asset points to missing file ${TREE_ASSET}.`);

    Object.entries(HERO_ASSETS || {}).forEach(([type, assetPath]) => {
        if (!fs.existsSync(path.join(projectRoot, assetPath))) failures.push(`Hero asset ${type} points to missing file ${assetPath}.`);
    });

    const questIds = new Set(Object.keys(QUESTS));
    Object.keys(curriculumIndex).forEach((questId) => {
        if (!questIds.has(questId)) failures.push(`Curriculum topic ${questId} does not match a quest.`);
    });

    Object.entries(QUESTS).forEach(([questId, quest]) => {
        const locationId = questLocationId(WORLD, questId, quest);
        validateAnswerSet(failures, `Quest ${questId}`, quest);
        if (!quest.curriculum?.correctAnswer) failures.push(`Quest ${questId} is missing a curriculum explanation.`);
        if (!locationId) {
            failures.push(`Quest ${questId} is not assigned to a location.`);
            return;
        }
        if (!WORLD[locationId]?.npcs.some((npc) => npc.id === quest.giver)) failures.push(`Quest ${questId} has missing giver ${quest.giver}.`);
        if (!WORLD[locationId]?.npcs.some((npc) => npc.id === quest.target)) failures.push(`Quest ${questId} has missing target ${quest.target}.`);
    });

    locationOrder.forEach((locationId, orderIndex) => {
        const location = WORLD[locationId];
        const layout = WORLD_LAYOUTS[locationId];
        if (!location) {
            failures.push(`Location ${locationId} is missing from WORLD.`);
            return;
        }
        if (!layout) {
            failures.push(`Location ${locationId} is missing from WORLD_LAYOUTS.`);
            return;
        }

        const width = layout.map[0]?.length;
        if (!width || layout.map.some((row) => row.length !== width)) failures.push(`Location ${locationId} map must be rectangular.`);
        const locSceneryRects = (scenery || []).filter((s) => !s.location || s.location === locationId).map((s) => sceneryFootprint(s));
        if (!layout.spawn || isBlocked(layout, layout.spawn.x, layout.spawn.y, LOGICAL_TILE, locSceneryRects)) failures.push(`Location ${locationId} spawn is blocked.`);

        const expectedNext = orderIndex < locationOrder.length - 1 ? locationOrder[orderIndex + 1] : null;
        if (location.next !== expectedNext) failures.push(`Location ${locationId} has next=${location.next}; expected ${expectedNext}.`);
        if (expectedNext && !WORLD[location.next]) failures.push(`Location ${locationId} travel gate points to missing location ${location.next}.`);
        if (expectedNext && location.travel === "Course complete") failures.push(`Location ${locationId} has a completion label before the final region.`);
        if (!Array.isArray(location.gateQuestions) || location.gateQuestions.length !== 3) failures.push(`Location ${locationId} must have exactly three travel gate questions.`);
        (location.gateQuestions || []).forEach((question, index) => validateAnswerSet(failures, `${locationId} gate question ${index + 1}`, question));

        (location.questIds || []).forEach((questId) => {
            if (!QUESTS[questId]) failures.push(`Location ${locationId} references missing quest ${questId}.`);
        });

        const reachable = findReachablePositions(layout, LOGICAL_TILE, locSceneryRects);
        const reachableNpcs = reachableInteractables(reachable, location.npcs || [], NPC_INTERACTION_DISTANCE);
        const buildingDoors = (BUILDING_DOORS || []).filter((door) => door.from === locationId);
        const studyStations = STUDY_STATIONS?.[locationId] || [];
        const interiorExit = INTERIOR_EXITS?.[locationId] || null;
        const locationProps = props.filter((prop) => !prop.location || prop.location === locationId);

        if ((location.next || orderIndex < locationOrder.length - 1) && !reachableNpcs.length) failures.push(`Location ${locationId} has no reachable NPC for the travel gate.`);
        buildingDoors.forEach((door) => {
            if (!canReachInteractable(reachable, { ...door, w: 24, h: 24 }, DOOR_INTERACTION_DISTANCE)) failures.push(`Building door ${locationId}:${door.id} (${door.label}) is not reachable from spawn.`);
            if (door.returnSpawn && isBlocked(layout, door.returnSpawn.x, door.returnSpawn.y, LOGICAL_TILE, locSceneryRects)) failures.push(`Building door ${locationId}:${door.id} has a blocked return spawn.`);
        });
        studyStations.forEach((station) => {
            if (!canReachInteractable(reachable, { ...station, w: 28, h: 20 }, STUDY_STATION_INTERACTION_DISTANCE)) failures.push(`Study station ${locationId}:${station.id} is not reachable from spawn.`);
        });
        if (interiorExit && !canReachInteractable(reachable, { ...interiorExit, w: 28, h: 20 }, INTERIOR_EXIT_INTERACTION_DISTANCE)) failures.push(`Interior exit ${locationId} -> ${interiorExit.target} is not reachable from spawn.`);

        locationProps.filter((prop) => prop.miniGameId).forEach((prop) => {
            const bounds = propBounds(prop);
            if (!MINI_GAMES?.[prop.miniGameId]) failures.push(`Mini-game trigger prop ${locationId}:${prop.type} at ${prop.x},${prop.y} references missing mini-game ${prop.miniGameId}.`);
            if (!canReachInteractable(reachable, bounds, NPC_INTERACTION_DISTANCE)) failures.push(`Mini-game trigger prop ${locationId}:${prop.type} at ${prop.x},${prop.y} is not reachable from spawn.`);
        });

        (location.npcs || []).forEach((npc) => {
            (npc.checks || []).forEach((check, index) => validateAnswerSet(failures, `${locationId} ${npc.id} check ${index + 1}`, check));
            if (!canReachInteractable(reachable, npc, NPC_INTERACTION_DISTANCE)) failures.push(`NPC ${locationId}:${npc.id} is not reachable from spawn.`);
            buildingDoors.forEach((door) => {
                const distance = interactableDistance(npc, door);
                if (distance < NPC_DOOR_CONFLICT_DISTANCE) failures.push(`NPC ${locationId}:${npc.id} is too close to door ${door.id} (${Math.round(distance)}px).`);
            });
            if (npc.miniGameId) {
                if (!MINI_GAMES?.[npc.miniGameId]) failures.push(`Mini-game host ${locationId}:${npc.id} references missing mini-game ${npc.miniGameId}.`);
                if (!canReachInteractable(reachable, npc, NPC_INTERACTION_DISTANCE)) failures.push(`Mini-game host ${locationId}:${npc.id} is not reachable from spawn.`);
            }
            const npcBox = { x: npc.x - 6, y: npc.y - 17, w: 36, h: 65 };
            locationProps.forEach((prop) => {
                if (rectsOverlap(npcBox, propBounds(prop))) failures.push(`NPC ${locationId}:${npc.id} overlaps ${prop.type} at ${prop.x},${prop.y}.`);
            });
        });

        if (locationId === "examHall") {
            EXAM_PRACTICE_ROOMS.forEach((room) => {
                if (!canReachInteractable(reachable, room, EXAM_ROOM_INTERACTION_DISTANCE)) failures.push(`Exam practice room ${room.id} is not reachable from spawn.`);
                if (!room.question || !Array.isArray(room.plan) || !room.plan.length || !room.model) failures.push(`Exam practice room ${room.id} is missing question, plan, or model answer.`);
            });
        }

        state.currentLocation = locationId;
        if (locationId === "village") {
            props.forEach((prop) => {
                if (propTouchesTile(layout, prop, "=", LOGICAL_TILE)) failures.push(`Village ${prop.type} at ${prop.x},${prop.y} sits on a road tile.`);
            });
        }
        (layout.buildings || []).forEach((building, index) => {
            const label = regionBuildingLabel(index);
            const signW = Math.max(54, label.length * 7);
            const signBox = { x: building.x + building.w / 2 - signW / 2 - 2, y: building.y - 41, w: signW + 4, h: 16 };
            (location.npcs || []).forEach((npc) => {
                const npcBox = { x: npc.x - 6, y: npc.y - 17, w: 36, h: 65 };
                if (rectsOverlap(signBox, npcBox)) failures.push(`Building label ${locationId}:${label} overlaps NPC ${npc.id}.`);
            });
            locationProps.forEach((prop) => {
                if (rectsOverlap(signBox, propBounds(prop))) failures.push(`Building label ${locationId}:${label} overlaps ${prop.type} at ${prop.x},${prop.y}.`);
            });
        });
    });

    if (failures.length) {
        console.error(`World validation failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exitCode = 1;
        return;
    }

    console.log(`World validation passed: ${locationOrder.length} locations, ${Object.keys(QUESTS).length} quests, ${EXAM_PRACTICE_ROOMS.length} exam practice rooms.`);
}

validateWorld();
