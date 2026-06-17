# Gameplay Progress Log

This document records what changed at each implementation step while we work through `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-12 — Spaced review queue ("come back and revise") (§G8 / §7 — final G8 item)

Plan area: §7 — a light spaced-repetition layer so students are nudged to revisit topics they have already completed, closing the last open G8 item.

What changed:
- New persisted `reviewLog` ({ [questId]: { reps, dueMs } }); **SAVE_VERSION bumped 6 → 7** with a migration that defaults `reviewLog` to `{}` for older saves (verified: validate-ui now reports "save migration to v7"). Added to default state, `serializeGame`, `loadGame`, and `resetGame`.
- Completing a quest schedules its first review (`scheduleReview` in `completeQuest`). "Mark reviewed" pushes the next due date out on a 1 → 2 → 4 → 8 day ladder (`REVIEW_INTERVAL_DAYS`, capped). A topic is "due" when its `dueMs` has passed, or when it has no log entry yet (so quests completed on a pre-v7 save still surface for review).
- Revision Journal upgraded: a gold "Come back and revise (N)" queue lists due topics (most overdue first); opening a due topic shows a "Mark reviewed" button; non-due quests show "Next review in about N days"; when nothing is due it shows a green "All caught up" card. Helpers `dueReviewTopics`, `reviewNextDueText`, `markReviewed`; `data-review-done` handler added to the choice-panel click listener.
- CSS: `.review-due` (gold call-out, `.is-clear` green variant), `.review-due-list`, `.review-next-due`.
- No quest/route/world change. Bumped cache-bust to `2026.06.12.13` and deployed live.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (7 locations, 45 quests)
- `node scripts\validate-ui.js` (save migration to v7; render smoke pass)
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests — `scheduleReview` on quest completion does not affect progression)
- Live browser check: a freshly completed quest schedules a future review (not due); a completed quest with no log entry and an overdue one both appear in the due queue; "Mark reviewed" removes a topic from the queue and advances its interval (reps 1 → 2, due moves 1 → 2 days); screenshot confirmed the queue + Mark reviewed UI.

## 2026-06-12 — Hero outfit now recolours in the world (customisation fix)

Plan area: §3.2 hero customisation — the chosen start preset/outfit barely changed the in-world hero, so it looked the same regardless of choice.

What changed:
- Root cause: the base hero spritesheet has a fixed blue jumper baked in. The world overlays only repainted hair colour, cap, accent scarf and shoes (small areas); the torso/clothing colour was never applied, so the biggest visual element never changed. (The profile itself flows correctly: custom screen → `startGameNew` → `resetGame` → `state.profile` + `state.equipped.outfit`, and `heroVisual()` reads it.)
- Added `drawHeroOutfit(p, bob, visual)`: repaints the torso (below the neck, above the belt) in the chosen outfit colour with a light/dark two-tone, in all four facings, matching the fallback sprite footprints. Called first in `drawHeroProfileMarkers` so hair, cap, scarf and arm overlays layer on top.
- `drawHeroSideArm` now uses the outfit colour for the sleeve (was a hardcoded blue), so the side view matches.
- Outfit colours are distinct per preset (school blue, campaign green, council red-brown, liberty steel-blue), so the four start choices now look clearly different in the world as well as in the portrait.
- No save-schema, quest, route, or world change. Bumped cache-bust to `2026.06.12.12` and deployed live.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js` (11 mini-games; render smoke pass)
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- Live browser check: deterministic rect-capture confirmed the outfit colour is now drawn for every preset in the down/right/up facings (schoolJumper #2f638f, campaignBoots #3f7d4f, councilCloak #8f4f44, libertyCoat #466d9f).

## 2026-06-12 — Curriculum mastery tracking (§G8 / §7 learning depth)

Plan area: §7 — turn the Curriculum tab from a flat "links complete" percentage into a real per-topic mastery view that shows how secure each GCSE topic is.

What changed:
- New mastery model (4 tiers: To start → Learning → Secure → Mastered) derived ONLY from already-persisted signals — completed quests + the area's mini-game medals + study stations — so there is NO save-schema change. A topic needs its quest completed to leave "To start"; doing the area's mini-games and study stations then lifts every completed topic in that area Learning → Secure → Mastered. Tutorial-style areas with no extra practice (Core Citizenship) reach Mastered on quest completion.
- Helpers `areaReinforcementRatio`, `topicMasteryLevel`, `curriculumNextAction`, and `MASTERY_TIERS` added near `curriculumAreaSummary`.
- `renderProgressCurriculum` rewritten: a top "Curriculum mastery: X%" card with a count summary (mastered/secure/learning/to start) and a colour legend, then per-area cards each showing an area mastery %, a bar, a per-topic list with a coloured mastery pill, and a "Next" hint (complete a quest, or finish the area's mini-games/stations to reach mastered).
- CSS: `.mastery-list`, `.mastery-topic`, `.mastery-pill` (is-none/is-learning/is-secure/is-mastered) colour-coded pills + `.mastery-legend`.
- No quest data, route, world, or save-schema change. Bumped cache-bust to `2026.06.12.11` and deployed live.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (7 locations, 45 quests)
- `node scripts\validate-ui.js` (curriculum render smoke passes; 11 mini-games)
- Live browser check: with a fresh save the tab shows 0% / "45 to start"; completing a Modern Britain quest moved that topic To start → Learning, adding the sourceDetective medal → Secure, and finishing the library study stations → Mastered (area 20%, overall 2%); screenshot confirmed the colour-coded pills and legend.

## 2026-06-12 — Quest "Why this matters" explanation block (§G8 / §7 learning depth)

Plan area: §7 — after answering a regional quest, surface the full curriculum explanation as a clear, separate teaching block instead of a single feedback line blended with the reward.

What changed:
- `renderNpcWindow` and `showDialogue` gained an optional `explain` argument; when present they render a styled `.npc-explain` block ("Why this matters" + the explanation paragraph) inside the dialogue window.
- New helper `questWhyExplanation(quest)` returns the curriculum answer + note (`quest.curriculum.correctAnswer` + `note`), falling back to `quest.clue` for quests not mapped in the curriculum guide.
- `completeQuest` now shows the reward line in the main body and the full curriculum explanation in the dedicated block (previously the explanation was concatenated into the feedback string and easy to miss). `answerQuest` (wrong answer) now also shows the same explanation block so a mistake becomes a teaching moment.
- CSS: `.npc-explain` is a gold-accented call-out (left border, tinted background, uppercase heading) that reads clearly in the dialogue and on mobile.
- Banners reminder: the earlier magical-title banner work shipped at v.8.
- No quest data, route, world, or save-schema change. Bumped cache-bust to `2026.06.12.9` and deployed live.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (7 locations, 45 quests)
- `node scripts\validate-ui.js` (11 mini-games; render smoke pass)
- Live browser check: `questWhyExplanation` returns the full curriculum text (e.g. mayorVote, 326 chars) and `showDialogue(..., explain)` renders the "Why this matters" block; screenshot confirmed reward line + gold explanation call-out.

## 2026-06-12 — Spark Sorter (real-time sort-into-buckets mini-game, §G8)

Plan area: §G8 / §6 — a second graphically distinct, non-MCQ mini-game introducing a new "sort into categories" mechanic, reusing the Keyword Catcher arcade engine.

What changed:
- New `MINI_GAMES.sparkSorter` (`type: "sorter"`, region "Rights & Law", hub-only — not linked to a regional NPC, so route/quest QA still finds 8 hosts / 7 regional games). 5 rounds: each is a short case (e.g. "Shoplifting", "Contract dispute") that the player must classify as **Criminal law** or **Civil law**, with a "why" explanation. Each round carries `prompt`/`card`/`choices`/`correct`/`explain` so it satisfies the `validate-ui` round contract and doubles as a plain multiple-choice round.
- New mechanic on the shared real-time engine: one case card falls from the top of a `<canvas>`; the player steers it left/right (arrow keys, A/D, or pointer drag) into one of two labelled buckets at the bottom. Landing over the correct bucket scores the round. One card per round (no lives). Same 10-second read/countdown phase as Keyword Catcher (with a "Start now" button), so the player can read the case before it falls.
- **Accessibility**: under Reduced Motion the round renders as the standard static multiple-choice panel (no canvas). Movement of the hero stays paused while the mini-game panel is open.
- Art: scene banner `assets/minigames/sparkSorter.svg` (sorting bench with two buckets) + shared `.sorter-canvas` CSS. Scoring, medal, save and the hub listing reuse the existing pipeline.
- No quest, route, world, or save-schema change. Bumped cache-bust to `2026.06.12.7` and deployed live.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (7 locations, 45 quests)
- `node scripts\validate-ui.js` (now 11 mini-games; round contract + render smoke pass)
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Live browser end-to-end check: steering a criminal case left scores, a civil case right scores, the wrong side scores nothing, and the Reduced-Motion fallback renders multiple-choice buttons with no canvas.

## 2026-06-12 — Keyword Catcher (real-time falling-word mini-game, §G8)

Plan area: §G8 / §6 — add a graphically distinct, non-MCQ mini-game that practises civic vocabulary as an arcade catch game, while keeping it accessible.

What changed:
- New `MINI_GAMES.keywordCatcher` (`type: "catcher"`, region "Citizenship Village", hub-only — not linked to a regional NPC, so the route/quest QA still finds exactly 8 hosts / 7 regional games). 5 rounds, each a clue + civic keyword choices (Democracy, Accountability, Devolution, Petition, Rule of law) with plausible distractors and a "why" explanation. Because each round carries `prompt`/`choices`/`correct`/`explain`, it satisfies the `validate-ui` round contract and doubles as a normal multiple-choice round.
- First **real-time** mini-game: keyword tiles fall from the top of a `<canvas>`; the player slides a basket (arrow keys / A-D or pointer drag) to catch the tile that matches the clue and avoid distractors. Catching the correct term scores the round; a wrong catch costs one of three catches; running out shows the answer with no point. Fall speed and spawn rate ramp gently per clue, and the correct term is guaranteed to appear at least every third tile so a round is always winnable. Driven by `updateMiniGameCatcher(frameDeltaMs)` in `loop()`.
- **Accessibility**: under Reduced Motion the same round data renders as the standard static multiple-choice panel (no animation, no canvas), reusing `answerMiniGame`/`advanceMiniGame`. `movePlayer()` now also pauses while the mini-game panel is open so the catcher's arrow keys do not drive the hidden hero.
- Art: illustrated scene banner `assets/minigames/keywordCatcher.svg` (keyword sky + falling tiles + basket) + CSS for the banner and the `.catcher-canvas` (responsive, touch-action none). Scoring, medal, save (`miniGameScores`) and the mini-game hub listing reuse the existing pipeline.
- No quest, route, world, or save-schema change. Bumped cache-bust to `2026.06.12.3` and deployed to the live site.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (7 locations, 45 quests)
- `node scripts\validate-ui.js` (now 10 mini-games; round contract + render smoke pass)
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games — catcher correctly hub-only)
- Live browser end-to-end check: opened Keyword Catcher, confirmed the canvas renders falling tiles + basket, a correct catch scores and shows "Correct", a wrong catch reduces catches left, and the Reduced-Motion fallback renders multiple-choice buttons with no canvas.

## 2026-06-08 — Terrain tile art upgrade (roads/water/bridges/greenery)

Plan area: §3.1 terrain quality — lift the background tiles toward the reference screenshots, license-clean (self-authored SVG, no third-party art).

What changed (all via the existing asset pipeline + procedural fallback — zero engine changes):
- **tile-grass.svg** — richer lush grass: layered tonal mottling + multi-tone blade tufts; removed the per-tile baked flowers (they repeated on a grid). Sparse flowers still come from `drawTileVariation`/`drawFineDetails`.
- **tile-road.svg** — proper dirt path: warm soil base, worn lighter patches, darker soil mottle, soil specks, and embedded pebbles with highlight+shadow.
- **tile-plaza.svg** — beveled cobblestone: a 2×2 grid of rounded stones with top-left highlight, bottom-right shadow, dark mortar grid (reads 3D, tiles seamlessly).
- **tile-water.svg** — added depth (layered darker bands), two ripple bands, and sparkle highlights.
- **tile-dock.svg** — wooden boardwalk/bridge: three horizontal planks with top highlight, bottom shadow, dark gap lines, wood grain, and nail-head joists.
- **`drawTreeTile`** — lusher tree: 5-layer canopy with darker underside + top-left rim light, textured leaf clumps, shaded bark, softer drop shadow.
- All tiles stay 32×32 `crispEdges` pixel-art so the autotiling overlays (foam, beach, paving tufts) still layer correctly on top. No map, collision, route, quest or save change.
- Bumped cache-bust to `2026.06.08.15`.

Validation:
- `node --check game.js`; all 6 tile SVGs validated as well-formed XML
- `node scripts\validate-world.js` (tile assets present)
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- Review screenshots (temporary) of village (grass/cobble/dirt road + transitions), harbour (water + wooden boardwalk + foam), and Action Workshop (cobblestone) confirmed the quality jump, then removed.

## 2026-06-08 — Region pets (wandering animal + sounds/jokes)

Plan area: ambience/fun — one decorative animal per location that wanders and occasionally "speaks".

What changed:
- Added a single `regionPet` per location (`REGION_PET_KIND`: village/democracy = dog, modernBritain/actionWorkshop = cat, rightsLaw/examHall = owl, participation = duck). Like ambient walkers it is decorative-only: separate from `npcs`, NOT solid to the player, not saved, rebuilt on every `setLocation` via `spawnRegionPet()` (spawns on reachable grass/road/plaza away from the player spawn).
- `updateRegionPet(dt)` (in `loop()`): eased wander within ~70px of its home with `isBlocked` collision and pauses; gated by Reduced Motion (pet stands still and stays silent).
- Speaking: most of the time the pet makes its animal sound (`PET_SOUNDS`: Woof/Meow/Quack/Hoot etc.); rarely (~17% of the time it speaks) it tells a short, neutral, school-safe Citizenship pun from `PET_JOKES`. The jokes are deliberately abstract civic wordplay (voting, law, petitions, rights, councils, debate, sources, community) with **no** politics, parties, religion, ethnicity, or any group reference — checked for being age-appropriate and inoffensive.
- New 4 tiny pixel animal sprites (`drawPetDog/Cat/Duck/Owl`) with a 2-frame walk and left/right mirroring; z-sorted with NPCs/walkers/player in `drawCharacterLayer`.
- Reused the speech-bubble renderer: generalised `wrapChatterText`/`drawNpcSpeechBubble` to take per-bubble `ttl` + `maxLines` (jokes get 3 lines / 4.8s, sounds 1 line / 1.7s). Bubbles hide during dialogue/question and under Reduced Motion, like NPC chatter.
- Pure render + timer; no map, route, quest, collision or save-schema change.
- Bumped cache-bust to `2026.06.08.13`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 games — pet doesn't affect reachability)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Temporary review captured each region's animal (dog/cat/owl/duck) with a sound and a joke bubble, then removed.

## 2026-06-08 — Detailed NPC Talk text

Plan area: §7 learning depth / dialogue — give each NPC a proper self-introduction in the Talk menu.

What changed:
- Added an `NPC_TALK` map (keyed by NPC id) with a 3-sentence introduction for every NPC id that appears in the world (35 ids = 31 unique characters + the 4 recurring ids campaignPriya2/justiceRowan2/plannerNoor2/examMira2). Each line says who they are, what their civic role/topic is, and how they can help the player, written to stay consistent with the scenario (the Apathy Shade dims civic life; each NPC guards one GCSE Citizenship theme) and the character details in `docs/NPC_CHARACTER_GUIDE.md`. Content is accurate and age-appropriate.
- The Talk menu action now shows `NPC_TALK[npc.id] || npc.intro`. The short `npc.intro` is deliberately kept unchanged because `avatarRole()` keyword-matches on it for procedural portraits/world bodies — so portraits and role kits are unaffected.
- Recurring NPCs reference their current region (e.g. Priya at the harbour, Rowan in his court, Noor at the workshop, Mira in the Exam Hall) so the text fits where the player meets them.
- Dialogue layout unchanged: `.npc-copy` already scrolls (`overflow:auto`), so the longer text fits on desktop and mobile.
- No map, route, quest, mini-game or save-schema change. Bumped cache-bust to `2026.06.08.12`.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js`, `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0` — mobile overflow OK)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 games — NPC menu path intact)
- Talk dialogue screenshots (desktop Noor/Mayor, mobile Farah) confirmed the full text renders with the portrait and fits/scrolls; then removed.

## 2026-06-08 — Action Workshop + Exam Hall declutter

Plan area: map readability — same cleanup applied to the last two crowded regions.

What changed:
- **Action Workshop**: spread the 5 NPCs along the central avenue / building fronts (Noor/Tess/Jules across the top road, Kai on the plaza, Mira by the SE town hall); separated the overlapping `surveyBox`+`dataCards` and moved `planningBoard`/`campaignTable` apart; repositioned the 4 signs; moved the `drawFineDetails` Tools stall + DATA kiosk + planning-board landmark visuals so they no longer overlap (renamed the floating label "Plan Board" → "Workshop Yard" onto open ground); moved the apathy trace.
- **Exam Hall**: moved the 5 NPCs off the central practice-desk grid onto the 5 exam building fronts (Mira/Ash top, Nia/Leon bottom, Pip west) so they no longer stand on desks; moved the `examDesk`/`debateBench`/`sourceArchive` props out of the desk cluster; repositioned the 4 signs; deleted the gold decoration squares + accent lines that were drawn directly over the practice desks and nudged the "Exam Gate" label clear. The 5 `EXAM_PRACTICE_ROOMS` desks keep their positions and stay reachable.
- Only these two regions changed; building rects/doors, exam-room data, save schema and quest/mini-game data untouched.
- Bumped cache-bust to `2026.06.08.11`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (reachability of NPCs/doors/gates/mini-game triggers/exam rooms, NPC↔door ≥76px, no overlaps — pass)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 games)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Before/after review screenshots (6 framings each) confirmed spread NPCs, separated props, clear practice desks, and fixed labels/decor; then removed.

## 2026-06-08 — Participation Harbour declutter + road structure

Plan area: map readability — same cleanup as Rights & Law, applied to Participation Harbour.

Problems fixed:
- The left side piled up the petition stand, Priya, a Leaflets market stall and two labels (Petition Hub + Petitions sign) with two NPCs on top; the "Signal Hub" building label sat on the press building with an NPC under it; banners/crates/boats were scattered and buildings weren't linked by paths inside the harbour wall.

What changed:
- Reshaped the inner harbour plaza in `WORLD_LAYOUTS.participation.map`: a compact central **Harbour Square** (a 6-wide plaza, rows 10–12) plus short connector paths to the press building (centre), the east gate dock and the SW garden — instead of two stray plaza patches. Harbour water ring, dock and building rects/doors unchanged, so `isHarborWater`, `BUILDING_DOORS` and door sides stay intact.
- Spread the 5 NPCs: Priya top-left by the petition pier, Pax on the plaza, Morgan on the west walk, Rae by the Leaflets stall (top-right), Amina by the Volunteer garden — all clear of doors (≥76px), props and building labels.
- Moved props so nothing overlaps: petition stand (mini-game trigger) on the NW approach, gate boat moored at the east dock, banner top-centre, crate by the press building.
- Repositioned the 4 signs, moved the Apathy-trace to a free top spot, and relocated the `drawFineDetails` boats/Leaflets stall/landmark label (renamed "Petition Hub" → "Harbour Square" onto the new plaza).
- Only the Participation region changed; no other maps, no save schema, no quest/mini-game data.
- Bumped cache-bust to `2026.06.08.10`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (reachability + NPC↔door ≥76px + no NPC/label/prop overlaps — pass; caught and fixed one Volunteer-label/charityAmina overlap)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 games — petitionRegatta host reachable)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Before/after review screenshots from 5 framings confirmed the plaza, spread NPCs, clear Signal Hub label, and east-dock gate boat; then removed.

## 2026-06-08 — Rights & Law Quarter declutter + road structure

Plan area: map readability (§3.1 reachability invariant) — the Rights & Law region was cluttered with overlapping objects and had no coherent road structure.

Problems fixed:
- The old plaza was a broken "plus" with a 1-tile horizontal link; buildings floated in grass and the Police station had no road to it. Scales, the "Court Square" sign, a bench and a floating gold civic-crest all stacked in the centre with three NPCs on top of each other; the left corner stacked three markers (Archive sign + Play + Game). A decorative colonnade + gold cross drawn by `drawFineDetails` sat over the old plaza.

What changed:
- Redesigned `WORLD_LAYOUTS.rightsLaw.map`: one readable central **Court Square** plaza (rows 7–11), a horizontal **avenue** (row 12) linking the Archive (left) to the right Court, and a **spur road** (rows 13–15) down to the Police station so it is no longer an island. ASCII map only — building rects/doors unchanged, so `BUILDING_DOORS` and door sides are intact.
- Spread the 5 NPCs around the square, each near its building and clear of doors (≥76px) and props: Farah by the Rights/Archive side, Rowan + Chen by the right court, Ellis on the plaza, Blake by the Police spur.
- Moved props so nothing overlaps: scales = plaza centrepiece (478,298), rights `notice` mini-game trigger on the plaza approach (320,322), bench to the SW lawn, lamp by the Police spur.
- Repositioned the 3 signs (renamed the central one to "Quarter Map" so it doesn't duplicate the landmark label), moved the Apathy-trace to a free top-left spot, and moved the floating "Court Square" `drawWorldLabel` onto the new plaza while deleting the now-misplaced colonnade/cross/accent-line decorations.
- Only the Rights & Law region changed; no other maps, no save schema, no quest/mini-game data.
- Bumped cache-bust to `2026.06.08.9`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js` (reachability of doors/NPCs/gate/mini-game trigger, NPC↔door ≥76px, no NPC/label/prop overlaps — all pass)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 games — rightsMatch host reachable)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Before/after review screenshots (temporary script) from 5 framings confirmed the plaza, avenue, police spur, spread NPCs, and that the floating crest/colonnade are gone; then removed.

