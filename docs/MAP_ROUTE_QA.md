# Map Route QA

Generated route QA for Map Phase 5. This report checks reachability from each exterior region spawn to landmarks/signs, NPCs, building doors, mini-game hosts, mini-game trigger props, travel-gate hosts, and Exam Hall practice rooms.

Status: passed
Generated: 2026-06-12T20:10:31.947Z

| Region | Signs | NPCs | Doors | Mini-game Hosts | Trigger Props | Travel Gate Hosts | Exam Rooms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Citizenship Village | 2/2 passed | 5/5 passed | 4/4 passed | 1/1 passed | - | 5/5 passed | - |
| Modern Britain Borough | 3/3 passed | 5/5 passed | 4/4 passed | 1/1 passed | 1/1 passed | 5/5 passed | - |
| Rights & Law Quarter | 3/3 passed | 5/5 passed | 4/4 passed | 1/1 passed | 1/1 passed | 5/5 passed | - |
| Democracy Capital | 4/4 passed | 5/5 passed | 4/4 passed | 2/2 passed | 2/2 passed | 5/5 passed | - |
| Participation Harbour | 4/4 passed | 5/5 passed | 4/4 passed | 1/1 passed | 1/1 passed | 5/5 passed | - |
| Action Workshop | 4/4 passed | 5/5 passed | 4/4 passed | 1/1 passed | 1/1 passed | 5/5 passed | - |
| Exam Hall Castle | 4/4 passed | 5/5 passed | 5/5 passed | 2/2 passed | 2/2 passed | - | 5/5 passed |

## Issues

- None

## Manual Follow-up

- Automated route QA checks reachability, not subjective visual clarity.
- Use Dev Travel for a short manual pass across all exterior regions after layout or asset changes.
- Re-run `node scripts\qa-route-audit.js --write`, `node scripts\validate-world.js`, and `node qa-visual-smoke.mjs` after map changes.
