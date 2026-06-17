# Citizenship Valley

An indie-style GCSE Citizenship revision RPG inspired by cosy top-down games.

Version 2 is a new-graphics overhaul of the V1 prototype; all V1 gameplay systems carry over as the foundation.

Live site: <https://black-grass-036ec2d03.7.azurestaticapps.net>

## Play

Open `http://127.0.0.1:5173/index.html` while the local preview server is running.

Run local world validation before publishing changes:

```powershell
node .\scripts\validate-world.js
```

For the full local QA suite, see [docs/QA_RUNBOOK.md](docs/QA_RUNBOOK.md).

Controls:

- `WASD` or arrow keys: move
- `E`: talk or inspect
- `1`, `2`, `3`: answer a challenge

## Chapter 1 Topics

The first playable chapter introduces:

- UK Parliament and democracy
- Peaceful participation and campaigning
- Rights and responsibilities
- The rule of law
- Active citizenship projects

Each villager gives a short revision explanation, then asks a quick GCSE-style check question. Correct answers award knowledge and a badge.

## Full Course Map

See `CURRICULUM_MAP.md` for the planned full GCSE Citizenship game world. The course is split into regions:

- Citizenship Village
- Modern Britain Borough
- Rights & Law Quarter
- Democracy Capital
- Participation Harbour
- Action Workshop
- Exam Hall

Current implementation:

- All seven regions exist in the game data.
- Each region has its own NPC cast and curriculum-linked quests.
- Every region must be cleared before the travel gate opens.
- The travel gate asks three questions from the current region.
- A wrong gate answer blocks travel until the player tries again.
- Exam Hall includes five practice rooms for identify, describe, explain, evaluate, and source usefulness questions.

## RPG Systems

- Each NPC now offers three curriculum-linked investigation quests.
- Quest flow: accept a task, visit another NPC for evidence, return, then answer a check question.
- Rewards include coins, outfits, tools, and treasures.
- Items are stored in the inventory panel.
- Outfits and tools can be equipped.
- Consumables can be used for a knowledge boost.
- Unequipped valuables can be sold while standing near another NPC.
- Progress is saved automatically in browser `localStorage`.
- Use `R` or the `New Game` button to delete saved progress and restart.

## Rendering

- Canvas resolution is `1280x768`.
- The world renders with a camera and a 1.5x pixel scale, so 32px logical tiles appear as 48px tiles.
- Player and NPC sprites are drawn at a larger, more detailed 32x48-style scale.
- Rendering is split into layers: ground, paths, buildings, props, characters, and world UI.
- Future PNG assets are reserved under `assets/tiles`, `assets/characters`, `assets/buildings`, and `assets/props`.

## Next Chapter Ideas

- Election systems and political parties
- Civil and criminal law
- Pressure groups and media influence
- Local government and public services
- Exam practice mode with timed long-answer planning