## 2026-06-08 — NPC chatter pool expansion

Plan area: §3.3 — broaden the on-topic NPC speech-bubble phrase pool.

What changed:
- Roughly doubled `NPC_CHATTER` (5 → ~12 lines per region) using accurate GCSE content drawn from each region's quest topics: Modern Britain (identity, diversity, free press, migration, NGOs), Rights & Law (rule of law, civil vs criminal, rights limits, police safeguards, rehabilitation, due process), Democracy (manifestos, scrutiny, FPTP, constituencies, accountability), Participation (pressure groups, unions, petitions, lawful protest, fact-checking), Action Workshop (issue/research/plan/impact/evaluate), Exam Hall (command words, PEEL, source judging, timing). Village and `NPC_CHATTER_DEFAULT` also expanded.
- Data-only change to existing string arrays — no logic, render, save, route or schema change. Longest new lines wrap to ≤2 lines as before.
- Bumped cache-bust to `2026.06.08.8`.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- Temporary capture confirmed the longest new phrases (e.g. "Judge a source's origin and purpose.") wrap cleanly above the head, then removed.

## 2026-06-08 — NPC speech bubbles (on-topic chatter, §G3 follow-up)

Plan area: §3.3 — periodic NPC speech bubbles with short, on-topic GCSE Citizenship lines to make regions feel alive and reinforce learning.

