# План разработки Citizenship Valley V2

Активный рабочий план новой графической версии. Главная цель V2 — **качественный скачок графики**, в первую очередь на игровом поле (локации, персонажи, фоновая жизнь), затем здания, UI/меню, мини-игры и более разнообразный обучающий процесс. Все геймплейные системы V1 сохраняются как фундамент.

- **Контекст:** репозиторий и SWA `citizenship-valley-v2`, версия `2.0.0`, live `https://black-grass-036ec2d03.7.azurestaticapps.net`.
- **Сопутствующие доки:** текущие фичи — `docs/PROJECT_FEATURES.md`; история, ключевые решения, арт-направление и hard-won уроки — `docs/DEVELOPMENT_HISTORY.md`; авторитетное техническое состояние и рецепт деплоя — `docs/AI_HANDOFF.md` §0; визуальные конвенции — `docs/VISUAL_STYLE_GUIDE.md`.
- Этот документ — живой: обновляйте статус этапов по мере выпуска.

---

## 0. Отправная точка (аудит кода, 2026-06-17)

Сверено по `game.js` и `assets/`, чтобы план опирался на факт, а не на унаследованные из V1 заметки.

**Что уже реализовано и работает (фундамент, не ломать):**

- **Технический фундамент рендера готов.** В `loop()` есть честный delta-time (`frameDeltaMs`, `animationClockMs`, кламп ≤100 мс), общий `imageCache`/`getAssetImage`, `AnimatedSprite`-хелпер. Конвейер кадра: `draw()` → `drawWorld()` (`drawGroundLayer` → `drawPathLayer` → `drawBuildingLayer` → `drawPropLayer` → `drawAmbientLayer` → `drawCharacterLayer` → `drawUiWorldLayer`) → `drawAtmosphereOverlay()` → `drawScreenUi()`.
- **Delta-time апдейты уже в цикле:** `updateAmbientWalkers`, `updateRegionPet`, `updateNpcChatter`, `updateFootstepDust`, мини-игровые `updateMiniGameCatcher/Sorter`, региональный transition-fade.
- **Террейн:** `drawTile` тянет `TILE_ASSETS` (6 базовых SVG: grass/road/plaza/water/dock/wall) с примитивным fallback; автотайлинг кромок есть (`drawTileEdges` → `drawWaterFoam`/`drawBeachEdges`/`drawPavingEdges`).
- **Герой:** `drawHeroSpriteAsset` использует `hero-base-spritesheet.svg` (4 направления × 4 кадра) с процедурным fallback `drawHero*`; сверху слои outfit/hair/cap/scarf/side-arm + held-tool + флаг.
- **NPC:** `drawPerson` + `npcAppearance` (кэш по id) + ролевой реквизит `drawNpcRoleKit` по карте `NPC_ROLE`; z-сортировка по `y`; ambient-walkers и speech-bubbles на тему региона.
- **Атмосфера:** `drawAtmosphereOverlay` (color grade + виньетка + верхний свет), `drawAmbientLayer` (частицы, дым труб, footstep dust) — всё гейтится Reduced Motion.
- **Здания:** типизированы по `kind` (`townhall`/`court`/`library`/`police`/`garden`/`press`/`campaign`/`generic`) с разными крышами/входами; интерьеры — по `interiorTheme` (`council`/`police`/`court`/`press`/`campaign`/`library`/`garden`).
- **Пропы:** `drawProp` → `drawPropAsset` (`PROP_ASSETS`, PNG trigger-пропов) с fallback.

**Главные пробелы графики (объём работы V2):**

- **NPC и здания полностью процедурные (`rect`-арт).** В `assets/characters/` нет спрайт-листов NPC; `assets/buildings/` пуст (только `.gitkeep`). Узнаваемость держится на ролевом реквизите и силуэте крыши, но не на настоящем арте.
- **Тайлсет минимальный.** 6 базовых тайлов, нет дерева (`T` рисуется примитивом), нет вариаций/декалей, нет региональных подпалитр тайлов, нет «настоящего» спрайтового дерева/зелени.
- **Герой — один базовый лист.** Нет idle-кадров/бега/emote; кастомизация делается перекраской overlay поверх фиксированного базового листа.
- **UI/HUD/мини-игры** — DOM+CSS «прототип-стиль»; для мини-игр есть тематические SVG-баннеры (`assets/minigames/`), но нет цельного арт-стиля карточек/досок и canvas-анимаций.
- **Ассеты по папкам:** заполнены `items/` (PNG+SVG), `props/region/` (trigger PNG+SVG), `minigames/` (SVG-баннеры), `tiles/` (6 SVG), `characters/` (1 hero-лист + портреты), `story/` (apathy-shade), `ui/` (маркер). Пусты: `buildings/`, спрайты NPC.

