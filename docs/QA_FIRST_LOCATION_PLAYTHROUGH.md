# QA: First Location Playthrough

Date: 2026-05-24
Build tested: v2026.05.24.2
Scope: clean New Game, character customization, Act 1 intro, all Citizenship Village quests, Travel Gate questions, transition to Modern Britain Borough.

## Method

The pass was run against a local static server in headless Chrome via Chrome DevTools Protocol.

Flow tested:

1. Clear `localStorage`.
2. Open title screen.
3. Start New Game.
4. Enter name `QA Scout`.
5. Select preset `girlLiberty`.
6. Select accent `forest`.
7. Start adventure.
8. Close Act 1 story scene.
9. Complete all 15 `WORLD.village.questIds` through the real NPC menu flow:
   - accept quest from giver;
   - open target NPC quest action;
   - return to giver;
   - answer the turn-in question using the rendered shuffled answer buttons.
10. Confirm a first-location mini-game entry is visible at Priya.
11. Complete all 3 Travel Gate questions.
12. Confirm transition to `modernBritain`.

Important limitation: the test script placed the player next to NPCs by setting `state.player.x/y` to the nearest position where `findInteractable()` returns the target NPC. This validates NPC/menu/quest logic and interaction reachability, but it is not a full keyboard pathfinding/manual movement test.

Raw machine-readable output is saved in `qa-first-location-playthrough-result.json`.

## Result Summary

Status: passed after fixes. No blocking issues were found in the automated first-location flow.

Final state:

- Current location: `modernBritain`
- Completed village quests: `15/15`
- Modern Britain unlocked: `true`
- Badge earned: `Informed Citizen`
- Story scenes seen: `intro`, `modernBritain`
- Active quest: `null`
- Pending gate: `null`
- Save persisted completed quests: yes
- First-location mini-game entry visible: `Mini-game: Petition Regatta` at Priya
- Final balance snapshot: `knowledge: 45`, `coins: 91`, `level: 3`, `rhetoric: 15`, `empathy: 15`, `integrity: 15`

Completed quests:

- `mayorVote`
- `mayorRepresent`
- `mayorParliament`
- `priyaPetition`
- `priyaMedia`
- `priyaProject`
- `samRights`
- `samDuties`
- `samIdentity`
- `rowanCriminal`
- `rowanPolice`
- `rowanJury`
- `noorSurvey`
- `noorCouncil`
- `noorEvaluate`

Travel Gate:

- Question 1 passed
- Question 2 passed
- Question 3 passed
- Transition to `Modern Britain Borough` succeeded

## Blocking Bugs Found

None in this automated pass.

## Fixed / Mitigated Issues From The First QA Pass

### QA-001: First location over-rewards knowledge and progression — mitigated

Severity: medium
Area: balance

Before the fix, after completing the first location and Travel Gate, the player reached:

- `knowledge: 100`
- `level: 4`
- `statPoints: 3`
- `coins: 199`

After the fix, the same flow now ends at:

- `knowledge: 45`
- `level: 3`
- `statPoints: 2`
- `coins: 91`

Implemented changes:

- target NPC clue step knowledge reduced from `+3` to `+1`;
- quest completion knowledge reduced from `+7` to `+2`;
- first-region quest coins are scaled down through `questCoinReward`;
- Village stat reward now grants smaller XP.

Remaining follow-up: balance should be reviewed again after mini-games are integrated into the world, because optional mini-games will add extra XP/coins.

### QA-002: Rhetoric remains 0 after all Village quests — fixed

Severity: low/medium
Area: stat balance

Before the fix, final stats included:

- `empathy: 15`
- `integrity: 15`
- `rhetoric: 0`

After the fix, the first-location flow ends with `rhetoric: 15`.

Implemented change:

- Village quest stat reward now includes `rhetoric: 1`.

Remaining follow-up: topic-level stat rewards would still be better than broad region-level rewards.

### QA-003: Player can accumulate unspent stat points without a prompt — mitigated

Severity: low
Area: UX

After first region, the player still has unspent stat points, but this is now surfaced more clearly.

Implemented changes:

- `Open Character` gets a highlighted `has-points` state when `statPoints > 0`;
- quest reward text includes a prompt to open Character when new points are available.

Remaining follow-up: add a one-time tutorial callout the first time the player levels up.

### QA-004: Inventory becomes noisy with repeated consumables and treasures — mitigated

Severity: low/medium
Area: inventory/economy

Before the fix, final inventory contained repeated `revisionTea` and multiple `civicGem` entries.

After the fix, `civicGem` is treated as duplicate-limited treasure, so repeated quest rewards no longer add multiple copies. `revisionTea` still stacks as a consumable.

Remaining follow-up:

- mark stackability explicitly in item data;
- add Backpack category filters/sorting;
- replace some repeated consumable rewards with regional collectibles.

### QA-005: All quests in Village are available from the start — fixed

Severity: design observation
Area: progression

Before the fix, all 15 Village quests could be accepted immediately.

Implemented change:

- each NPC now exposes only their next incomplete quest; later quests are disabled until earlier quests for that NPC are complete.

Remaining follow-up: add explicit `Story` / `Side` labels in Quest Log.

### QA-006: Mini-games are not part of this first-region quest flow — mitigated

Severity: design observation
Area: Phase E integration

Before the fix, mini-games were only menu-driven.

Implemented change:

- Priya now has a visible NPC menu entry: `Mini-game: Petition Regatta`.

Remaining follow-up: add a visible map marker/prop and a quest objective that explicitly directs the player to the mini-game.

## Remaining Non-Blocking Issue

### QA-007: Automated test does not validate walking routes

Severity: QA limitation
Area: test coverage

The pass validates that NPCs can be interacted with when the player is placed at a valid nearby position where `findInteractable()` returns that NPC. It does not prove that a human player can walk from spawn to each NPC without confusion or obstacles.

Suggested fix:

- Add pathfinding-based reachability checks from spawn to each NPC, building door, Travel Gate, and mini-game trigger.
- Add a manual movement QA pass for the first region.
- Save screenshots for desktop and mobile layouts.

## Answer Randomization Check

The post-fix run confirmed visible answer order is not always correct-first. Example rendered orders from quest turn-ins:

- `1,0,2`
- `0,1,2`
- `2,1,0`
- `2,0,1`

Travel Gate rendered orders:

- `0,2,1`
- `1,0,2`
- `0,1,2`

This confirms the shuffle layer is active while the correct answer mapping remains intact.

## Recommended Next Fix Order

1. Add pathfinding QA from spawn to all Village NPCs and Travel Gate.
2. Add a visible map marker/prop for Priya's mini-game.
3. Add a one-time level-up tutorial callout.
4. Add explicit item `stackable` metadata and Backpack category filters.
5. Add `Story` / `Side` labels in Quest Log.