What changed:
- Added an editable `NPC_CHATTER` phrase pool, keyed by region (village / modernBritain / rightsLaw / democracy / participation / actionWorkshop / examHall), with short accurate civic lines (e.g. Rights & Law: "No one is above the law.", Democracy: "Your vote counts."). `NPC_CHATTER_DEFAULT` covers anything else.
- `updateNpcChatter(dt)` (called from `loop()`): a per-entity timer gives each eligible character a bubble occasionally, then clears it after `CHATTER_TTL_MS` (3.2s) and schedules the next one 7–13s later. At most `CHATTER_MAX_ACTIVE` (2) bubbles show at once, and phases are staggered so they never all talk together.
- Eligibility keeps functional markers clean: **ambient walkers** chatter only while paused; **interactive NPCs** chatter only once their quest is done (`state.completed`) and never if they host a mini-game — so a bubble never competes with a quest "!" or the blue Game marker.
- `drawNpcSpeechBubbles` / `drawNpcSpeechBubble` render a small rounded parchment bubble with a downward tail above the head (cleared of the face), fade in/out, word-wrapped to ≤2 lines with an ellipsis (`wrapChatterText`, `chatterRoundRect`). Drawn in the character layer.
- Fully gated: hidden during dialogue/question/choice panels and under Reduced Motion (bubbles cleared, timers idle). Pure render + timer — no save schema, collisions, routes or reachability touched; `bubble`/`nextChatterMs` are transient runtime fields only.
- Bumped cache-bust to `2026.06.08.7`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Temporary review script forced region-appropriate bubbles on NPCs + a walker in Rights & Law and Democracy (incl. a 2-line wrapped line) and confirmed they sit above the head with a tail, clear of faces; then removed.

## 2026-06-08 — Atmosphere & polish: transitions, footstep dust, interaction pulse (§G9)

Plan area: §G9 — add the remaining "feel" polish (region transitions, footstep/interaction feedback) on top of the Option A atmosphere already in place (particles, vignette, chimney smoke).

What changed:
- **Region transition fade**: `setLocation` starts a short `regionTransitionMs` (440ms) when the player actually moves between locations; `drawRegionTransition` (in `drawScreenUi`) eases a dark screen-space veil out to clear. Skipped on first load, when staying in the same location, and under Reduced Motion (the timer never starts).
- **Footstep dust**: `spawnFootstepDust` (called from `movePlayer` while moving) drops a small pale puff under the hero's feet every few steps; `updateFootstepDust(dt)` ages them and `drawFootstepDust` (in `drawAmbientLayer`, under the characters) fades + expands them. Capped at 24 puffs, fully Reduced-Motion gated, cleared on location change.
- **Interaction pulse**: `drawInteractionRangeHighlight` now adds a gentle expanding ring around the in-range interactable (gold for NPC/door, blue for mini-game host), so the current target reads more clearly. Static ellipse retained; the pulse is Reduced-Motion gated.
- All effects are pure render/timing on the existing delta-time clock — no map, route, quest, collision or save-schema change; walkers/quests/doors untouched.
- Bumped cache-bust to `2026.06.08.6`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games — `setLocation`/`movePlayer` changes don't affect reachability)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Temporary review script captured footstep dust, mid-fade transition, and the interaction pulse ring, then removed.

## 2026-06-08 — Learning variety: two Hangman-style word games (§G8, first pass)

Plan area: §G8 / §6.4 — add two GCSE-adapted "word reveal" mini-games that practise civic vocabulary and end with a comprehension check, not just guessing.

What changed:
- Two new mini-games in `MINI_GAMES` with `type: "wordReveal"`: **Keyword Rescue** (Citizenship Village — democracy/accountability/representation/devolution/parliament) and **Caseword Court** (Rights & Law — jury/evidence/appeal/human rights/rule of law). Each round has `word`, a thematic `hint`, plus `prompt`/`choices`/`correct`/`explain` (so it also satisfies the `validate-ui` round contract).
- New flow: the player reveals the term letter by letter on a civic letter board (A–Z keyboard, hits go green, misses fill a themed meter, max 6 misses), then **must pick the correct meaning** before the round scores. A round only earns a point when the word was solved AND the definition is correct (per the plan's "not complete until understanding is shown" rule). Multi-word phrases like "RULE OF LAW" reveal across word gaps.
- Reused the existing mini-game infrastructure: hub listing (`renderProgressMiniGames`), scoring, medal screen, save (`miniGameScores`), and the §G7 banner system. Added `renderWordRevealPanel`, `guessLetter`, `answerWordDefinition`, `makeWordRevealRound`; branched `openMiniGame`/`renderMiniGamePanel`/`advanceMiniGame` on `type`; added `data-minigame-letter` / `data-minigame-define` handlers.
- Two illustrated SVG banners (`assets/minigames/keywordRescue.svg` civic word board + spark meter; `assets/minigames/casewordCourt.svg` evidence board + scales) + their CSS.
- The two games are **hub-only** (no regional NPC host), so the route/quest QA (which expects exactly 7 regional hosts) is unaffected; they appear in the Progress → Mini-games hub.
- No quest, route, world, or save-schema change. Bumped cache-bust to `2026.06.08.5`.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js` (now 9 mini-games; round contract satisfied)
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games — new games correctly NOT regional hosts)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`)
- Temporary playthrough script drove both word games to a saved gold 5/5 and captured guess/define/medal screenshots (incl. multi-word "RULE OF LAW"), then removed.

## 2026-06-08 — Mini-game graphics: scene banners + medal (§G7, first pass)

Plan area: §G7 — replace the abstract CSS box-shadow props in each mini-game with real illustrated scene art, and turn the medal mark into a proper medal.

What changed:
- 7 illustrated SVG scene banners in `assets/minigames/` (one per game): Source Detective (newsroom desk: newspaper, magnifier, reliable check + unreliable cross stamps), Rights vs Responsibilities (balance scales: RIGHTS vs DUTIES pans), Petition Regatta (harbour: campaign boat with SIGN sail, dock, signature buoy, rumour hazard), Ballot Count (blue ballot box + tally sheet + winner star), Debate Arena (two podiums + Argument/Evidence/Rebuttal cards + rosette), Campaign Planner (Research→Plan→Action→Evaluate board with arrows), Exam Simulation (GCSE paper + Source A card + clock + pencil).
- `renderMiniGameVisual` now renders a `.minigame-banner` layer; per-game CSS sets the SVG as `background: cover`. The banner has a flat dark fallback colour, so a missing SVG shows a clean themed panel rather than a broken image. Concept-label chips (e.g. Source/Evidence/Stamp) and the cue/round text sit above the banner.
- Abstract fallback props (`.minigame-stage-prop`) are now hidden (the banner replaces them); neutralised the legacy `.minigame-visual-<id> span:nth-child()` rules that were deforming the concept-label chips.
- Medal mark upgraded to a real medal: metallic radial-gradient disc (gold/silver/bronze/practice via existing `.medal-*` classes) + a star (mask of new `assets/ui/icons/ico-medal.svg`) + two civic ribbon tails, with a `medalPop` reveal animation (disabled under Reduced Motion via the global override).
- No JS handler, quest, route or save-schema changes — purely the visual layer of the mini-game panel.
- Bumped cache-bust to `2026.06.08.4`.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js` (mini-game render smoke still finds `minigame-visual`)
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots — desktop + mobile mini-game reviewed)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games — every mini-game still launches/plays via real NPC buttons)
- Per-game banner + medal review screenshots (temporary script) for all 7 games + gold/exam medals, then removed.

## 2026-06-08 — HUD / menus / inventory / Character polish (§G6)

Plan area: §G6 — lift the HUD, menu frames, inventory and Character panel from "prototype UI" to a cohesive themed look, while keeping every handler and `validate-ui` smoke intact.

What changed:
- New lightweight icon system: 9 mask-based SVG icons in `assets/ui/icons/` (book, focus, xp/star, target, coin, pin, speech, heart, shield). The `.ico` class uses `mask` + `background-color: currentColor`, so each icon inherits its colour from CSS — no per-icon PNGs, no JS.
- HUD meters are now colour-coded and icon-led: Knowledge = blue book, Focus = green spark, XP = gold star, Exam Readiness = orange target. Each `.meter` bar gets a matching gradient (was one shared green→gold gradient for all four). Region (pin) and Coins (coin) chips also gained icons.
- Menu panels share an "art frame": a gold top accent strip + subtle gradient on `.menu-panel-header`, applied to Backpack, Progress, Character, Mini-game and Settings headers.
- Character panel: each stat card shows its icon (book/speech/heart/shield) and a per-stat coloured progress bar; the Exam Readiness summary tile is highlighted with a gold frame. Added `STAT_ICONS` map; `renderCharacterPanel` adds `card-<stat>` classes and a `summary-readiness` class.
- All changes are CSS/markup only over existing elements — no new buttons (static-button check stays green), no JS handler changes, no save-schema change. Mobile layout verified.
- Bumped cache-bust to `2026.06.08.3`.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js` (render smoke incl. Readiness formula, save migration v6)
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots — desktop + mobile HUD, Character, inventory, settings reviewed)

## 2026-06-08 — Interiors by purpose (§G5)

Plan area: §G5 — make a building's interior reflect the specific civic place the player walked into, instead of one of four generic shared rooms.

What changed:
- The four interior locations still share one floor plan (`studyInteriorMap`), but the visible room is now themed by the building the player entered. `state.lastDoorReturn.label` already records that building and is persisted in the save, so no new save field is needed.
- New `currentInteriorTheme()` resolves a theme from the entered building's label via `interiorThemeFromLabel()` (keyword regex) with a per-location default (`INTERIOR_DEFAULT_THEME`). Themes: council, library, court, garden (existing art, extracted into named functions) plus three new ones — press/newsroom, police station, campaign workshop.
- `drawInteriorDecor()` is now a thin dispatcher to `drawCouncilInterior` / `drawLibraryInterior` / `drawCourtInterior` / `drawGardenInterior` / `drawPressInterior` / `drawPoliceInterior` / `drawCampaignInterior`.
- New decors: press = headline board + printing press + newspaper racks + fact-check desk; police = chequered fascia + reception desk + evidence board + barred window (age-appropriate); campaign = bunting + planning boards + survey table + ballot/petition box.
- New `drawInteriorPlaque(theme)` renders a small wall plaque naming the entered building, high on the back wall and clear of the study stations.
- HUD now shows the entered building name inside interiors via `currentRegionDisplayName()` (e.g. "Printworks" instead of "Library Interior"), so the HUD and the plaque agree.
- All decor draws UNDER the study stations and exit (which render on top), so reachability/visibility of stations, exit and doors is unchanged. Maps, doors, `BUILDING_DOORS`, `STUDY_STATIONS`, `INTERIOR_EXITS` and the save schema are untouched.
- Bumped cache-bust to `2026.06.08.2`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests)
- Per-theme interior review screenshots (temporary script) for all 7 themes incl. exit + 4 study stations visible, then removed.

## 2026-06-08 — Building exteriors by purpose (§G4)

Plan area: §G4 — replace the single structural building with typed silhouettes so a building's purpose reads from its shape, not just its wall colour.

What changed:
- Added a `kind` field to every building record in `WORLD_LAYOUTS` (townhall / court / library / press / police / garden / campaign / exam), assigned by purpose. `drawBuildingLayer` passes `kind` through; `drawBuilding(…, kind)` falls back to `buildingKindFromLabel(label)` when a record has no `kind`, so nothing breaks if a future building omits it.
- New `drawBuildingRoof(kind, …)` renders a recognisable roofline per kind: town hall = clock tower + flag, court = stone pediment + gold finial, library = green tiled roof + book-row dormer, press/printworks = tall smoking chimney + flashing antenna, police = blue/white chequered band, garden = hedge roof + sunflower, exam = castellated battlements + shield window, campaign + generic = classic tiled gable (with bunting for campaign). Shared `drawBuildingRoofClassic` keeps the original chimney look for the fallback.
- New `drawBuildingEntrance(kind, …)` draws a purpose entrance group framing the (unchanged) door: town hall lamps + Union flag, court fluted columns + scales, library book cart, press news box, police blue lamp, garden flower planters, campaign rosette banner + poster, exam torch sconces. Falls back to the old `drawBuildingOrnaments` for generic.
- `drawChimneySmoke` is now kind-aware: only press (tall stack) and campaign/generic (corner chimney) emit smoke; the typed civic roofs no longer puff from a non-existent chimney.
- Door positions, sizes and `BUILDING_DOORS`/reachability are untouched — purely additive exterior art with a primitive fallback.
- Bumped cache-bust to `2026.06.08.1`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- `node qa-regional-playthrough.mjs` (`blockingIssues: 0`, 8 hosts, 7 unique games — door/host reachability intact)
- `node qa-regional-quests-playthrough.mjs` (`blockingIssues: 0`, 6 regions, 30 quests completed)
- Per-region exterior review screenshots (temporary script) for all 8 kinds, then removed.