Вывод: **технический каркас V1 уже покрывает большинство пунктов «фундамента» старого плана** — V2 не строит его заново, а наполняет **настоящим артом** и поднимает планку, начиная с игрового поля.

---

## 1. Принципы и инварианты (на каждый этап)

Рабочие правила (полнее — в `docs/DEVELOPMENT_HISTORY.md`):

- Static HTML/CSS/JS, без фреймворков и сборщиков; лёгкий вес для Azure Static Web Apps.
- **Каждый новый арт обязан иметь primitive/SVG fallback** (как `drawPropAsset`/`drawTile`), чтобы игра не «чернела» и проходила visual smoke при отсутствии/недогрузке изображения.
- **Совместимость сейвов:** `SAVE_VERSION` бампать только при изменении схемы; новые визуальные поля — с дефолтами через `migrateSave`. Чистый рендер/таймеры save-схему не трогают.
- **Достижимость — инвариант:** ASCII-карты `WORLD_LAYOUTS[*].map` и коллизии не меняем в графических этапах; каждый вход в здание достижим; NPC-host/двери/гейты/study stations/trigger-пропы достижимы; ambient-walkers не солидны игроку и не паркуются на дверях/гейтах/спавне.
- **Reduced Motion** отключает всю ambient-анимацию (частицы, walkers, chatter, дым, transition).
- Сохраняем клавиатурное управление и dev travel menu.
- Контент (тексты, реплики, мини-игры) — точный и age-appropriate; источник пояснений — `curriculum.js`.
- **Deploy — только по явному запросу.** Бамп семантической версии `2.0.x` (5 маркеров в `index.html`); токен не печатать/не коммитить; `dist/` собирается из корня.

---

## 2. Художественное направление (кратко)

Полное арт-направление — в `docs/DEVELOPMENT_HISTORY.md` → «V2 art direction». Ключевое:

1. Арт в логическом масштабе (тайл `32px`, экран `×1.5`), PNG с прозрачностью + SVG-исходники рядом.
2. Мастер-палитра и региональные подпалитры — ведём в `docs/VISUAL_STYLE_GUIDE.md`.
3. Интерактивные объекты — единый мягкий контур + тень; декор — без контура.
4. Глубина: овальные тени, лёгкий ambient occlusion у оснований, z-сортировка по `y`.
5. Региональная идентичность через силуэт (landmark, мощение, зелень/вода, «виды» зданий), а не только цвет.
6. Производительность важнее эффектности: спрайт-листы вместо россыпи `rect`, выключаемые ambient-эффекты, бюджет ассетов, цель 60 FPS.

---

## 3. Этапы V2

Каждый этап — отдельная, маленькая, ревью-пригодная задача с QA-гейтом (§4). Порядок — по приоритету пользователя: **игровое поле первым**. Внутри этапа: сперва ввести ассет + `*_ASSETS`-карту с fallback, затем подключить в рендер, затем расширить QA (наличие файлов/манифест), затем — по запросу — deploy с бампом версии.

### V2-1 — Террейн и зелень (ПРИОРИТЕТ)

Довести тайлсет с 6 базовых до узнаваемого биом-набора.

- Спрайтовое **дерево/куст** (`T`) вместо примитива; контактная тень; лёгкое покачивание под не-Reduced-Motion.
- 2–4 **вариации** базовых тайлов + редкие декали (цветы, трещины, брусчатка, листья) детерминированно по `hashNoise` (без «шума» каждый кадр).
- **Региональные подпалитры** тайлов (трава/вода/мощение различаются по регионам) — усилить идентичность без смены карт.
- Улучшить воду (рябь/блики) и берег у `~`-кромок (Participation Harbour) поверх уже существующего `drawWaterFoam`/`drawBeachEdges`.
- Файлы: `game.js` (`drawTile`, `drawTileEdges`, `drawTileVariation`, `drawGroundLayer`), `assets/tiles/` (новые SVG/PNG), `scripts/validate-world.js` (наличие новых tile-ассетов). Инвариант: карты/коллизии без изменений.

### V2-2 — Главный герой: расширенный спрайт-лист (ПРИОРИТЕТ)

