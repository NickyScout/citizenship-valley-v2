# Copilot repository instructions

This repository contains Citizenship Valley, a static browser RPG prototype for UK GCSE Citizenship revision. The app is plain HTML, CSS, and JavaScript with canvas rendering; there is no backend, database, framework, or auth system.

Use these instructions for all Copilot agent work in this repo:

- Keep changes small, focused, and easy to review.
- Prefer existing patterns in `game.js`, `styles.css`, `index.html`, and `curriculum.js`.
- Do not introduce frameworks, bundlers, TypeScript, backend services, or large architecture changes without explaining why the trade-off is worth it.
- Never commit secrets, Azure deployment tokens, credentials, or private local machine data.
- Keep GCSE Citizenship learning content accurate and age-appropriate.
- Prefer `curriculum.js` for editable curriculum explanations and `CURRICULUM_MAP.md` for broader planning notes.
- Preserve existing keyboard controls when adding new input methods.
- Keep the developer travel menu unless explicitly asked to remove it.
- For map changes, verify that player spawn points and NPC positions are reachable and not blocked by water, buildings, trees, or collision tiles.
- For UI changes, check desktop and mobile layouts and avoid overlapping text or controls.
- Run available checks before finishing. At minimum, use `node --check game.js` and `node --check curriculum.js` when JavaScript changes.
- If no formal tests exist for the changed behavior, mention that limitation and add a small focused check when practical.

Important files:

- `index.html` - static page shell and HUD containers
- `styles.css` - layout, HUD, dialogue, touch controls
- `game.js` - game loop, rendering, world data, movement, quests, inventory, save/load
- `curriculum.js` - GCSE curriculum topics and expanded correct-answer explanations
- `docs/AI_HANDOFF.md` - detailed handoff context for future coding agents
- `AGENTS.md` - practical repository instructions for agents

Manual deploy target:

- Azure Static Web Apps: `citizenship-valley-v2` (resource group `rg-citizenship-game`)
- Public URL: `https://black-grass-036ec2d03.7.azurestaticapps.net`
- GitHub repo: `NickyScout/citizenship-valley-v2`

Do not include deployment secrets in code, docs, commits, logs, or PR descriptions.