## 2026-06-05 — NPC background life: ambient walkers (§G3)

Plan area: §G3 background life — make regions feel alive with walking villagers.

What changed:
- Added an `ambientWalkers` array, fully SEPARATE from the interactive `npcs` array, so ambient villagers never touch interaction ranges, quests, doors/gates, vendor/host anchors, routes or the save schema.
- `spawnAmbientWalkers()` (called from `setLocation`): seeds 3 walkers on reachable grass tiles only, away from the player spawn (>96px) and each other (>70px), never in interiors. Deterministic-ish placement via `hashNoise` + `isBlocked` rejection.
- `updateAmbientWalkers(dt)` (called from `loop()` with `frameDeltaMs`): delta-time wander — each walker eases toward a random target within ~56px of its home anchor, collides via `isBlocked`, pauses 0.7–3.4s on arrival, re-targets and turns to face travel. Gated by `settings.reducedMotion` (walkers stand still).
- `drawAmbientWalker()`: a plain villager in the new outlined+shaded style (no role kit, no quest marker), with a 4-frame leg cycle + head-bob; added to `drawCharacterLayer` and z-sorted by `y` with NPCs and the player.
- CRITICAL invariant: walkers are NOT solid to the player (player collision checks only tiles/buildings), so they can never block a path. Confirmed by route QA.
- Bumped cache-bust to `2026.06.05.12`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Movement check: 3 walkers spawned and moved 34–46px over 140 ticks with changing facings.
- `node qa-regional-playthrough.mjs` (8 hosts, 7 games, 0 blockers) and `node qa-regional-quests-playthrough.mjs` (6 regions, 30 quests completed, 0 blockers) — reachability and quest flow unchanged.

Next marker:
- §G3 complete. Next: §G4 building exteriors by purpose, or Option D (2.5D).

## 2026-06-05 — NPC world bodies: outline, shading + role kits (§G3)

Plan area: §G3 NPC recognisability — make world NPCs read by role, not just coat colour.

What changed:
- Added `shadeHex(hex, amt)` colour helper.
- Rewrote `drawPerson`: dark outline behind head/torso/arms, two-tone coat (light/shade edges), shirt in the NPC's primary colour, face shade, hair highlight, a soft elliptical contact shadow, and a cleaner gold “!” quest marker (`drawNpcQuestMarker`).
- Added `drawNpcRoleKit(p, role, style)` — a recognisable silhouette/prop per role: police custodian helmet, council gold chain, law collar-tabs + robe edges, democracy rosette, media press lanyard, book + glasses, data clipboard-with-bars, charity tabard, campaign cap + petition board, invigilator hi-vis vest + stopwatch, examiner mark-scheme + red pen, and a default scarf.
- Added an explicit `NPC_ROLE` map keyed by NPC id (from `docs/NPC_CHARACTER_GUIDE.md`) with `npcRole()` resolver (falls back to the keyword heuristic `avatarRole`). This fixes mis-roles from the old name heuristic (e.g. “Librarian” Sam was tagged law because his intro says “rights”; now correctly book).
- `npcStyle` now also returns coat/skin/hair shade tints. Removed the old name-keyed `drawNpcAccessory`.
- Pure-render change: NPC positions, interaction ranges, quests and save schema are untouched. Z-sorting by `y` was already present in `drawCharacterLayer`.
- Bumped cache-bust to `2026.06.05.11`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Captured NPC rows for village / Rights & Law / Democracy / Exam Hall — confirmed each NPC reads by role (police helmet, hi-vis + stopwatch, gold chain, rosette, petition board, book, tabard, mark scheme, collar tabs, data clipboard) and silhouettes vary within a region.

Next marker:
- §G3 background life: ambient walking NPCs (delta-time `updateNpcs`, patrol zones excluding doors/gates/spawn/study stations) with route QA; quest-givers/vendors/hosts stay anchored.

## 2026-06-05 — NPC portraits: atlas slicing + dialogue wiring (§G3 start)

Plan area: §G3 NPC recognisability — replace procedural dialogue avatars with real art.

What changed:
- Authored `docs/NPC_CHARACTER_GUIDE.md` (31 unique characters: id, name, role, look, recurring-id aliases, atlas spec) — the single source of truth for NPC art. Keep it in sync when changing NPCs.
- Received two art atlases in `assets/characters/portraits-src/` (NPC-1: 26 cards rows 9/9/8; NPC-2: 4 cards for the Exam Hall set). Note: `elderGrace` (#10) is missing from the supplied art — it falls back to the procedural avatar until drawn.
- Added `qa-slice-portraits.mjs`: a headless-Chrome card detector/slicer (no new npm deps). Detects card bounds via white gutters, crops a 256×256 head+shoulders square per card, paints over the number badge with the card background, and writes `assets/characters/portraits/<id>.png`. Mapping is by on-card caption order (badge numbers are unreliable). Sliced 30 portraits.
- Wired portraits into dialogue: `npcPortraitId()` + `NPC_PORTRAIT_IDS`/`NPC_PORTRAIT_ALIASES`; `renderNpcPortrait` returns an `<img>` when a portrait exists, else the existing procedural SVG (safe fallback). Made `npcForTitle` search all locations so portraits resolve regardless of active region. Added `Iona` to `FEMALE_NPC_NAMES`. Added `.npc-portrait-photo`/emblem CSS (reward→★, question→?).
- `assets/characters/portraits-src/` is excluded from the deployed `dist` (sources not shipped).
- Bumped cache-bust to `2026.06.05.9`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Captured NPC dialogue windows (Mayor Ada village + Returning Officer June out-of-region) — both show the correct sliced photo with the mood emblem.

Next marker:
- Get the `elderGrace` portrait drawn (re-run the slicer), then build recognisable world NPC sprites from portrait + role prop, then ambient walking NPCs with route QA.

## 2026-06-05 — Hero left-walk above-head artifact (spritesheet bleed)

Plan area: player feedback — a brown bar flickering above the head, remaining ONLY when walking left.

Root cause: spritesheet row bleed. The hero sheet is a tight 4×4 grid of 32×48 cells (rows: down/left/right/up). The front row’s walk “step” frames (1 and 3) baked a longer leg + a dropped shoe that physically extended to y48–51 — 1–4px past the 48px cell bottom — spilling into the cell directly below. The left-facing row sits immediately below the front row, so when the left step frames were drawn, those bleed pixels appeared as a brown bar above the head. Right-facing was unaffected (its row sits below the left row, which has no baked legs); back bled off the bottom of the sheet (harmless). It only showed on step frames, hence “only while walking, especially left”.

What changed:
- Removed the redundant baked legs/shoes from the front row’s two step frames in `hero-base-spritesheet.svg`. The overlay `drawHeroShoeDetails` already draws identical legs on top of the sprite every frame, so the front/back walk looks exactly the same — but nothing now overflows the cell, so the left row is clean.
- Bumped cache-bust to `2026.06.05.8`.

Validation:
- `node --check game.js`, SVG well-formed
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Per-frame left-walk captures (frames 0–3, integer + fractional positions) confirmed the above-head bar is gone; front-walk captures confirmed legs still render (via overlay).

Next marker:
- Sync `publish/`, deploy live, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero cross-projection consistency

Plan area: player feedback — a “black cap” present only up/down, gone left/right, plus movement flicker; request to make all clothing/body/hair consistent across front/back/left/right.

Root cause: the hero customization overlays (hair style, silhouette robe/apron/coat, backpack, accent epaulettes) were drawn ONLY in front/back view. Side view showed just the plain base sprite. So each preset looked like a different person depending on facing, and dark-haired presets (e.g. liberty `#1f2f3a`) painted a near-black hair cap front/back but plain brown sides — the “cap in up/down only”. Changing direction while walking made these elements pop in/out (the “movement artifact”).

What changed (consistent in ALL four facings now):
- `drawHeroHairColor`: recolors the base sprite’s hair to the chosen colour with per-facing footprints that match the head silhouette exactly (no poke-out), plus a uniform sheen/shadow line. Same hair colour front/back/left/right.
- `drawHeroCap`: a peaked cap in the accent colour rendered in all four facings (dome + direction-appropriate peak), replacing the old front/back-only tall block.
- `drawHeroAccentBand`: a neck scarf in the accent colour in all four facings.
- `drawHeroShoeDetails`: side back foot now uses the chosen shoe colour (was a hard-coded dark navy), so footwear colour matches front/back.
- Removed the front/back-only `drawHeroSilhouetteDetails` (robe/apron/coat), `drawHeroBackpackDetails`, and `drawHeroAccentDetails` overlays that caused the inconsistency. Overworld preset identity now comes from consistent hair colour, cap (campaign), scarf colour, and shoe colour; the portrait UI keeps full-fidelity customization. The base sprite’s own side satchel still reads naturally in profile.
- Bumped cache-bust to `2026.06.05.7`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Built four-direction reference montages (down/up/left/right) for boySchool, boyCampaign, girlCouncil, boyLiberty (kept in `qa-screenshots/ref-*-idle.png`); confirmed each preset reads as the same character in every facing — same hair colour, cap, scarf, jumper, and shoe colour.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero above-head movement artifact fix

Plan area: player feedback — a stepped artifact above the head that appears ONLY while walking (worst facing left), gone when idle.

Root cause (two compounding bugs):
1. Sub-pixel desync: the hero base spritesheet was drawn at the raw fractional player position (`heroBaseSprite.draw(p.x, p.y, ...)` → `drawImage` does no rounding), while every procedural overlay uses `rect()` which pixel-rounds. While walking, `p.x/p.y` are fractional and changing, so sprite and overlays drifted apart by ~1px and the overlay edges “shelved”. When idle the position is static, so no visible seam.
2. Mirrored side hair overlay: the side-view hair recolor I added in 06.05.5 used non-mirrored geometry, but the left-facing sprite is drawn mirrored (`scale(-1)`), so the back-hair chunk poked ~1px past the head silhouette as a ledge — hence “especially left”.

What changed:
- Draw the hero base sprite at `Math.round(p.x), Math.round(p.y)` so it pixel-aligns with the rounded `rect()` overlays in every frame (kills the sub-pixel seam for hair, flag, legs, arm, accent alike).
- Removed the side-view hair recolor overlay branch entirely; the base spritesheet already carries correctly-placed hair for all four facings, so profile hair is clean (only trade-off: profile hair shows the sprite’s default brown rather than the chosen colour — no artifact).
- Bumped cache-bust to `2026.06.05.6`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Sub-pixel reproduction: captured the hero at fractional positions (x.33/x.66) walking left and down — confirmed the above-head shelf is present before the fix and gone after.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero front/back accent + side flag polish

Plan area: player feedback — green stripes on belly/legs (up/down) + brown bar in front of the face (right).

What changed:
- Removed the bright accent stripes that read as “green stripes on belly and legs” in front/back view: dropped the liberty silhouette’s two vertical accent side-stripes and the campaign boot accent lines (kept the dark coat/robe/boot shapes), and replaced the vertical belly accent block with two small shoulder epaulettes (`drawHeroAccentDetails`) that read as uniform trim.
- Fixed the “brown in front of the face when facing right”: the side flag pole positions were asymmetric (`p.x+27` right vs `p.x+3` left about the 16px centre), so the right-facing pole grazed the face. Moved the right pole to `p.x+29` (mirror of the left) for an equal gap; nudged the gripping hand to `p.x+27` so it still holds the pole.
- Side view no longer paints the front/back hairstyle overlay over the profile (it could drape a brown panel across the face for long/bob hair). In profile we now recolor only the base sprite’s top + back hair to the chosen hair colour, never the face side.
- Bumped cache-bust to `2026.06.05.5`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Per-preset captures (boySchool + girlLiberty, forest/green accent, down/up walk + left/right): no green belly/leg stripes (accent is now shoulder epaulettes), flag pole clears the face on both sides, legs read clearly.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero side-view clutter removal

Plan area: player feedback — brown artifact when walking right + green stripes on the legs.

Root cause: three procedural overlays designed for the front/back body were also drawing in the side profile, where they don't map onto the narrower silhouette:
- `drawHeroBackpackDetails` drew a large bag rectangle on the back → looked like a floating brown briefcase.
- `drawHeroSilhouetteDetails` (liberty/council) drew accent stripes/robe panels that ran down onto the legs → green leg stripes.
- `drawHeroAccentDetails` drew a torso accent block that the swinging arm crossed → split green stripe.

What changed:
- Gated all three overlays to front/back facings only (`if (p.dir === "left" || p.dir === "right") return;`). The base spritesheet already includes a small side satchel, so a clean, attached bag still reads on the back in profile.
- Removed the now-redundant campaign side foot-stripe branch.
- Down/up (front/back) appearance is unchanged — silhouette, accent, and backpack still render there.
- Bumped cache-bust to `2026.06.05.4`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Per-preset side captures (boySchool + girlLiberty with green accent, idle + walk, left/right): no brown briefcase, no green leg stripes; satchel attaches to the back and flips sides correctly.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero side-view artifact fixes

Plan area: player feedback — side-view artifacts (brown square over the face, indistinct legs, brown/green clutter).

What changed:
- Root cause of the “brown square in front of the face”: the carried flag pole ran vertically through the head in side view. Moved the side-view pole to the leading edge beside the head (left `p.x+3`, right `p.x+27`) so it no longer crosses the face; the flag now flies forward like a carried parade flag. Up/down flag placement unchanged.
- Reworked `drawHeroSideArm()` so the near arm reaches forward and the hand grips the pole base (instead of a floating hand), reading as “carrying the flag”.
- Fixed indistinct side legs: `drawHeroShoeDetails` side branch now gives an idle two-leg stance (feet apart) and a wider walk scissor; `drawHeroSideLeg` uses narrower feet with a top highlight so the two legs stay distinct in every pose.
- Removed the campaign silhouette’s two front-facing boots when facing sideways (they doubled over the side legs as brown/green clutter); side view now shows a single accent stripe on the front boot.
- Bumped cache-bust to `2026.06.05.3`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Per-direction, per-preset hero captures (boySchool + boyCampaign, idle + walk, down/left/right) confirmed: flag clears the face, legs read clearly, no brown/green clutter.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Hero walk + flag refinement

Plan area: player feedback on the hero — head artifact when facing up/side, and weak side-walk leg/arm motion.

What changed:
- Raised the carried Union Jack well clear of the head for every facing (pole +cloth lifted ~5px) so the fluttering cloth no longer grazes the head when walking up or sideways; flag pole now anchors near the hand per direction. Down-facing look preserved.
- Removed the static per-frame legs and the static near-arm from the side rows of `hero-base-spritesheet.svg` so the overlay fully owns side-view limbs.
- Rewrote the side branch of `drawHeroShoeDetails()` into a wide fore/aft leg scissor (`drawHeroSideLeg` helper) and added `drawHeroSideArm()` — a swinging near arm + hand — so legs and arms clearly move when walking left/right.
- Bob-aligned `drawHeroHairDetails()` (all hairstyles now follow the head bob) to remove a 1px hair jitter.
- Bumped cache-bust to `2026.06.05.2` (returning visitors should hard-refresh for the updated spritesheet SVG).

Validation:
- `node --check game.js`
- SVG well-formed check
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Deterministic per-direction hero captures (down/up/left/right, walk frames) confirmed: flag clears the head, side legs scissor, side arm swings.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D when ready.

## 2026-06-05 — Option C terrain autotiling + cast shadows

Plan area: procedural autotiling of terrain edges + grounding shadows (§G1 tail / Option C).

What changed:
- Reworked `drawTileEdges()` into a neighbour-aware autotiling pass that branches on tile kind and the four orthogonal (plus diagonal, for corners) neighbours.
- Added `drawWaterFoam()`: foam band on every water edge facing land (dock/grass/wall), with a Reduced-Motion-gated shimmer line that gently pulses.
- Added `drawBeachEdges()` + `drawBeachCorners()`: sandy beach band (light/mid/dark tones + pebble speckle) on grass tiles bordering water, including small convex sand nubs where only a diagonal neighbour is water.
- Added `drawPavingEdges()`: soft shadow line plus overhanging green grass-blade tufts on road/plaza tiles where they meet grass (replaces the old flat dark edge line).
- Enriched `drawTileVariation()` for grass with extra blade clumps and occasional tiny flower clusters (deterministic via `hashNoise`).
- Gave `drawTreeTile()` a directional cast shadow (soft skewed ellipse to the lower-right) over the existing tight contact shadow, matching the top-left light.
- Added a subtle directional cast shadow parallelogram at the base of every building in `drawBuilding()`.
- Bumped cache-bust query strings (`styles.css`/`curriculum.js`/`game.js`) to `2026.06.05.1` so returning visitors fetch fresh assets.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)
- Extra harbor-region capture (participation) to confirm shoreline foam + sand beaches render correctly.