- Idle-кадры (дыхание/покачивание), опционально бег и interact/emote-кадр поверх текущего walk.
- Кастомизация без рассинхрона: тинт базового листа по `profile`/`outfit`/`accent` ИЛИ отдельные пресет-листы; выбранный пресет совпадает в мире и портрете.
- Мягкая овальная тень, плавный поворот; held-tool/флаг остаются отдельным слоем.
- Микро-feedback: пыль под ногами (есть `footstepDust`), «искра» при входе в зону взаимодействия (`drawInteractionRangeHighlight`).
- Файлы: `game.js` (`drawHeroSpriteAsset`, `drawPlayer`, `heroBaseSprite`/`AnimatedSprite`, overlay-функции), `assets/characters/`. Инвариант: портрет-синхронизация и save-схема не меняются. Fallback `drawHero*` сохраняем.

### V2-3 — NPC: настоящий арт + распознаваемость (ПРИОРИТЕТ)

Главный пробел: NPC сейчас целиком `rect`-арт.

- Ввести **спрайтовые тела/силуэты по роли** (vendor, official/судья, editor, officer, youth worker, campaigner, elder и т.д.) с тинтом по `npcStyle`; держать текущий `drawNpcRoleKit` как слой реквизита поверх.
- Idle-вариации и направление взгляда к игроку/площади (часть уже есть у walkers).
- Сохранить инварианты: ходячими остаются только ambient-walkers без квестов; quest-giver/host/vendor/story-NPC — на якорях.
- Расширить пул on-topic реплик (`updateNpcChatter`) при необходимости, без перекрытия quest/`E`-маркеров.
- Файлы: `game.js` (`drawPerson`, `npcAppearance`, `drawNpcRoleKit`, `drawCharacterLayer`), данные NPC (`role`/`facing`), `assets/characters/`. Инвариант: маршруты/достижимость/`E`-надёжность сохраняются; `qa-regional-*` проходят.

### V2-4 — Атмосфера и «жизнь» локаций

- Усилить уже существующий `drawAmbientLayer`/`drawAtmosphereOverlay`: больше регионально-специфичных частиц/бликов, мягкие тени от зданий/деревьев на землю.
- Дополнительные idle-активности NPC (подметание, чтение доски, жест разговора) у не-walkers.
- Файлы: `game.js` (`drawAmbientLayer`, `drawAtmosphereOverlay`, idle-логика). Инвариант: всё под Reduced Motion; без влияния на коллизии/сейвы. (Можно совмещать с V2-1…V2-3.)

### V2-5 — Экстерьеры зданий: арт по назначению

`assets/buildings/` пуст — здания полностью процедурные.

- Ввести **PNG/SVG экстерьеры на `kind`** (townhall/court/library/police/garden/press/campaign/generic) с узнаваемыми силуэтами и входными группами; `BUILDING_ASSETS` + fallback на текущий `drawBuilding`/`drawBuildingRoof`.
- Вывески/орнаменты не перекрывают двери и NPC (см. правило world-маркеров в HISTORY).
- Файлы: `game.js` (`drawBuilding`, `drawBuildingRoof`, `drawBuildingEntrance`, новый `BUILDING_ASSETS`), `assets/buildings/`, `scripts/validate-world.js` (наличие ассетов). Инвариант: достижимость дверей; `audit-map`/`qa-route-audit` зелёные.

### V2-6 — Интерьеры по назначению

- Тематический арт `drawInteriorDecor` под каждый `interiorTheme`; расстановка props и study stations по назначению (уже есть 7 тем — наполнить артом).
- Файлы: `game.js` (`drawInteriorDecor`, `drawStudyStations`), `assets/buildings/` (интерьерные элементы). Инвариант: достижимость интерьерных выходов и study stations; `validate-ui`/`validate-world` зелёные.

### V2-7 — UI / HUD / инвентарь / Character

- Арт-фреймы панелей, иконки, наглядный Character; расширенные предметные ассеты (часть `assets/items/` уже есть).
- Файлы: `styles.css`, `index.html` (фреймы/иконки, cache-bust), `game.js` (UI-рендеры), `assets/ui/`, `assets/items/`. Инвариант: `validate-ui` smoke; overlay-менеджер; desktop/mobile компоновка без overflow.

### V2-8 — Мини-игры: арт и анимации

