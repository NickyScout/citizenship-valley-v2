# Balance Review

Date: 2026-06-04
Scope: F5 balance review for XP, Focus, coins, and Exam Readiness after the P2 QA automation suite.

## Inputs

The review used current automated reports:

- `qa-first-location-playthrough-result.json`
- `qa-regional-quests-playthrough-result.json`
- `qa-regional-playthrough-result.json`

The most useful signal came from `qa-regional-quests-playthrough.mjs`, which completes 30 post-Village regional quests and travel gates through the real UI flow.

## Findings

- Post-Village generated quests previously awarded `Revision Tea` on every quest, producing a noisy inventory with roughly 30 extra consumables after the regional quest pass.
- Post-Village generated quests also left the player with 240 coins in the regional quest-only pass, before optional mini-game income.
- Focus pressure is meaningful but not blocking: the regional quest-only pass ends at 10 Focus after 30 quests.
- XP/level pacing is usable for the current prototype: the regional quest-only pass ends at level 7 with 6 unspent stat points if the player never opens Character.
- Exam Readiness reaches the cap after full regional quest completion, which is acceptable for a player who completes every post-Village region before the final exam.

## Change Made

Generated post-Village topic quests now use:

```js
reward: { coins: 8 }
```

instead of awarding coins plus `Revision Tea` every time.

The Village-specific quest rewards were kept stable.

## Current Automated Result

After the change, `qa-regional-quests-playthrough.mjs` reports:

- `blockingIssues: 0`
- `regions: 6`
- `completedQuestCount: 30`
- `finalLocation: examHall`
- saved coins after post-Village regional quest pass: `180`
- inventory after post-Village regional quest pass: starter items plus selected outfit, without repeated `Revision Tea` spam
- final Focus: `10/100`
- final level: `7`

## Remaining Balance Notes

- A full manual run that combines Village quests, regional quests, study stations, vendors, and optional mini-games should still be reviewed before a polished release.
- `statPoints` can accumulate if the player ignores Character; the UI already highlights available points, but a future tutorial callout may help.
- Optional mini-games and vendor purchases can still change coin pacing substantially; revisit prices when adding more collectible items or visual assets.