Next marker:
- Sync `publish/`, deploy live for review, then §G3 NPC pass or Option D (2.5D) when ready.

## 2026-06-05 — UK symbolism + walk dynamics

Plan area: player feedback after Option B — more walking dynamism and visible UK (GCSE Citizenship) symbolism.

What changed:
- Added a reusable canvas Union Jack renderer: `paintUnionJack()` (blue field, white + red saltire, white + red cross) and `drawWavingUnionJack()` (vertical strip ripple that fades to zero at the pole).
- Gave the hero a Union Jack on a pole carried in-hand via `drawHeroUkFlag()`, positioned per facing direction; it flutters gently when idle and faster while walking. Gated flat (no ripple) under Reduced Motion.
- Reworked the static foot overlay into animated lower legs + feet (`drawHeroShoeDetails(p, visual, frame, moving)`): alternating step-down for front/back facing and a fore/aft scissor for side facing, synced to the walk frame so legs now read as stepping. Threaded `frame`/`moving` through `drawHeroProfileMarkers()` from both the sprite and procedural draw paths.
- Hung Union Jacks on civic/government buildings (`isCivicBuilding()` keyword match + `drawBuildingFlag()` flagpole) — e.g. Town Hall, Court, Parliament, City Hall, Museum, Police, Election, Petitions, Union Hall.
- Bumped app version to `2026.06.05.1`.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots; hero flag + Court flag visible on desktop and mobile)

Next marker:
- Sync `publish/`, deploy live for review, then Option C (terrain autotiling) when ready.

## 2026-06-05 — Option B cohesive art atlas first pass

Plan area: cohesive art atlas (тайлы + герой + дерево) ahead of §G3/G4.

What changed:
- Rewrote all six terrain tiles (`tile-grass`, `tile-road`, `tile-plaza`, `tile-water`, `tile-dock`, `tile-wall`) from flat 1–2 colour fills into cohesive multi-tone pixel-art with a unified palette and top-left lighting (lush grass with blades/flowers, warm gravel road, dressed-stone paving, rippled water, planked dock, mossy stone wall).
- Rebuilt the hero spritesheet `<defs>` bodies (front/side/back) with a dark outline and three-tone shading (jumper light/shadow, face shade, satchel), keeping the same frame geometry so customization overlays and held tools still render on top.
- Upgraded the procedural `drawTreeTile()` from blocky rects to a rounded, layered, shaded canopy with trunk shading in the cohesive green palette.
- No code wiring changed for tiles/hero (pure asset swaps); procedural fallbacks and Reduced Motion behaviour are unchanged.

Validation:
- `node --check game.js`
- SVG well-formed check (7 files)
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)

Next marker:
- Sync `publish/`, deploy live, then Option C (terrain autotiling) or §G3 NPC pass when ready.

## 2026-06-05 — Option A atmosphere/lighting first pass

Plan area: atmosphere pass (свет/настроение/жизнь) ahead of §G3.

What changed:
- Added `REGION_ATMOSPHERE` config + `currentAtmosphere()` so each region (and interior) defines a colour grade, vignette strength, and ambient particle type.
- Added a screen-space `drawAtmosphereOverlay()` (region colour grade + soft top light + cached radial vignette), called in `draw()` after the world transform is restored.
- Filled the previously empty `drawAmbientLayer()` with `drawAmbientParticles()` (pollen/dust/sparkle drifting motes) and `drawChimneySmoke()` (rising puffs from building chimneys).
- Added a soft contact shadow under trees in `drawTreeTile()`.
- All animated atmosphere (particles, smoke) stays gated behind `settings.reducedMotion`; the static grade/vignette remain for depth.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)

Next marker:
- Sync `publish/`, deploy live, then start Option B (cohesive art atlas) when ready.

## 2026-06-05 — G2 hero spritesheet first pass

Plan area: §G2 — Главный герой: спрайт-лист и анимации.

What changed:
- Added `assets/characters/hero-base-spritesheet.svg`, a lightweight 4-direction × 4-frame hero spritesheet.
- Added `HERO_ASSETS` and `heroBaseSprite` in `game.js`, using the G0 `AnimatedSprite` helper.
- Added `isHeroMoving()` and `drawHeroSpriteAsset()` so walking uses animated spritesheet frames while idle uses frame 0.
- Preserved the old `drawHeroFront` / `drawHeroBack` / `drawHeroSide` path as a fallback when the asset is unavailable.
- Kept current customization overlays (`hair`, outfit silhouette, backpack, accent, shoes) and held tools visible on top of the spritesheet.
- Extended `scripts/validate-world.js` to check `HERO_ASSETS` file existence.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node --check scripts\validate-world.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node scripts\qa-route-audit.js --write`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)

Next marker:
- Sync `publish/`, then start §G3 NPC recognisability + background life when ready.

## 2026-06-05 — G1 terrain tileset first pass

Plan area: §G1 — Террейн и тайлсет.

What changed:
- Added base terrain SVG assets under `assets/tiles/`: grass, road, plaza, water, dock, and wall.
- Added `TILE_ASSETS` and asset-backed tile drawing in `game.js`, using the existing shared image cache from G0 and preserving the primitive `drawTile` fallback.
- Added `tileKind`, `tileAtMap`, `drawTileAsset`, `drawTileVariation`, and `drawTileEdges` so water, roads, and plazas gain lightweight edge overlays and deterministic surface variation without changing map data.
- Kept tree drawing as a procedural overlay on grass so existing `T` map tiles remain compatible.
- Extended `scripts/validate-world.js` to check `TILE_ASSETS` file existence.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node --check scripts\validate-world.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node scripts\qa-route-audit.js --write`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)

Next marker:
- Sync `publish/`, then start §G2 hero sprite/animation when ready.

## 2026-06-05 — G0 render foundation first pass

Plan area: §G0 — Фундамент рендера и ассет-пайплайн.