- Тематический арт карточек/досок поверх существующих SVG-баннеров (`assets/minigames/`), canvas-анимации, medal-экран.
- Файлы: `game.js` (`MINI_GAMES`-рендеры, canvas-степы), `assets/minigames/`. Инвариант: `qa-regional-playthrough`/`qa-regional-quests-playthrough` проходят для всех мини-игр.

### V2-9 — Обучение: глубина и разнообразие (параллельно с V2-7/8)

- Разнообразить форматы проверки и обратную связь «почему» (есть «Why this matters», mastery, spaced review — расширить покрытие и форматы).
- Источник тем/пояснений — `curriculum.js`; контент точный и age-appropriate.
- Файлы: `game.js` (квесты/проверки/review), `curriculum.js`. Инвариант: `validate-world` (квесты), curriculum-проверки; save-схема — с дефолтами при необходимости.

### V2-10 — Полировка и производительность

- Перф-пасс (бюджет ассетов, ленивая загрузка по региону, кэш изображений), accessibility-проверки, финальный визуальный проход.
- Файлы: широкий. Инвариант: полный QA + release smoke.

---

## 4. QA-гейт на каждый этап

- `node --check game.js`, `node --check curriculum.js`.
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`.
- После изменений карт/пропов: `node scripts\audit-map.js --write`, `node scripts\qa-route-audit.js --write`.
- `node qa-visual-smoke.mjs` (desktop/mobile, non-blank canvas, no overflow).
- При изменениях NPC: `node qa-regional-playthrough.mjs`, `node qa-regional-quests-playthrough.mjs`.
- Перед релиз-кандидатом: `node qa-release-smoke.mjs`.
- Полный набор команд — `docs/QA_RUNBOOK.md`.
- Дополнять QA новыми инвариантами этапа: наличие новых файлов ассетов / валидность спрайт-манифеста (как уже сделано для `PROP_ASSETS`/`TILE_ASSETS`), границы patrol-зон, отсутствие конфликтов walker↔door.

Узел prefix перед node-командами:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
```

---

## 5. Список файлов и ожидаемые изменения

- `game.js` — спрайт/тайл-рендер и `*_ASSETS`-карты, `drawTile`/автотайлинг, `drawHeroSpriteAsset`/overlays, `drawPerson`/`npcAppearance`/`drawNpcRoleKit`, `drawBuilding`(+`BUILDING_ASSETS`), `drawInteriorDecor`, `drawAmbientLayer`/`drawAtmosphereOverlay`, UI-рендеры, мини-игровые степы, квесты/проверки. Карты `WORLD_LAYOUTS[*].map` и коллизии — без изменений в графических этапах.
- `curriculum.js` — темы реплик, пояснения, форматы проверки (V2-9).
- `styles.css`, `index.html` — арт-фреймы панелей, иконки, портрет, 5 cache-bust маркеров `2.0.x`; canvas-размер не меняем без необходимости.
- `assets/tiles/`, `assets/characters/`, `assets/buildings/` (пуст сейчас), `assets/items/`, `assets/ui/`, `assets/minigames/`, `assets/props/region/` — новый арт (PNG + SVG-исходники), всё с fallback.
- `scripts/validate-world.js`, `scripts/qa-route-audit.js`, `scripts/validate-ui.js` — новые инварианты (наличие файлов, patrol-зоны, манифесты).
- Доки: `docs/VISUAL_STYLE_GUIDE.md` (палитра/конвенции/анимация), `docs/PROJECT_FEATURES.md`, `docs/DEVELOPMENT_HISTORY.md`, этот файл — по мере выпуска этапов.

---

## 6. Рекомендуемый порядок

1. **V2-1 → V2-2 → V2-3** — игровое поле (террейн/зелень, герой, NPC) — главный приоритет.
2. **V2-4** — атмосфера/жизнь (совмещается с 1–3).
3. **V2-5 → V2-6** — здания снаружи и внутри.
4. **V2-7 → V2-8** — UI/инвентарь/Character и мини-игры.
5. **V2-9** — обучение (параллельно с 7–8).
6. **V2-10** — полировка/перф и, по явному запросу, deploy.

**Критерий успеха V2:** узнаваемые, живые локации (разный террейн и зелень, анимированный герой, спрайтовые NPC и фоновая жизнь), **разные здания снаружи и тематические интерьеры внутри**, более богатые меню/инвентарь/мини-игры и разнообразный, понятный обучающий процесс — при сохранении лёгкости, совместимости сейвов и стабильного цикла «регион → NPC → активность → награда → прогресс».
