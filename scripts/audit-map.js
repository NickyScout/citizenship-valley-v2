const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "docs", "MAP_AUDIT.md");

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
    globalThis.__MAP_AUDIT__ = {
      WORLD_LAYOUTS,
      WORLD,
      MINI_GAMES,
      BUILDING_DOORS,
      STUDY_STATIONS,
      INTERIOR_EXITS,
      EXAM_PRACTICE_ROOMS,
      STORY_VISUALS,
      locationOrder,
      signs,
      props
    };
  `;

    vm.runInContext(`${curriculumCode}\n${gameCode}\n${exposeData}`, context, { filename: "map-audit-vm.js" });
    return context.__MAP_AUDIT__;
}

function point(item) {
    if (!item) return "-";
    return `${Math.round(item.x)},${Math.round(item.y)}`;
}

function list(items, mapper) {
    return items.length ? items.map(mapper).join("; ") : "-";
}

function escapeCell(value) {
    return String(value || "-").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function regionNotes(locationId, location, layout, doors, miniHosts, signsForLocation, propsForLocation, visual) {
    const notes = [];
    if (!visual) notes.push("add explicit landmark metadata");
    if (!signsForLocation.length) notes.push("no local signposts yet");
    if (!propsForLocation.length) notes.push("no decorative/wayfinding props yet");
    if (!miniHosts.length) notes.push("no mini-game host in this region");
    if (location.next) notes.push("travel gate is currently NPC-menu based, not a world prop");
    if (!layout.buildings?.length) notes.push("no exterior buildings");
    if (doors.length !== (layout.buildings || []).length && locationId !== "examHall") notes.push("some buildings have no door mapping");
    return notes.length ? notes.join("; ") : "ready for focused layout pass";
}

function blockedZoneSummary(layout) {
    const counts = { wall: 0, water: 0, tree: 0, road: 0, path: 0, plaza: 0 };
    (layout.map || []).forEach((row) => {
        [...row].forEach((tile) => {
            if (tile === "#") counts.wall += 1;
            if (tile === "~") counts.water += 1;
            if (tile === "T") counts.tree += 1;
            if (tile === "=") counts.road += 1;
            if (tile === ",") counts.path += 1;
            if (tile === ":") counts.plaza += 1;
        });
    });
    const parts = [`walls ${counts.wall}`];
    if (counts.water) parts.push(`water ${counts.water}${layout.harbor ? " + harbour exclusion" : ""}`);
    if (counts.tree) parts.push(`trees ${counts.tree}`);
    if (counts.road || counts.path || counts.plaza) parts.push(`routes ${counts.road + counts.path + counts.plaza}`);
    return parts.join(", ");
}

function zoneSketch(location, layout, visual, doors, miniHosts, miniGames) {
    return {
        location: location.name,
        safeSpawn: point(layout.spawn),
        centralHub: visual ? visual.landmark : "needs landmark metadata",
        npcCluster: (location.npcs || []).map((npc) => `${npc.name}@${point(npc)}`),
        learningBuildings: doors.map((door) => `${door.label}@${point(door)}`),
        miniGameArea: miniHosts.map((npc) => `${miniGames[npc.miniGameId]?.title || npc.miniGameId}@${point(npc)}`),
        travelEdge: location.next ? `${location.travel} via NPC menu` : location.travel,
        blockedZones: blockedZoneSummary(layout)
    };
}

function buildMarkdown() {
    const data = loadGameData();
    const { WORLD_LAYOUTS, WORLD, MINI_GAMES, BUILDING_DOORS, STUDY_STATIONS, INTERIOR_EXITS, EXAM_PRACTICE_ROOMS, STORY_VISUALS, locationOrder, signs, props } = data;
    const zoneSketches = [];
    const exteriorRows = locationOrder.map((locationId) => {
        const location = WORLD[locationId];
        const layout = WORLD_LAYOUTS[locationId];
        const visual = STORY_VISUALS[location.name];
        const doors = BUILDING_DOORS.filter((door) => door.from === locationId);
        const signsForLocation = signs.filter((sign) => sign.location === locationId);
        const propsForLocation = props.filter((prop) => prop.location === locationId);
        const miniTriggerProps = propsForLocation.filter((prop) => prop.miniGameId);
        const miniHosts = (location.npcs || []).filter((npc) => npc.miniGameId);
        const npcText = list(location.npcs || [], (npc) => `${npc.name} (${point(npc)})`);
        const doorText = list(doors, (door) => `${door.label} ${point(door)} -> ${door.target || door.examRoomId}`);
        const miniText = list(miniHosts, (npc) => `${MINI_GAMES[npc.miniGameId]?.title || npc.miniGameId} at ${npc.name} (${point(npc)})`);
        const triggerText = list(miniTriggerProps, (prop) => `${MINI_GAMES[prop.miniGameId]?.title || prop.miniGameId} ${prop.type} (${point(prop)})`);
        const signText = list(signsForLocation, (sign) => `${sign.title} (${point(sign)})`);
        const propText = propsForLocation.length ? `${propsForLocation.length} prop(s)` : "-";
        const landmark = visual ? `${visual.landmark} / ${visual.object}` : "-";
        const gate = location.next ? `${location.travel} -> ${WORLD[location.next]?.name || location.next}` : location.travel;
        const blocked = blockedZoneSummary(layout);
        zoneSketches.push(zoneSketch(location, layout, visual, doors, miniHosts, MINI_GAMES));
        return [location.name, point(layout.spawn), landmark, npcText, doorText, miniText, triggerText, signText, propText, gate, blocked, regionNotes(locationId, location, layout, doors, miniHosts, signsForLocation, propsForLocation, visual)];
    });

    const interiorRows = Object.entries(STUDY_STATIONS).map(([locationId, stations]) => {
        const location = WORLD[locationId];
        const layout = WORLD_LAYOUTS[locationId];
        const exit = INTERIOR_EXITS[locationId];
        return [location?.name || locationId, point(layout?.spawn), list(stations, (station) => `${station.label} (${point(station)})`), exit ? `${point(exit)} -> ${exit.target}` : "-"];
    });

    const examRows = EXAM_PRACTICE_ROOMS.map((room) => [room.title, room.label, point(room), room.question]);

    const lines = [
        "# Map Audit",
        "",
        "Generated from current `game.js` world data for Map Phase 1. Use this before recomposing regions so movement, NPC roles, building doors, mini-game hosts, and travel gates stay understandable.",
        "",
        "## Exterior Locations",
        "",
        "| Location | Spawn | Main Landmark | NPC Positions | Building Doors | Mini-game Anchor | Mini-game Trigger Props | Signs | Props | Travel Gate | Blocked Zones | Audit Notes |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ...exteriorRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
        "",
        "## Region Zone Sketches",
        "",
        "```json",
        JSON.stringify(zoneSketches, null, 2),
        "```",
        "",
        "## Interior Study Routes",
        "",
        "| Interior | Spawn | Study Stations | Exit |",
        "| --- | --- | --- | --- |",
        ...interiorRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
        "",
        "## Exam Hall Practice Rooms",
        "",
        "| Room | Skill | Position | Question Focus |",
        "| --- | --- | --- | --- |",
        ...examRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
        "",
        "## Map Phase 1 Findings",
        "",
        "- The current maps pass automated reachability checks for spawn, NPCs, building doors, study stations, mini-game hosts, and Exam Hall practice rooms.",
        "- Trigger props now use small PNG runtime assets from `assets/props/region/`, with SVG source assets and canvas primitive fallback.",
        "- Travel gates are currently opened from NPC menus rather than represented by dedicated world props; Map Phase 2/3 should decide whether to add visible gate props per region.",
        "- Mini-game host markers now render dynamic status labels from `state.miniGameScores`: New, Try, Bronze, Silver, or Gold.",
        "- Most non-Village exterior regions still have no standalone signpost/prop records in `signs` or `props`, so their landmarks are mostly building silhouettes and canvas motif drawing rather than auditable map objects.",
        "- The next recomposition pass should improve route clarity one region at a time: spawn -> landmark -> NPC cluster -> building/interior -> mini-game host -> travel gate.",
        "",
        "## Next Pass Checklist",
        "",
        "- Add or move a small number of landmark/signpost props per region before broad decoration.",
        "- Keep mini-game hosts near a thematic visual anchor without overlapping door interaction zones.",
        "- Add visible public travel-gate props after deciding whether fast travel/world map belongs in the same release.",
        "- Re-run `node scripts\\validate-world.js` and `node qa-visual-smoke.mjs` after any map movement."
    ];

    return `${lines.join("\n")}\n`;
}

const markdown = buildMarkdown();
if (process.argv.includes("--write")) {
    fs.writeFileSync(outputPath, markdown, "utf8");
    console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
} else {
    process.stdout.write(markdown);
}