What changed:
- Added shared asset image loading via `imageCache` and `getAssetImage`, then reused it for `PROP_ASSETS` while preserving primitive fallback behaviour.
- Added an `AnimatedSprite` helper class for future character/terrain/minigame sprite sheets. It is currently foundation-only and does not replace existing art.
- Added safe frame timing (`nowMs`, `frameDeltaMs`, `animationClockMs`) in `loop()` for future delta-time animation work without changing the existing frame-based player movement.
- Added an empty `drawAmbientLayer()` hook that respects Reduced Motion and is wired between prop rendering and character rendering.
- Changed `drawCharacterLayer()` to y-sort NPCs and the player before drawing, so future larger sprites can overlap by depth more naturally.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs` (`blockingIssues: 0`, 12 screenshots)

Next marker:
- Sync `publish/`, then start §G1 terrain/tileset when ready.

## 2026-06-05 — Plan reboot for the new graphics generation

Plan area: full-game analysis + new plan authoring (no code changes).

What changed:
- Renamed the previous plan `docs/GAMEPLAY_UPGRADE_PLAN.md` → `docs/GAMEPLAY_UPGRADE_OLD.md` (archived, with an archive banner) in both the root and `publish/docs/` trees.
- Authored a new `docs/GAMEPLAY_UPGRADE_PLAN.md` focused on a graphics overhaul: §1 current-graphics audit; §2 art direction; §3 game-field graphics (terrain, hero sprite/animation, NPC recognisability + 1–2 walking ambient NPCs, building exteriors, ambience) as the top priority; §4 purpose-specific building interiors; §5 menu/HUD/inventory/Character art; §6 mini-game art; §7 deeper/varied learning; §8 sprite/animation/delta-time foundation; §9 invariants/QA; §10 asset budget; §11 stages G0–G9.
- No `game.js`/`curriculum.js`/`styles.css` behaviour changed; this is a planning-only step.

Validation:
- Docs-only change; no code checks required. Existing systems and QA scripts are unchanged.

Next marker:
- Begin stage G0 (render/animation + asset pipeline foundation) only after priorities/art scope are confirmed with the user.

## 2026-06-05 — Map Phase 5 route QA pass

Plan area: §22 Map Phase 5 — QA маршрутов.

What changed:
- Added `scripts/qa-route-audit.js`, a VM-based route QA audit that checks reachability from each exterior region spawn to signs/landmarks, NPCs, building doors, mini-game hosts, mini-game trigger props, travel-gate hosts, and Exam Hall practice rooms.
- Generated `qa-route-audit-result.json` and `docs/MAP_ROUTE_QA.md`.
- Route QA passed for all 7 exterior regions: every audited sign, NPC, door, mini-game host, trigger prop, travel-gate host, and Exam Hall practice room is reachable from spawn.
- Regional mini-game host playthrough and release smoke were rerun after the map/asset work.

Validation:
- `node --check scripts\qa-route-audit.js`
- `node scripts\qa-route-audit.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`
- `node qa-regional-playthrough.mjs`
- `node qa-release-smoke.mjs`

Next marker:
- Graphics/map route release candidate is locally QA-clean. Next choose either a public deploy smoke, a manual route spot-check, or the next gameplay expansion.

## 2026-06-05 — Map Phase 4 trigger prop asset pass

Plan area: §22 Map Phase 4 — Asset pass.

What changed:
- Added small PNG runtime assets under `assets/props/region/` for the most visible mini-game trigger props: kiosk, rights notice, petition stand, ballot box, debate podium, planning board, exam desk, and debate bench.
- Added matching SVG source assets beside each PNG so the pixel-style art remains editable.
- Added `PROP_ASSETS`, lazy image loading, and `drawPropAsset()` in `game.js`; trigger props now prefer PNG assets and fall back to the existing canvas primitive drawings if an asset is unavailable.
- `scripts/validate-world.js` now validates that every `PROP_ASSETS` path exists.
- `scripts/audit-map.js` and `docs/MAP_AUDIT.md` now document trigger prop asset usage.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with Map Phase 5 — route QA now that visual anchors, trigger props, and runtime assets are in place.

## 2026-06-05 — Map Phase 3 Progress mini-game hints pass

Plan area: §22 Map Phase 3 — Интеграция мини-игр в локации.

What changed:
- Progress → Mini-games cards now show trigger prop location hints using `miniGameId` metadata from map props.
- Cards now show both the NPC host and the map trigger object, plus the same dynamic map marker status (`New`, `Try`, `Bronze`, `Silver`, `Gold`).
- Added focused VM validation that asserts Progress mini-game cards render trigger location hints.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Close out Map Phase 3 with documentation/status updates for the completed mini-game integration pass, then move to Map Phase 4 asset pass or Map Phase 5 route QA.

## 2026-06-05 — Map Phase 3 remaining trigger props pass

Plan area: §22 Map Phase 3 — Интеграция мини-игр в локации.

What changed:
- Extended explicit trigger prop metadata to the remaining mini-games: `ballotBox` for Ballot Count, `podium` and `debateBench` for Debate Arena, `planningBoard` for Campaign Planner, and `examDesk` for Exam Simulation.
- Existing `Play` trigger markers now cover all seven mini-games through auditable map props while preserving the NPC menu launch flow.
- `docs/MAP_AUDIT.md` was regenerated and now lists trigger props for Modern Britain, Rights & Law, Democracy, Participation, Action Workshop, and Exam Hall.

Validation:
- `node --check game.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 3 by adding clearer completion/location hints in Progress → Mini-games, using the trigger prop metadata now present in map data.

## 2026-06-05 — Map Phase 3 first trigger prop slice

Plan area: §22 Map Phase 3 — Интеграция мини-игр в локации.

What changed:
- Added explicit `miniGameId` metadata to the first three themed trigger props: Modern Britain `kiosk` for Source Detective, Rights & Law `notice` for Rights vs Responsibilities, and Participation `petitionStand` for Petition Regatta.
- Added `drawMiniGameTriggerMarkers()` so trigger props display a small `Play` marker with the same dynamic status labels as host NPC markers: `New`, `Try`, `Bronze`, `Silver`, or `Gold`.
- `scripts/validate-world.js` now validates trigger prop mini-game references and reachability from spawn.
- `scripts/audit-map.js` and `docs/MAP_AUDIT.md` now include a `Mini-game Trigger Props` audit column.

Validation:
- `node --check game.js`
- `node --check scripts\audit-map.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 3 by extending explicit trigger props/markers to Ballot Count, Debate Arena, Campaign Planner, and Exam Simulation.

## 2026-06-05 — Map Phase 3 mini-game marker status first pass

Plan area: §22 Map Phase 3 — Интеграция мини-игр в локации.

What changed:
- Mini-game host world markers now show completion status from `state.miniGameScores`: `New`, `Try`, `Bronze`, `Silver`, or `Gold`.
- Marker border/accent colour now reflects the current status while keeping the existing NPC menu launch flow unchanged.
- This reuses existing save data and does not require a save migration.
- `scripts/audit-map.js` and `docs/MAP_AUDIT.md` now document the dynamic mini-game marker status behavior.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 3 with explicit mini-game trigger props/markers near existing Map Phase 2 anchors, starting with Source Detective, Rights Match, and Petition Regatta.

## 2026-06-05 — Map Phase 2 Exam Hall recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Exam Hall Castle now has auditable signposts for Final Gate, Exam Desk, Source Archive, and Debate Bench.
- Added visible exam/source/final route props: `finalGate`, `examDesk`, `sourceArchive`, and `debateBench` around the Final Gate / Examiner Mira / Source Keeper Nia / Coach Leon / practice-room route.
- `drawProp()` now renders `finalGate`, `examDesk`, `sourceArchive`, and `debateBench` as themed exam props.
- `scripts/validate-world.js` now knows the Exam Hall prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Exam Hall signs/props; all exterior regions have first-pass auditable signposts and props.
- The plan marker moves beyond Map Phase 2 first pass to Map Phase 3: integrate mini-game trigger props and completion markers into the map/progress loop.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with Map Phase 3 — add mini-game trigger props/markers and completion state hints near host NPCs, starting with the existing themed anchors from Map Phase 2.

## 2026-06-05 — Map Phase 2 Action Workshop recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Action Workshop now has auditable signposts for Plan Board, Campaign Planner, Data Bench, and Lighthouse Bridge.
- Added visible research/planning/campaign wayfinding props: `planningBoard`, `surveyBox`, `dataCards`, and `campaignTable` around the Plan Board / Councillor Noor / survey-data-action / gate route.
- `drawProp()` now renders `planningBoard`, `surveyBox`, `dataCards`, and `campaignTable` as themed workshop props.
- `scripts/validate-world.js` now knows the Action Workshop prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Action Workshop signs/props instead of showing that region as empty.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 2 with Exam Hall Castle: add exam/source/final-gate signposts and a small number of props around Final Gate, Examiner Mira / Exam Simulation, Debate Coach Leon / Debate Arena, practice rooms, and the course-complete route.

## 2026-06-05 — Map Phase 2 Participation Harbour recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Participation Harbour now has auditable signposts for Petition Pier, Regatta Stand, Volunteer Dock, and Campaign Boat Gate.
- Added visible harbour/petition wayfinding props: `petitionStand`, `boat`, `banner`, and crate around the Petition Pier / Priya / volunteer-social-action / gate route.
- `drawProp()` now renders `petitionStand`, `boat`, and `banner` as themed harbour and campaign props.
- `scripts/validate-world.js` now knows the `petitionStand`, `boat`, and `banner` prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Participation Harbour signs/props instead of showing that region as empty.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 2 with Action Workshop: add research/planning/campaign signposts and a small number of props around Plan Board, Councillor Noor / Campaign Planner, survey/data/action anchors, and the travel-gate route.

## 2026-06-05 — Map Phase 2 Democracy recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Democracy Capital now has auditable signposts for Ballot Hall, Count Table, Debate Steps, and Ferry Gate.
- Added visible democracy wayfinding props: `ballotBox`, `podium`, `poster`, and bench around the Ballot Hall / Returning Officer June / Campaign Manager Sol / gate route.
- `drawProp()` now renders `ballotBox`, `podium`, and `poster` as themed election/debate props.
- `scripts/validate-world.js` now knows the `ballotBox`, `podium`, and `poster` prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Democracy Capital signs/props instead of showing that region as empty.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 2 with Participation Harbour: add harbour/petition signposts and a small number of props around Petition Pier, Priya / Petition Regatta, volunteer/social action anchors, and the travel-gate route.

## 2026-06-05 — Map Phase 2 Rights & Law recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Rights & Law Quarter now has auditable signposts for Court Square, Rights Cards, and Clock Lift Gate.
- Added visible legal wayfinding props: `scales`, `notice`, bench, and lamp around the Court Square / Advocate Farah / gate route.
- `drawProp()` now renders `scales` and `notice` as themed legal props.
- `scripts/validate-world.js` now knows the `scales` and `notice` prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Rights & Law signs/props instead of showing that region as empty.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 2 with Democracy Capital: add parliament/election signposts and a small number of props around Ballot Hall, Returning Officer June / Ballot Count, Campaign Manager Sol / Debate Arena, and the travel-gate route.

## 2026-06-05 — Map Phase 2 Modern Britain recomposition first pass

Plan area: §22 Map Phase 2 — Перекомпозиция регионов.

What changed:
- Modern Britain Borough now has auditable signposts for Media Plaza, Source Kiosk, and Underground Gate.
- Added visible Modern Britain wayfinding props: a new newspaper/media `kiosk` prop, a bench, lamp, and crate near the plaza/source route.
- `drawProp()` now renders the `kiosk` as a small newspaper stand, giving Source Detective a stronger world anchor.
- `scripts/validate-world.js` now filters prop overlap checks by location and knows the `kiosk` prop bounds.
- `docs/MAP_AUDIT.md` was regenerated and now records Modern Britain signs/props instead of showing that region as empty.

Validation:
- `node --check game.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue Map Phase 2 with Rights & Law Quarter: add court/legal signposts and a small number of props around Court Square, Advocate Farah, and the travel-gate route.

## 2026-06-05 — Map Phase 1 audit and connectivity pass

Plan area: §22 Map Phase 1 — Audit и карта связности.

What changed:
- Added `scripts/audit-map.js`, a VM-based map audit generator that reads live world data from `game.js` and writes `docs/MAP_AUDIT.md`.
- Added `docs/MAP_AUDIT.md` with exterior location table, spawn coordinates, landmarks, NPC positions, building doors, mini-game anchors, travel-gate notes, blocked-zone summaries, interior study routes, Exam Hall practice rooms, and JSON-style region zone sketches.
- Extended `scripts/validate-world.js` with an NPC-door interaction conflict check so future map edits catch `E` prompt competition between NPCs and building doors.
- The plan marker moves to §22 Map Phase 2: recomposition of regions using the audit as the baseline.

Validation:
- `node --check scripts\audit-map.js`
- `node --check scripts\validate-world.js`
- `node scripts\audit-map.js --write`
- `node scripts\validate-world.js`

Next marker:
- Continue with §22 Map Phase 2 — recomposition one region at a time: route from spawn to landmark, thematic props/signposts, NPC placement, and door approaches.

## 2026-06-05 — Section 20.4 story and mini-game visual pass

Plan area: 20.4 — Story and mini-game visuals.

What changed:
- Story scenes now render regional title-card details with act label, landmark name, region-specific landmark silhouette, key object label, Apathy Shade, and sparks.
- Mini-game panels now use themed visual stage layouts for Source Detective, Rights vs Responsibilities, Petition Regatta, Ballot Count, Debate Arena, Campaign Planner, and Exam Simulation.
- Mini-game completion now includes a visual medal/reward block while keeping textual score and medal lines for accessibility and existing QA automation.
- The plan marker moves beyond the section 20 graphics pass to map/layout readability work: start with §22 Map Phase 1 audit before recomposing regions.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-ui.js`
- `node scripts\validate-world.js`
- `node qa-ui-regression.mjs`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with §22 Map Phase 1 — audit each location's spawn, landmark, NPCs, doors, travel gate, mini-game trigger, and blocked zones before moving objects.

## 2026-06-04 — GitHub Actions push notification fix

Why:
- GitHub was emailing failure notifications after commits because the Azure Static Web Apps deploy workflow ran on every push to `main` and the deploy step failed.

What changed:
- `.github/workflows/azure-static-web-apps.yml` now runs only from `workflow_dispatch`, so normal commits/pushes no longer trigger deploy attempts.
- The workflow job id is now `build_and_deploy_job`, matching the structure expected by Azure Static Web Apps tooling.
- Handoff notes now describe the workflow as manual-only and still requiring `AZURE_STATIC_WEB_APPS_API_TOKEN` for an explicit manual deploy.

Validation:
- `git diff --check` for the workflow/docs change.
- GitHub Actions metadata confirmed the previous `Deploy Citizenship Game` runs were failing on the deploy step after push events.

Next marker:
- Continue with 20.4 — regional story title cards, distinct mini-game layouts, and medal reward visuals.

## 2026-06-04 — Reboot handoff snapshot

Current status before PC restart:
- Sections 20.1, 20.2, and 20.3 are closed as first-pass graphics/readability work.
- The single active roadmap marker is now 20.4 — story scene and mini-game visual polish.
- Section 20.3 added Backpack category frames, selected item detail panel, effect summaries, keyboard/mouse selection, and quest item lock markers.
- Full QA after section 20.3 completed with `blockingIssues: 0` across UI regression, visual smoke, regional mini-game playthrough, regional quest/gate playthrough, and release smoke.
- `publish/` has been synced with the latest section 20.3 code, styles, validator, docs, and assets.
- Public Azure deploy was not run after section 20.3; deployment smoke remains `not-run` unless explicitly requested.

Files to use when resuming:
- `docs/AI_HANDOFF.md` — current architecture, QA state, reboot resume point, and next task.
- `docs/GAMEPLAY_UPGRADE_PLAN.md` — canonical roadmap marker at 20.4.
- `docs/VISUAL_STYLE_GUIDE.md` — current visual rules for story, item, hero, region, and UI assets.
- `docs/QA_RUNBOOK.md` — quick/full local QA commands.

Next marker:
- Continue with 20.4 — regional story title cards, distinct mini-game layouts, and medal reward visuals.

## 2026-06-04 — Section 20.3 item and Backpack visual pass

Plan area: 20.3 — Items and inventory visuals.

What changed:
- Backpack rows now use type-based category frames for quest, consumable, outfit, tool, and collectible/treasure items.
- Backpack items can be selected, with a larger selected-item detail panel on the right.
- The selected-item panel shows a larger asset thumbnail, item type, stack/equipped state, lock marker, description, effects, and available actions.
- Quest items now display a locked/unsellable marker in Backpack detail and list rows.
- VM UI validation now asserts that the Backpack selected item detail panel renders.
- The plan marker moves to section 20.4: story and mini-game visual polish.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js`
- `node qa-ui-regression.mjs`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with 20.4 — story scene and mini-game visual polish.

## 2026-06-04 — Section 20.2 hero customization visual pass

Plan area: 20.2 — Character and customization visuals.

What changed:
- Added profile-driven hero portrait rendering to the HUD and Character panel.
- The portrait and canvas sprite now share preset visual data: hair style, outfit silhouette, shoe colour, backpack colour, trim, and accent.
- Canvas hero presets are more distinct through hairstyles, council/campaign/liberty silhouettes, visible backpack/strap details, shoe colour, and accent overlays.
- `Justice Quill` and `Debate Blade` are now drawn as distinct held tools; no default blade is drawn when no tool is equipped.
- Added a visible interaction-range highlight around the current interactable target.
- The plan marker moves to section 20.3: item and Backpack presentation polish.

Validation:
- `node --check game.js`
- `node scripts\validate-ui.js`
- `node qa-ui-regression.mjs`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with 20.3 — item category frames, larger selected-item presentation, and quest item lock markers.

## 2026-06-04 — Section 20.1 visual style asset pass

Plan area: 20.1 — General visual style.

What changed:
- Extended the visual style pass with actual small PNG item assets under `assets/items/` for core backpack items, tools, and collectible rewards.
- Added seed visual assets under `assets/ui/` and `assets/props/region/` for future marker/prop replacement.
- `itemThumb()` now prefers image-backed item thumbnails and falls back to CSS pixel art if an asset fails.
- Added stronger region silhouette motifs: media screen, legal scales, ballot booth, volunteer banner, planning/survey board, source archive, and Civic Square label.
- Added subtle Apathy Shade trace shapes in regions whose related story choice has not yet been resolved.
- The plan marker moves to section 20.2: character and customization visual polish.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue with 20.2 — hero preset silhouettes, HUD/Character portrait, and held item visibility.

## 2026-06-04 — F5 local release smoke pass

Plan area: F5 — Release hardening.

What changed:
- Added `qa-release-smoke.mjs` as a reproducible local release smoke script.
- The script covers desktop keyboard movement, opening one NPC quest menu, primary overlays, Settings persistence/reset, mobile touch movement/interact, and Dev Travel region spot checks.
- It verifies mini-game host buttons during region spot checks.
- Deployment smoke remains explicitly `not-run` unless a separate deploy is requested, because it requires Azure auth and a Static Web Apps token.
- The plan marker moves to choosing the next gameplay expansion or asset pass.

Validation:
- `node --check qa-release-smoke.mjs`
- `node qa-release-smoke.mjs`

Next marker:
- Choose and begin the next gameplay expansion or asset pass.

## 2026-06-04 — F5 visual readability first pass

Plan area: F5 — Visual/readability polish.

What changed:
- Added `docs/VISUAL_STYLE_GUIDE.md` to document tile scale, region palettes, motifs, interaction contrast, UI status colours, and future asset rules.
- Added short world-space region motif labels for key landmarks such as Media Plaza, Court Square, Ballot Hall, Petition Hub, Plan Board, and Exam Gate.
- Added persistent floating `Game` markers above NPCs that host mini-games, so mini-game entry points are visible before the player enters interaction range.
- The plan marker moves to manual release smoke or the next gameplay expansion decision.

Validation:
- `node --check game.js`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-visual-smoke.mjs`

Next marker:
- Run manual release smoke from `docs/RELEASE_SMOKE_CHECKLIST.md`, then choose the next gameplay expansion or visual asset pass.

## 2026-06-04 — F5 balance, handoff, and release smoke pass

Plan area: F5 — Accessibility, polish, release hardening.

What changed:
- Reduced generated post-Village quest rewards from coins plus `Revision Tea` to coins only.
- Added `docs/BALANCE_REVIEW.md` with current XP, Focus, coins, inventory, and Exam Readiness findings.
- Added `docs/RELEASE_SMOKE_CHECKLIST.md` for manual desktop/mobile/release-candidate checks.
- Refreshed `docs/AI_HANDOFF.md` with current QA scripts, Settings system, balance notes, and next recommended tasks.
- The plan marker moves to visual/readability polish.

Validation:
- `node --check game.js`
- `node qa-regional-quests-playthrough.mjs`

Next marker:
- Continue F5/visual polish with regional readability, visual motifs, or interactive markers.

## 2026-06-04 — F5 settings accessibility first pass

Plan area: F5 — Accessibility, polish, release hardening.

What changed:
- Added a Settings overlay opened from the HUD Controls section.
- Added persistent browser settings under `citizenshipValleySettingsV1`.
- Added accessibility toggles for Large text, High contrast, and Reduced motion.
- Added a Settings reset-save control that deletes game progress while keeping display settings.
- Extended VM UI validation, UI regression, and desktop/mobile visual smoke coverage for the Settings panel.
- The plan marker moves to F5 balance review for XP, Focus, coins, and Exam Readiness.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node --check qa-ui-regression.mjs`
- `node --check qa-visual-smoke.mjs`
- `node scripts\validate-world.js`
- `node scripts\validate-ui.js`
- `node qa-ui-regression.mjs`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue F5 polish with balance review for XP, Focus, coins, and Exam Readiness.

## 2026-06-04 — P2 QA runbook and release hardening pass

Plan area: P2 — QA and automation hardening.

What changed:
- Added `docs/QA_RUNBOOK.md` as the consolidated local QA command set.
- The runbook documents quick checks, browser regression checks, full pre-release QA, generated artifacts, and manual follow-up limitations.
- `README.md` now links to the QA runbook.
- `AGENTS.md` now lists the quick VM validation commands and points agents to the full QA runbook.
- The plan marker moves beyond P2 QA hardening toward choosing the next gameplay/polish phase.

Validation:
- Documentation diagnostics for edited files

Next marker:
- Decide and begin the next gameplay/polish phase after P2 QA automation.

## 2026-06-04 — P2 QA full regional quest and gate playthrough pass

Plan area: P2 — QA and automation hardening.

What changed:
- Added `qa-regional-quests-playthrough.mjs`, a headless Chrome/CDP playthrough for all post-Village regional quests and travel gates.
- The script starts a clean New Game, switches to Modern Britain, then completes the real UI quest flow for Modern Britain, Rights & Law, Democracy, Participation, Action Workshop, and Exam Hall.
- It covers 30 post-Village quests through accept → ask target → return → answer, with rendered shuffled answer buttons.
- It completes travel gates from Modern Britain through Action Workshop and verifies the Exam Hall final gate panel.
- The run verifies `completedQuests`, region unlocks, badges, story flags, `activeQuest`, `pendingGate`, and save persistence.
- The plan marker moves beyond P2 QA automation to QA runbook/release hardening before the next gameplay or polish phase.

Validation:
- `node --check qa-regional-quests-playthrough.mjs`
- `node qa-regional-quests-playthrough.mjs`

Next marker:
- Continue with QA runbook/release hardening: document the full QA command set and decide the next gameplay/polish phase.

## 2026-06-04 — P2 QA regional mini-game host playthrough pass

Plan area: P2 — QA and automation hardening.

What changed:
- Added `qa-regional-playthrough.mjs`, a headless Chrome/CDP regional playthrough script.
- The script starts a clean New Game, then uses controlled region switching to visit all post-Village mini-game host NPCs.
- It opens each mini-game through the real NPC menu button, completes every round with the rendered UI, and verifies a saved gold result.
- Coverage currently includes 8 host NPCs across Modern Britain, Rights & Law, Democracy, Participation, Action Workshop, and Exam Hall.
- It verifies all 7 unique mini-games, including `Exam Simulation` with its section breakdown and the duplicate `Debate Arena` host in Exam Hall.
- The plan marker moves to full regional quest/travel-gate playthrough automation if QA hardening continues.

Validation:
- `node --check qa-regional-playthrough.mjs`
- `node qa-regional-playthrough.mjs`

Next marker:
- Continue QA hardening with full regional quest and travel-gate automation beyond Citizenship Village.

## 2026-06-04 — P2 QA desktop/mobile visual smoke pass

Plan area: P2 — QA and automation hardening.

What changed:
- Added `qa-visual-smoke.mjs`, a headless Chrome/CDP screenshot smoke script with desktop and mobile viewport coverage.
- The script starts a clean New Game, closes the intro story, opens Inventory, Progress → Curriculum, Character, and a live Source Detective mini-game panel.
- The script saves 10 screenshots under `qa-screenshots/` and writes `qa-visual-smoke-result.json`.
- The script checks for runtime exceptions, horizontal page overflow, nonblank canvas rendering, visible mobile touch controls, and overlay panels fitting inside the viewport.
- The plan marker moves to broadened regional playthrough automation beyond the first location.

Validation:
- `node --check qa-visual-smoke.mjs`
- `node qa-visual-smoke.mjs`

Next marker:
- Continue QA hardening by extending automated playthrough coverage beyond Citizenship Village into later regions and their mini-game hosts.

## 2026-06-04 — P2 QA pathfinding reachability pass

Plan area: P2 — QA and automation hardening.

What changed:
- Extended `scripts/validate-world.js` pathfinding coverage beyond NPC adjacency.
- The validator now checks reachability from each location spawn to building doors, interior exits, study stations, travel-gate-capable NPCs, mini-game hosts, and Exam Hall practice rooms.
- The validator now exposes `BUILDING_DOORS`, `INTERIOR_EXITS`, `STUDY_STATIONS`, and `MINI_GAMES` inside its VM validation context.
- Aligned validator tile collision with the real game collision rules by treating `=` path/dock tiles as passable.
- The plan marker moves to the next QA hardening follow-up after pathfinding reachability checks.

Validation:
- `node scripts\validate-world.js`

Next marker:
- Continue QA hardening with desktop/mobile screenshot smoke checks or broadened regional playthrough automation beyond the first location.

## 2026-06-04 — P2 QA automation UI regression pass

Plan area: P2 — QA and automation.

What changed:
- Extended `scripts/validate-ui.js` with a VM save migration check for legacy saves through current `SAVE_VERSION = 6`.
- The save validation now checks default profile/stats, starter inventory, achievements, story fields, mini-game scores, story flags, and `serializeGame()` version output.
- Added `qa-ui-regression.mjs`, a headless Chrome/CDP UI regression script covering the planned browser scenarios without adding a new Playwright dependency.
- The browser regression covers New Game → customization → start, opening Backpack/Progress/Character/Mini-games, and completing `Source Detective` with a saved gold result.
- The plan marker moves to QA hardening follow-up after the first P2 QA automation pass.

Validation:
- `node --check qa-ui-regression.mjs`
- `node scripts\validate-ui.js`
- `node qa-ui-regression.mjs`

Next marker:
- Continue with QA hardening follow-up, especially pathfinding reachability checks from spawn to NPCs, doors, gates, and mini-game hosts.

## 2026-06-04 — P2 QA automation first pass

Plan area: P2 — QA and automation.

What changed:
- Added `scripts/validate-ui.js` as a standalone VM-based UI validation script.
- The script validates mini-game structure: title, region, reward, minimum round count, and valid correct indexes.
- The script validates achievement id uniqueness and required achievement text.
- The script checks static HTML buttons have an id or handled data-action style attribute.
- The script smoke-renders Inventory, Progress, Character, and Mini-game panels in a VM.
- The plan marker remains in QA automation for the next substep: Playwright UI regression scenarios.

Validation:
- `node scripts\validate-ui.js`

Next marker:
- Continue with P2 — QA and automation, specifically Playwright UI regression scenarios.

## 2026-06-04 — P2 visual assets first pass

Plan area: P2 — Visual assets.

What changed:
- Added `assets/story/apathy-shade.svg` as a dedicated Apathy Shade silhouette asset.
- Story scenes now use region-specific title-card backgrounds.
- Story Shade rendering now uses the SVG asset instead of only CSS shape drawing.
- Mini-game panels now include thematic visual props for source checking, rights matching, ballot counting, petitioning, debate, campaign planning, and exam simulation.
- The plan marker moved to P2 — QA and automation.
- Public build version moved to `2026.06.04.1`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser visual smoke test for story region cards, Apathy Shade SVG asset, mini-game visuals, and mobile overflow

Next marker:
- We are now at P2 — QA and automation in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P2 UX menus and mobile ergonomics

Plan area: P2 — UX menus and mobile ergonomics.

What changed:
- Added a lightweight overlay manager for Inventory, Progress, Character, Story, and Mini-games.
- Opening one overlay now closes the others instead of allowing stacked panels.
- Escape now closes the active overlay first, then NPC/menu panels, then dialogue.
- HUD sidebar sections now use collapsible `details/summary` blocks.
- Mobile HUD spacing is tighter, and long inventory lists can scroll inside the HUD.
- Overlay z-index ordering is explicit, with Story above other menu overlays.
- The plan marker moved to P2 — Visual assets.
- Public build version moved to `2026.06.03.10`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser smoke test for overlay exclusivity, Escape close behavior, collapsible HUD sections, and mobile overflow

Next marker:
- We are now at P2 — Visual assets in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P2 curriculum tracking

Plan area: P2 — Curriculum tracking as real learning progress.

What changed:
- Added curriculum metadata fields through `GCSE_CURRICULUM_INDEX`: area, difficulty, statBoosts, miniGameRefs, and examSkill.
- Added Progress → Curriculum tab.
- Curriculum tab shows overall progress and per-area progress for Core Citizenship, Modern Britain, Rights & Law, Democracy, Participation, Active Citizenship, and Exam Skills.
- Area progress counts completed quest topics, linked study stations, and linked mini-games.
- Mini-game results now show which curriculum areas improved.
- The plan marker moved to P2 — UX menus and mobile ergonomics.
- Public build version moved to `2026.06.03.9`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser smoke test for Curriculum tab, metadata, mini-game curriculum note, and mobile layout

Next marker:
- We are now at P2 — UX menus and mobile ergonomics in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P1 story choices and Shade reactions

Plan area: P1 — Story choices and Apathy Shade reactions.

What changed:
- Added persistent `state.storyFlags` with save migration to version 6.
- Regional quest completions now record story choices such as challenging rumours, defending rights, helping volunteers, using evidence, and planning action.
- Mini-game completions can also record matching story choices when the player earns a medal.
- Progress → Story now shows `Choices against Apathy` and the current Shade reaction.
- Story cutscenes now include a short choices/Shade reaction line.
- Silver and Gold endings now require enough story choices, not only readiness and exam score.
- Public build version moved to `2026.06.03.8`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser smoke test for save migration, Progress story flags, and ending thresholds

Next marker:
- We are now at P2 — Curriculum tracking as real learning progress in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — Exterior map cleanup pass

Plan area: visual and movement cleanup for all non-interior regions.

What changed:
- Cleaned Modern Britain, Rights & Law, Democracy, Participation Harbour, Action Workshop, and Exam Hall maps using the same approach as Citizenship Village.
- Removed internal placeholder stone blocks and tree blockers from exterior maps.
- Replaced cluttered building-placeholder tiles with passable road/plaza/grass surfaces.
- Kept Participation Harbour water as an intentional boundary while making wooden dock tiles passable.
- Moved three NPCs slightly away from collision edges: Devolution Herald Ewan, Digital Moderator Rae, and Source Keeper Nia.
- Public build version moved to `2026.06.03.7`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- Runtime browser check across all exterior maps: no internal random blockers, no blocked spawns, no blocked NPCs

Next marker:
- Continue from P1 — Story choices and Apathy Shade reactions in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — Village map cleanup

Plan area: first-location visual and movement cleanup.

What changed:
- Cleaned the Citizenship Village base map by removing internal blocking stone blocks, trees, and water tiles that looked like random obstacles.
- Kept building collision on actual buildings, while making the central plaza and approach paths easier to read and move through.
- Removed nonfunctional Village market stalls, fences, random barrels, crates, and the decorative dock/water block that cluttered the first screen.
- Added sparse nonblocking meadow/flower detail so the map still has texture without blocking movement.
- Public build version moved to `2026.06.03.6`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- Browser screenshot smoke for the cleaned Village field

Next marker:
- Continue from P1 — Story choices and Apathy Shade reactions in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P1 economy and vendors

Plan area: P1 — Economy and vendors.

What changed:
- One vendor NPC is available in each major region.
- Trade menu now shows regional shop stock for vendor NPCs.
- Players can buy useful supplies with coins directly from NPC panels.
- Shops sell Focus consumables and region-appropriate tools/outfits.
- Unique items are disabled in the shop once owned.
- Quest items no longer show Sell buttons and cannot be sold defensively.
- The plan marker moved to P1 — Story choices and Apathy Shade reactions.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser smoke test for vendor shop purchase and mobile shop layout
- Azure Static Web Apps deployment confirmed

Next marker:
- We are now at P1 — Story choices and Apathy Shade reactions in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P1 Focus and stat clarity

Plan area: P1 — Improve RPG stats and Focus.

What changed:
- Focus is now a real resource for equipped-tool assists in mini-games.
- Tool assists cost 10 Focus and only trigger once per mini-game run.
- `Justice Quill` can assist Source Detective and the final exam `Evaluate`/`Source` sections.
- `Debate Blade` can assist Debate Arena.
- Study Stations now restore Focus when completed, so buildings also act as recovery points.
- Character Panel now explains each stat and shows its Exam Readiness contribution.
- Character Panel now shows the shared Exam Readiness formula and tool-assist Focus cost.
- Public build version moved to `2026.06.03.4`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Browser smoke test for Character Panel on desktop and mobile viewport
- Azure Static Web Apps deployment confirmed

Next marker:
- We are now at P1 — Economy and vendors in `GAMEPLAY_UPGRADE_PLAN.md`.

## 2026-06-03 — P1 item effects

Plan area: P1 — Make items more game-like.

What changed:
- Key items gained `effect` metadata.
- `Revision Tea` restores Focus.
- `Notebook` opens Progress and shows the current objective.
- `Citizen Scroll` opens the Story/Progress hint for the current act.
- `Justice Quill` and `Debate Blade` gained thematic mini-game assists.
- Final Exam breakdown can display `tool assist` rows.
- Public build version moved to `2026.06.03.3`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- VS Code diagnostics for edited files
- Azure Static Web Apps deployment confirmed

## 2026-06-03 — P0 final exam and mini-game integration

Plan area: P0 — World-connected mini-games and final Exam Simulation.

What changed:
- Mini-games can be launched from specific NPC hosts.
- Progress now shows mini-game hosts and regions.
- Exam Simulation became a five-section final exam: Identify, Describe, Explain, Evaluate, Source.
- Exam Simulation saves section breakdowns and affects final endings with Exam Readiness.
- Exam Hall practice spacing was adjusted so `Identify` is reachable and no longer collides with the entrance prompt.
- Public build version moved to `2026.06.03.2`.

Validation:
- `node --check game.js`
- `node --check curriculum.js`
- `node scripts\validate-world.js`
- Custom Exam Hall spacing check
- VS Code diagnostics for edited files
- Azure Static Web Apps deployment confirmed