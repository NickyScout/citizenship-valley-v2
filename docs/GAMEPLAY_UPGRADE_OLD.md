> **АРХИВ.** Этот документ — предыдущий план (фазы A–F и Map Phase 1–5), закрытый первым проходом. Он сохранён как исторический контекст и переименован из `GAMEPLAY_UPGRADE_PLAN.md`. Актуальный план новой графической версии — `docs/GAMEPLAY_UPGRADE_PLAN.md`.

# План улучшения геймплея Citizenship Valley

Документ описывает цельный план превращения текущего прототипа в полноценное обучающее RPG-приключение по подготовке к GCSE Citizenship. Цель: сохранить и усилить обучающий слой, добавив сюжет, прогресс, RPG-механики, инвентарь, мини-игры и кастомизацию героя — так, чтобы игрок ощущал классическую игровую петлю, а не «учебник в окне».

План разбит на фазы, каждую фазу можно поставить отдельной задачей. В конце документа есть чек-листы, мини-спека сохранения, и список конкретных правок по файлам.

## Текущая позиция

**Мы находимся здесь:** §22 Map Phase 5 «QA маршрутов» закрыт первым проходом: `scripts/qa-route-audit.js` и `docs/MAP_ROUTE_QA.md` проверяют маршруты от spawn к signs/landmarks, NPC, doors, mini-game hosts, trigger props, travel-gate hosts и Exam Hall practice rooms. Следующий практический шаг — выбрать deploy/manual smoke или следующий gameplay expansion.

Все разделы выше актуального маркера `>>> МЫ ЗДЕСЬ` ниже закрыты в текущем реализованном проходе и синхронизированы в `publish/`. Публичный Azure deploy после §20.4/Map Phase 1 не выполнялся; deployment smoke остаётся `not-run` до явного запроса на deploy. Подробный журнал шагов ведётся в `docs/GAMEPLAY_PROGRESS_LOG.md`.

---

## 1. Видение и принципы

- Жанр: top-down indie-RPG с обучающим ядром по UK GCSE Citizenship.
- Главный цикл: «исследуй регион → встречай NPC → проходи мини-задание/мини-игру → получай знания, предметы, монеты, опыт → улучшай шанс сдать экзамен → продвигайся по сюжету».
- Не превращать игру в тест: проверка знаний всегда упакована в действие (мини-игру, разговор, выбор, расследование).
- Сохранить уже работающее:
  - Static HTML/CSS/JS, без фреймворков и бэкенда.
  - Канвас-рендер, существующие регионы, NPC, двери зданий, интерьеры, dev-travel меню.
  - Сохранение в `localStorage`.
  - Деплой на Azure Static Web Apps.
- Все обучающие материалы и пояснения держим в `curriculum.js`. Игровая логика — в `game.js`. UI-куски — в `index.html` + `styles.css`.

---

## 2. Сюжет (предистория, ход, финал)

### 2.1 Предистория
- Долина Citizenship Valley стояла на принципах участия, прав и закона.
- Постепенно регионы стали терять «искры участия» — символ активного гражданства. NPC перестали слышать друг друга, мини-игры рассыпались, экзаменационный замок (Exam Hall Castle) запечатан.
- Главный герой — ученик школы, который только что получил «Свиток Гражданина» (Citizen Scroll) и должен пройти путь по регионам, собрать утерянные искры и подготовиться к финальному экзамену.

### 2.2 Сюжетные акты
1. Акт 1 — Деревня (Citizenship Village)
   - Знакомство с управлением, диалогами, инвентарём.
   - Получение базового набора предметов и монет.
   - Первая встреча с антагонистом — «Тень Апатии» (Apathy Shade): не злодей-человек, а абстрактная сила безразличия.
2. Акт 2 — Modern Britain Borough
   - Темы идентичности, прессы, миграции.
   - Появление союзников-журналистов и историков.
   - Мини-игра «Проверь источник».
3. Акт 3 — Rights & Law Quarter
   - Сюжетный суд: герой защищает невиновного NPC.
   - Мини-игра «Сопоставь право и ответственность».
4. Акт 4 — Democracy Capital
   - Сюжетные выборы и дебаты.
   - Мини-игра «Подсчёт голосов» и «Парламентский билль».
5. Акт 5 — Participation Harbour
   - Сбор подписей под петицией, координация волонтёров.
   - Мини-игра «Петиционная регата».
6. Акт 6 — Action Workshop
   - Подготовка собственной кампании: исследование → план → действие → оценка.
   - Мини-игра «План кампании».
7. Финал — Exam Hall Castle
   - Финальный экзамен из 5 типов вопросов (Identify, Describe, Explain, Evaluate, Source).
   - Шанс успеха зависит от характеристик героя (см. §5).
   - Несколько концовок (см. §2.3).

### 2.3 Концовки
- Bronze Citizen: экзамен сдан с минимальным баллом.
- Silver Citizen: сданы все темы и сделан минимум 1 социальный выбор.
- Gold Citizen: все темы, все мини-игры, все «искры» собраны, баланс между правами и обязанностями соблюдён.
- Каждый финал — отдельный экран с иллюстрацией (canvas-сцена), кратким эпилогом и кнопкой New Game+.

---

## 3. Стартовый экран и кастомизация

### 3.1 Стартовый поток
1. При первом запуске вместо мгновенной игры показывается титульный экран.
2. Кнопки: `New Game`, `Continue` (если есть сейв), `Credits`, `Settings`.
3. `New Game` ведёт к экрану кастомизации.

### 3.2 Кастомизация героя
- Поля ввода:
  - Имя (1–16 символов, безопасная фильтрация HTML).
  - Пол персонажа (boy/girl) — 4 пресета на каждый пол.
  - Костюм: school, hoodie, sport, traditional.
  - Цвет акцента (4 варианта).
- Технически: новый объект `state.profile = { name, presetId, gender, outfit, accent }`.
- Рендер героя через сборку слоёв на канвасе (база + причёска + одежда + акцент). На первом этапе можно начать с цветовых вариаций существующего спрайта.

### 3.3 Стартовый инвентарь
- 30 монет.
- Школьный ранец (контейнер инвентаря).
- Записная книжка (открывает Journal/Progress панель).
- 1 «Revision Tea» (восстанавливает Knowledge focus).
- 1 «Citizen Scroll» — сюжетный предмет, нельзя продать.

---

## 4. Инвентарь и экономика

### 4.1 Инвентарь
- Категории: `quest`, `consumable`, `equipment`, `collectible`.
- Слоты: Outfit, Tool, Badge.
- UI: новая панель «Backpack» (кнопка `I` или Tab) рядом с журналом, две колонки — список и описание выбранного предмета.
- Каждый предмет: `{ id, name, type, slot?, description, value, stackable, effect? }`.
- Эффекты:
  - `+knowledgeFocus`, `+stat.X`, `+examLuck`, `unlockClue`.

### 4.2 Магазины и обмен
- В каждом регионе один NPC-торговец (можно переиспользовать существующих, добавив роль `vendor`).
- Покупка/продажа за монеты.
- Часть предметов выдаётся только за квесты, не продаётся.

### 4.3 Источники монет
- Завершение мини-игр.
- Победа в дебатах.
- Помощь NPC (короткие side-quests).
- Найденные «гражданские карточки» — коллекционные предметы по темам curriculum.

---

## 5. RPG-характеристики и шанс на экзамене

### 5.1 Характеристики
- `knowledge` — академические знания (растёт от правильных ответов, чтения досок, изучения интерьеров).
- `rhetoric` — навык аргументации (растёт от дебатов, диалогов с выбором).
- `empathy` — социальный навык (растёт от помощи NPC, моральных выборов).
- `integrity` — устойчивость к манипуляциям (растёт от заданий, где нужно отличить мнение от факта).
- `focus` — расходуемый ресурс на ход, восстанавливается чаем/отдыхом.
- `xp` и `level` — общий уровень героя (1–10).

Все хранятся в `state.stats = { knowledge, rhetoric, empathy, integrity, focus, xp, level }`.

### 5.2 Прокачка
- Каждое верное завершение мини-игры или квеста даёт XP и точечный прирост соответствующего стата.
- На каждом уровне игрок получает 1 свободное очко, которое можно вложить в любой стат через панель Character.

### 5.3 Шанс сдать экзамен
- Формула (черновая):
  - `examChance = clamp( 35 + knowledge * 0.6 + rhetoric * 0.4 + empathy * 0.2 + integrity * 0.3 + collectedSparks * 1.5, 0, 95 )`
- Отображается в HUD как «Exam Readiness: NN%».
- На финале: бросок против `examChance` определяет максимально доступную концовку, но игрок всё равно отвечает на вопросы — броски лишь дают «второй шанс» и подсказки.

---

## 6. Прогресс и журнал

### 6.1 Меню Progress
- Отдельная панель `P` или вкладка в HUD.
- Разделы:
  - Story: текущая глава, краткий пересказ, следующая цель.
  - Quests: активные / выполненные / провалённые.
  - Buildings Journal: записи по каждому зданию (уже есть основа — расширить).
  - Mini-games: лучшие результаты, статус «не пройдено / бронза / серебро / золото».
  - Curriculum: чек-лист тем GCSE с процентом изученности.
  - Achievements: значки (см. §6.2).

### 6.2 Достижения
- 20–25 значков: «First Vote», «Source Detective», «Petition Pro», «Court Closer», «Debate Champion», «Volunteer Spirit», «Gold Citizen» и т.д.
- Хранятся в `state.achievements: Set<string>`.

### 6.3 Сохранение
- Расширить `serializeGame()` / `loadGame()` новыми полями: `profile`, `stats`, `inventoryV2`, `achievements`, `storyAct`, `sparks`, `miniGameScores`.
- Версионирование сейва: добавить `state.saveVersion` и `migrateSave(saved)` для обратной совместимости.

---

## 7. Мини-игры

Каждая мини-игра — самостоятельный модуль внутри `game.js` (или отдельный объект в `MINI_GAMES`). Все игры — короткие (1–3 минуты) и завязаны на тему GCSE.

### 7.1 Source Detective (Modern Britain)
- Игроку показывается 6 заголовков новостей; нужно отметить «надёжный/ненадёжный».
- Тренирует медиаграмотность.
- Награда: монеты, +knowledge, +integrity.

### 7.2 Rights vs Responsibilities Match (Rights & Law)
- Карточная пара-игра: соединить право с соответствующей обязанностью.
- Награда: +knowledge, +empathy.

### 7.3 Petition Regatta (Participation)
- Мини-игра на канвасе: лодка плывёт по гавани, нужно собирать подписи (зелёные искры) и избегать дезинформации (красные).
- Награда: +rhetoric, монеты.

### 7.4 Ballot Count (Democracy)
- Игроку быстро показываются бюллетени, нужно правильно подсчитать голоса по системе First Past the Post.
- Награда: +knowledge, +integrity.

### 7.5 Debate Arena (Democracy / Action Workshop)
- Пошаговая «карточная» дуэль: 3 раунда, у героя есть карты Argument / Evidence / Rebuttal / Empathy.
- Использует `rhetoric` и `empathy`.
- Награда: XP, badge.

### 7.6 Campaign Planner (Action Workshop)
- Drag-and-drop планировщик: расставить шаги Research → Plan → Action → Evaluate в правильном порядке и подобрать к ним подходящие методы.
- Награда: коллекционная карта + бонус к шансу экзамена.

### 7.7 Exam Simulation (Exam Hall)
- Финальный экзамен: 5 секций (Identify, Describe, Explain, Evaluate, Sources).
- Каждая секция = короткая мини-игра, основанная на типе вопроса.
- Итоговый балл определяет концовку.

---

## 8. UX и UI

### 8.1 HUD
- Слева сверху: имя, уровень, портрет.
- Полосы: knowledge / focus / xp.
- Цель текущего квеста (есть).
- Кнопки быстрых меню: Inventory (I), Character (C), Progress (P), Journal (J).

### 8.2 Управление
- Клавиатура: WASD/стрелки, E (взаимодействие), I/C/P/J — меню.
- Тач-управление: оставить существующее, добавить кнопки меню.
- Контроллеры — отложено.

### 8.3 Доступность
- Контрастные тексты, размер шрифта ≥14px.
- Подписи под иконками.
- Опция «крупный текст» в Settings.

---

## 9. Карта обучающего контента

- Сохранить `curriculum.js` как единственный источник правды по GCSE.
- Добавить теги к темам: `{ id, area, difficulty, statBoosts, miniGameRefs }`.
- Каждое здание/мини-игра связывается с темами через id, чтобы прогресс по теме считался автоматически.

---

## 10. Технические детали

### 10.1 Архитектура кода
- Не переходим на фреймворки.
- Внутри `game.js` выделить логические секции комментариями: `// === SECTION: STATE ===`, `// === SECTION: SAVE ===`, `// === SECTION: WORLD ===`, `// === SECTION: COMBAT/MINI-GAMES ===`, `// === SECTION: UI PANELS ===`.
- Если файл станет неудобным — разрешено вынести только данные (например, `npcs.js`, `miniGames.js`) обычными `<script>` тегами без сборки.

### 10.2 Сохранение
- `state.saveVersion = 3` после перехода на новую модель.
- `migrateSave(saved)` обновляет старые сейвы:
  - v1 → v2: подкладывает пустой `lastDoorReturn`.
  - v2 → v3: подкладывает `profile`, `stats`, `inventoryV2`, `achievements`, переносит badges.

### 10.3 Версионирование/деплой
- Каждый релиз: bump `index.html` и cache-busting токенов; синхронизация в `publish/`; rebuild `publish/dist`; deploy через root `swa.cmd`.
- Никаких токенов в коде/коммитах.

### 10.4 Локальные проверки
- `node --check game.js` и `node --check curriculum.js`.
- `publish/scripts/validate-world.js` — не трогаем, кроме явных задач по валидатору.
- Для новых критичных инвариантов писать локальные VM-чек-скрипты (как делалось для дверей).

---

## 11. Инварианты, которые нельзя сломать

- Каждое здание во всех локациях имеет минимум одну достижимую точку входа.
- NPC не стоит в радиусе взаимодействия двери (`E` не должен конкурировать).
- Dev-travel меню остаётся доступным.
- Сохранение и загрузка работают для старых сейвов через `migrateSave`.
- Никаких сетевых вызовов.

---

## 12. Фазы внедрения

### Фаза A — Каркас RPG (без мини-игр)
1. Стартовый экран, `Continue`/`New Game`/`Credits`.
2. Кастомизация: имя, выбор персонажа (4 м + 4 д), 4 костюма.
3. Стартовый инвентарь и валюта.
4. Перевод `state` на новые поля + `migrateSave`.
5. Базовый HUD: уровень, XP, focus.

### Фаза B — Прогресс и инвентарь
1. Inventory UI с категориями.
2. Quest Log / Progress / Achievements панели.
3. Минимум 10 достижений.
4. Buildings Journal: расширить до структуры по регионам.

### Фаза C — Характеристики и шанс экзамена
1. Реализовать `state.stats` и формулу `examChance`.
2. Привязать прирост статов к существующим квестам.
3. UI Character (распределение очков).
4. Отображение `Exam Readiness` в HUD.

### Фаза D — Сюжет
1. Сюжетный движок: `state.storyAct` + структуры `STORY_BEATS`.
2. Сценарии «Тень Апатии» в каждом регионе.
3. Сюжетные катсцены на канвасе (статичные кадры + текст).
4. Финальные концовки.

### Фаза E — Мини-игры
1. Source Detective.
2. Rights vs Responsibilities.
3. Petition Regatta.
4. Ballot Count.
5. Debate Arena.
6. Campaign Planner.
7. Exam Simulation (финал).

### Фаза F — Полировка
1. Звуковые эффекты (опционально, можно отложить).
2. Доступность.
3. Балансировка.
4. Финальное тестирование, чек-лист QA.

---

## 13. Чек-лист QA на каждый релиз

- [ ] `node --check game.js` и `node --check curriculum.js` — без ошибок.
- [ ] `publish/scripts/validate-world.js` — passed.
- [ ] Локальный doorway-check: все здания во всех локациях имеют достижимый вход.
- [ ] Локальный E-conflict check: NPC не пересекаются с зонами дверей.
- [ ] Создание `New Game` работает, имя и персонаж применяются.
- [ ] `Continue` корректно подхватывает старый сейв (миграция).
- [ ] Inventory, Progress, Character панели открываются и закрываются.
- [ ] Финал доступен после прохождения всех актов.
- [ ] Версия в HUD и в `publish/index.html` совпадает.
- [ ] Live-проверка после деплоя: версия и ключевые маркеры.

---

## 14. Список файлов и предполагаемые изменения

- `index.html`
  - Добавить разметку под Title Screen, Customization Screen, Inventory Panel, Character Panel, Progress Panel.
  - Кнопки меню в HUD.
  - Bump cache-bust версии при каждом релизе.
- `styles.css`
  - Стили новых панелей, экранов, кнопок.
  - Стили мини-игр (карточки, drag-and-drop, регата).
- `game.js`
  - Новые секции: `// === SECTION: PROFILE ===`, `// === SECTION: STATS ===`, `// === SECTION: STORY ===`, `// === SECTION: MINI_GAMES ===`.
  - Расширить `state`, `serializeGame`, `loadGame`, `resetGame`, добавить `migrateSave`.
  - Рендер кастомного персонажа.
  - Хуки прироста статов после квестов/мини-игр.
- `curriculum.js`
  - Добавить поля `area`, `difficulty`, `statBoosts`, `miniGameRefs` к темам.
  - Тексты для финальных концовок.
- `docs/AI_HANDOFF.md`
  - Обновить раздел архитектуры (после внедрения новых систем).
- `publish/` (синхронизация после каждой фазы).

---

## 15. Дальнейшие шаги

1. Согласовать с пользователем приоритет фаз A → F.
2. Начать с Фазы A: Title + Customization + новый стартовый инвентарь и `migrateSave`.
3. После Фазы A — выпустить релиз и собрать обратную связь, прежде чем уходить в мини-игры.

Документ живой: обновлять по мере выпуска фаз и появления решений.

---

## 16. Анализ текущей версии после внедрения фаз A-E

Текущее состояние игры уже заметно ближе к полноценной RPG-структуре, чем исходный прототип. Реализованы базовый стартовый поток, кастомизация, Backpack, Progress Center, Character Panel, Story Beats, Apathy Shade, Exam Readiness и набор мини-игр. Сохранение расширено до `SAVE_VERSION = 5`, а основные системы уже связаны между собой через `state.profile`, `state.stats`, `state.achievements`, `state.storySeen`, `state.storyEnding` и `state.miniGameScores`.

### 16.1 Что сейчас работает хорошо

- У игры появилась понятная внешняя RPG-рамка: имя героя, уровень, XP, фокус, характеристики, шанс экзамена, инвентарь, прогресс и сюжетные сцены.
- `Backpack` отделён от HUD и поддерживает слоты `Outfit` / `Hand`, что делает экипировку понятнее.
- `Progress Center` уже объединяет Story, Quests, Buildings, Mini-games и Achievements.
- Мини-игры доступны без ломки карты и старых квестов, дают награды и сохраняют лучшие результаты.
- Сюжетный слой с Apathy Shade даёт игре цель и объясняет, зачем игрок проходит регионы.
- Старые сейвы не должны ломаться: новые поля добавляются через `migrateSave`.
- Developer travel menu сохранён, что важно для тестирования регионов.

### 16.2 Главные слабые места текущей версии

- Мини-игры пока воспринимаются как отдельное меню, а не как естественная часть мира. Их нужно привязать к NPC, зданиям и регионам.
- Сюжетные сцены запускаются, но пока слабо завязаны на реальные решения игрока. Apathy Shade должен чаще реагировать на действия игрока.
- Character/Stats уже работают, но баланс XP, Focus, Exam Readiness и наград ещё черновой.
- Progress Center показывает много информации, но ему не хватает фильтров, подсказок «что делать дальше» и понятных статусов по curriculum-темам.
- Предметы имеют мини-арт и действия, но у них пока мало игровых эффектов. Большинство предметов не меняют тактику прохождения.
- Экономика простая: монеты выдаются, но тратить их почти некуда. Нужны торговцы и региональные товары.
- Финал существует, но Exam Simulation пока не является настоящим финальным экзаменом с несколькими типами вопросов и оцениванием.
- UI быстро разрастается: много overlay-панелей, поэтому нужна унификация поведения, закрытия, z-index и мобильной компоновки.
- Нет автоматизированных UI-проверок для меню, сохранения, мини-игр и переходов между регионами.

---

## 17. Приоритетный backlog улучшений после Phase E

### P0 — Исправить восприятие мини-игр как «оторванного меню»

Цель: мини-игры должны запускаться из мира, а не только из HUD.

1. Привязать мини-игры к конкретным NPC:
  - `Source Detective` — Editor Vale в Modern Britain Borough.
  - `Rights vs Responsibilities` — Advocate Farah или Judge Rowan в Rights & Law Quarter.
  - `Ballot Count` — MP Rowan / Mayor Ada / Democracy Capital NPC.
  - `Petition Regatta` — Participation Harbour NPC.
  - `Debate Arena` — Democracy Capital и Action Workshop.
  - `Campaign Planner` — Action Workshop.
  - `Exam Simulation` — Exam Hall.
2. Добавить кнопку `Mini-game` в NPC menu, если у NPC есть связанная игра.
3. В `WORLD` или NPC-data добавить поле вроде `miniGameId`.
4. В Progress → Mini-games показывать регион и NPC, у которого игра запускается.
5. Для каждой мини-игры после первого прохождения добавить короткую реплику NPC с учебным выводом.

### P0 — Сделать Exam Simulation настоящим финальным экзаменом

Цель: финал должен ощущаться как кульминация, а не обычная мини-игра.

Статус: реализован первый полноценный проход — Exam Simulation разделён на 5 секций, сохраняет section breakdown, показывает экран результата и влияет на Bronze/Silver/Gold ending вместе с Exam Readiness.

1. Разделить Exam Simulation на 5 секций:
  - Identify.
  - Describe.
  - Explain.
  - Evaluate.
  - Source.
2. Для каждой секции использовать разные типы взаимодействия:
  - выбор правильного пункта;
  - сборка ответа из частей;
  - выбор evidence;
  - оценочное заключение;
  - проверка reliability у источника.
3. Финальную концовку определять не только `examChance`, но и фактическим score Exam Simulation.
4. Добавить экран результата с breakdown по секциям.
5. Сохранять лучший Exam Simulation score в `state.miniGameScores.examSimulation`.

### P1 — Улучшить баланс RPG-статов и Focus

Цель: характеристики должны быть полезными и понятными.

Статус: начат первый проход — Focus теперь тратится на одноразовые tool assists в мини-играх, Study Stations восстанавливают Focus, а Character Panel показывает описания статов, вклад в Exam Readiness и стоимость assist.

1. Пересмотреть XP curve: сейчас уровень может расти слишком медленно или слишком быстро в зависимости от порядка прохождения.
2. Сделать Focus расходуемым ресурсом для подсказок, повторных попыток или бонусов в мини-играх.
3. Добавить отдых/восстановление Focus:
  - через `Revision Tea`;
  - через Study Stations;
  - через безопасную зону в Village.
4. Добавить tooltip/description для каждого стата в Character Panel.
5. Показывать, как конкретный stat влияет на Exam Readiness.
6. Дать игроку больше способов заработать `statPoints` или перераспределить их позднее.

### P1 — Сделать предметы более игровыми

Цель: предметы должны влиять на выбор игрока.

Статус: реализован первый проход — ключевые предметы получили `effect`, `Revision Tea` восстанавливает Focus, `Notebook` и `Citizen Scroll` открывают Progress/Story-подсказки, а `Justice Quill` и `Debate Blade` дают тематический одноразовый assist в релевантных мини-играх.

1. Добавить `effect` к предметам:
  - `Revision Tea`: +Focus.
  - `Justice Quill`: бонус к Source/Evaluate вопросам.
  - `Debate Blade`: бонус к Debate Arena.
  - `Citizen Scroll`: открывает Story/Progress подсказку.
  - `Notebook`: открывает Progress и показывает next objective.
2. Добавить regional collectibles: `Civic Cards` по темам curriculum.
3. Добавить `stackable` для consumables.
4. Разделить предметы по категориям в Backpack: Quest / Consumable / Outfit / Tool / Collectible.
5. В магазинах продавать не только текущие reward-items, но и полезные consumables.

### P1 — Экономика и торговцы

Цель: монеты должны иметь смысл.

Статус: реализован первый проход — одному NPC в каждом регионе назначена vendor-роль, Trade menu показывает региональные товары, игрок может покупать полезные предметы за монеты, а quest items нельзя продавать.

1. Назначить одному NPC в каждом регионе роль vendor.
2. Добавить список товаров по региону:
  - Village: Revision Tea, Notebook skins.
  - Modern Britain: Source Lens.
  - Rights & Law: Rights Card Pack.
  - Democracy: Debate Cards.
  - Participation: Petition Kit.
  - Action Workshop: Campaign Toolkit.
  - Exam Hall: Practice Pass / Focus items.
3. Сделать покупку через отдельную shop-панель, а не только продажу через inventory buttons.
4. Ограничить продажу quest items.
5. Добавить баланс цен, чтобы монеты не копились без применения.

### P1 — Углубить сюжетные решения

Цель: Apathy Shade должен реагировать на выборы игрока.

Статус: реализован первый проход — добавлены `state.storyFlags`, флаги выставляются через ключевые квесты и мини-игры, Progress показывает Choices against Apathy, cutscenes показывают реакцию Shade, а Silver/Gold endings требуют накопленных story choices.

1. Ввести `state.storyFlags`, например:
  - `challengedRumour`;
  - `defendedRights`;
  - `helpedVolunteer`;
  - `usedEvidenceInDebate`.
2. В мини-играх и ключевых квестах выставлять story flags.
3. В cutscenes менять текст в зависимости от flags.
4. Для Silver/Gold endings учитывать не только completion, но и story choices.
5. Добавить 2-3 короткие «моральные развилки» без провала, но с разным акцентом наград.

### P2 — Curriculum tracking как настоящий учебный прогресс

Цель: Progress Center должен показывать, какие GCSE-темы изучены.

Статус: реализован первый проход — `curriculum.js` обогащает темы полями area/difficulty/statBoosts/miniGameRefs/examSkill, Progress получил вкладку Curriculum с процентами по областям, квесты/Study Stations/мини-игры учитываются как learning links, а мини-игры показывают curriculum improvement note.

1. В `curriculum.js` добавить поля:
  - `area`;
  - `difficulty`;
  - `statBoosts`;
  - `miniGameRefs`;
  - `examSkill`.
2. Квесты, Study Stations и мини-игры связать с curriculum topic id.
3. Добавить Progress → Curriculum вкладку.
4. Показывать процент изученности по областям:
  - Democracy;
  - Rights & Law;
  - Modern Britain;
  - Participation;
  - Active Citizenship;
  - Exam Skills.
5. В конце мини-игры показывать, какие topic ids улучшились.

### P2 — Улучшить UX меню и мобильную эргономику

Цель: интерфейс должен оставаться удобным по мере роста систем.

Статус: реализован первый проход — добавлен лёгкий overlay manager для Inventory/Progress/Character/Story/Mini-games, Escape закрывает верхний overlay, открытие новой панели закрывает остальные, HUD-секции стали collapsible через `details/summary`, а мобильный HUD получил компактные отступы и прокрутку длинного inventory списка.

1. Сделать единый overlay manager:
  - закрытие через Escape;
  - единый backdrop click;
  - запрет одновременного открытия нескольких панелей;
  - единый z-index порядок.
2. Вынести общие стили `menu-overlay`, `menu-panel`, tabs, cards в повторяемые классы.
3. На мобильных экранах сделать HUD компактнее:
  - collapsible sections;
  - отдельные кнопки быстрого меню;
  - скрывать длинные списки inventory/progress.
4. Добавить Settings:
  - large text;
  - reduced motion;
  - high contrast;
  - reset save.
5. Добавить явные подсказки при первом открытии каждого меню.

### P2 — Улучшить визуальные ассеты

Цель: игра должна выглядеть как цельный RPG-прототип, а не набор UI-заглушек.

Статус: реализован первый проход — добавлен отдельный SVG asset Apathy Shade, story scenes получили региональные title-card фоны, а mini-game панели получили тематические визуальные props для газет, прав, бюллетеней, петиций, дебатов, кампаний и экзамена.

1. Заменить CSS-пиксельные item images на реальные маленькие PNG/WebP assets в `assets/items/`.
2. Добавить портрет/силуэт Apathy Shade как отдельный asset.
3. Добавить regional title cards для story scenes.
4. Сделать hero customization визуально заметнее на canvas:
  - разные hairstyles;
  - разные outfit silhouettes;
  - accent color на одежде, а не только поверхностная полоска.
5. В mini-games добавить тематические визуальные элементы:
  - newspaper cards;
  - ballot slips;
  - debate cards;
  - campaign planning tiles.

### P2 — QA и автоматизация

P2 QA automation и QA runbook/release hardening закрыты.

Цель: ускорить безопасную разработку следующих фаз.

Статус: закрыто — `scripts/validate-ui.js` проверяет save migration до `SAVE_VERSION = 6`, структуру mini-games, уникальность achievements, статические HTML buttons и VM smoke-render для Inventory/Progress/Character/Mini-games. `qa-ui-regression.mjs` добавляет headless Chrome/CDP UI-регрессии для New Game/customization, основных меню и прохождения одной mini-game без добавления новой Playwright-зависимости. `scripts/validate-world.js` проверяет pathfinding reachability от spawn до NPC, building doors, interior exits, study stations, travel-gate hosts, mini-game hosts и Exam Hall practice rooms. `qa-visual-smoke.mjs` делает desktop/mobile screenshot smoke, проверяет nonblank canvas, overflow, mobile touch controls и overlay fit. `qa-regional-playthrough.mjs` проходит all post-Village mini-game host NPCs через реальные NPC menu buttons и сохраняет gold результаты для всех 7 mini-games. `qa-regional-quests-playthrough.mjs` проходит 30 post-Village regional quests, travel gates до Exam Hall и финальную Exam Hall gate panel. `docs/QA_RUNBOOK.md` документирует quick/full QA commands, generated artifacts и manual follow-up.

1. Добавить локальный VM-check для save migration v1 → текущий `SAVE_VERSION`.
2. Добавить проверку, что все overlay buttons имеют working handler или `data-*` action.
3. Добавить проверку, что каждый `MINI_GAMES` entry имеет:
  - title;
  - region;
  - reward;
  - минимум 3 rounds;
  - valid correct index.
4. Добавить проверку, что каждый achievement id уникален.
5. Добавить smoke-check для `renderProgressPanel`, `renderInventoryPanel`, `renderCharacterPanel`, `renderMiniGamePanel` через VM.
6. Для UI-регрессий использовать Playwright или локальный headless browser/CDP script хотя бы на 3 сценария:
  - New Game → customization → start;
  - open Backpack / Progress / Character / Mini-games;
  - complete one mini-game.
7. Добавить pathfinding reachability checks от spawn до NPC, doors, gates и mini-game hosts.
8. Добавить desktop/mobile screenshot smoke для карты, основных overlay и одной mini-game.
9. Расширить automated playthrough за пределы первой локации: regional mini-game hosts через реальные NPC menu buttons.
10. Расширить automated playthrough на post-Village regional quests и travel gates до Exam Hall.
11. Оформить QA runbook/release hardening notes для будущих релизов.

### F5 — Accessibility, polish, release hardening

F5 local release smoke закрыт первым проходом. Текущий рабочий маркер перенесён в §20.4 ниже.

Статус: первый проход закрыт — добавлен Settings overlay с persistent settings (`largeText`, `highContrast`, `reducedMotion`) и reset-save control. Generated post-Village quest rewards no longer spam `Revision Tea`; balance notes are in `docs/BALANCE_REVIEW.md`. Current architecture/QA handoff is refreshed in `docs/AI_HANDOFF.md`, manual/release checks are in `docs/RELEASE_SMOKE_CHECKLIST.md`, visual conventions are in `docs/VISUAL_STYLE_GUIDE.md`, and `qa-release-smoke.mjs` covers local desktop/mobile smoke plus region spot checks. Deployment smoke still requires an explicit deploy request.

1. Settings panel: large text, high contrast, reduced motion, reset save.
2. Overlay manager и unified panel behavior.
3. UI smoke tests.
4. Финальная балансировка XP, Focus, монет и readiness.
5. Обновить `docs/AI_HANDOFF.md` текущей архитектурой.
6. Добавить release smoke checklist.
7. Добавить visual style guide, regional motif labels и mini-game host markers.
8. Добавить local release smoke automation.

---

## 18. Предлагаемые следующие фазы после E

### Фаза F1 — Интеграция мини-игр в мир

1. Добавить `miniGameId` NPC и/или зданиям.
2. Добавить кнопку `Mini-game` в NPC menu.
3. Показать на карте короткие маркеры/подсказки у NPC, у которых есть мини-игры.
4. Обновить Progress → Mini-games, чтобы показывать «где найти» каждую игру.
5. QA: пройти одну мини-игру из каждого региона через NPC.

### Фаза F2 — Финальный Exam Simulation 2.0

1. Разделить финал на 5 exam sections.
2. Добавить итоговый score breakdown.
3. Связать Bronze/Silver/Gold ending с score + readiness + story flags.
4. Добавить New Game+ экран после финала.

### Фаза F3 — Economy & Vendors

1. Добавить vendor roles и shop panel.
2. Добавить региональные товары и consumables.
3. Настроить цены, sell rules и quest item locks.
4. QA: купить/продать/использовать предмет без ломки inventory/equipment.

### Фаза F4 — Curriculum Progress

1. Обогатить `curriculum.js` topic metadata.
2. Добавить Curriculum tab в Progress Center.
3. Связать quests/stations/minigames с topic ids.
4. Показывать readiness не только общей цифрой, но и по curriculum areas.

### Фаза F5 — Accessibility, polish, release hardening

1. Settings panel: large text, high contrast, reduced motion.
2. Overlay manager и unified panel behavior.
3. UI smoke tests.
4. Финальная балансировка XP, Focus, монет и readiness.
5. Обновить `docs/AI_HANDOFF.md` текущей архитектурой.

---

## 19. Рекомендуемый порядок ближайшей разработки

1. **Next gameplay expansion** — выбрать следующий игровой слой: New Game+, дополнительные развилки или visual asset pass.
2. **Asset pass** — заменить выбранные primitive props/items на маленькие PNG/WebP assets согласно `docs/VISUAL_STYLE_GUIDE.md`.
3. **Deployment smoke** — выполнять только после явного deploy-запроса и без вывода токенов.

Критерий успеха следующего крупного релиза: игрок должен пройти путь «регион → NPC → мини-игра → награда → прогресс curriculum/story» без необходимости открывать dev меню или угадывать, где находится новый контент.

---

## 20. Улучшения графики и визуальной читаемости

Текущая графика уже работает как функциональный top-down прототип: игрок, NPC, здания, дороги, вода, двери и UI различимы. Следующий шаг — сделать мир более выразительным, чтобы локации запоминались визуально и игрок понимал, где он находится, куда идти и какие объекты важны.

### 20.1 Общий визуальный стиль

Статус: первый проход закрыт — `docs/VISUAL_STYLE_GUIDE.md` фиксирует style guide; core item thumbnails используют маленькие PNG assets из `assets/items/`; `assets/ui/` и `assets/props/region/` получили seed assets; регионы получили более отличимые silhouette motifs; Apathy Shade заметен в story scenes и оставляет слабые traces в нерешённых регионах.

1. Зафиксировать style guide:
  - размер тайла;
  - палитры регионов;
  - контраст интерактивных объектов;
  - правила обводки предметов/NPC/дверей;
  - набор UI-цветов для статусов: quest, mini-game, shop, story, exam.
2. Уменьшить визуальную похожесть регионов: сейчас часть локаций отличается в основном цветом, но не силуэтом.
3. Для каждого региона задать уникальный visual motif:
  - Village: школа, noticeboard, civic square, деревенская зелень.
  - Modern Britain: газетные киоски, карта UK, медиа-экран, multicultural market.
  - Rights & Law: суд, весы правосудия, каменные арки, legal notice boards.
  - Democracy: парламентские колонны, ballot booths, election posters, clock tower.
  - Participation: harbour, лодки, petition stalls, volunteer banners.
  - Action Workshop: campaign tables, planning boards, posters, survey boxes.
  - Exam Hall: castle, exam desks, source archive, final gate.
4. Заменить часть CSS/primitive-рисунков на реальные маленькие PNG/WebP assets в `assets/`:
  - `assets/items/` для предметов;
  - `assets/ui/` для иконок панелей;
  - `assets/story/` для story title cards;
  - `assets/props/` для региональных объектов.
5. Сделать Apathy Shade узнаваемым визуальным символом:
  - отдельный силуэт;
  - появление в story scenes;
  - слабые следы/тени в регионах, где сюжет ещё не решён.

### 20.2 Персонаж и кастомизация

Статус: первый проход закрыт — герой получил синхронизированный HUD/Character portrait и canvas visual profile. Preset data теперь влияет на hairstyle, outfit silhouette, shoe colour, backpack colour, trim и accent. `Justice Quill` и `Debate Blade` стали отдельными видимыми held-tool силуэтами, а current interactable получает highlight в мире.

1. Усилить различие пресетов персонажа:
  - разные причёски;
  - разные силуэты одежды;
  - разные цвета обуви/рюкзака;
  - заметный accent color на одежде.
2. Добавить маленький портрет героя в HUD/Character Panel.
3. Синхронизировать портрет и canvas-спрайт: выбранный preset должен быть узнаваем и в меню, и в мире.
4. Сделать held item видимее:
  - `Justice Quill` должен выглядеть как перо;
  - `Debate Blade` как церемониальный аргумент-инструмент;
  - future tools должны иметь отдельный силуэт в руке.
5. Добавить простые idle/walk варианты:
  - лёгкое покачивание рюкзака;
  - маленькое движение hair/accessory;
  - визуальный highlight при interaction range.

### 20.3 Предметы и инвентарь

Статус: первый проход закрыт — item thumbnails используют asset-backed icons с fallback, Backpack rows получили category frames, выбранный item показывается крупнее справа с description/effects/actions, а quest items имеют lock/unsellable marker.

1. Перейти от CSS-пиксельных миниатюр к asset-based иконкам:
  - единый размер, например 32x32 или 48x48;
  - прозрачный фон;
  - 1–2 пикселя обводки;
  - единая перспектива.
2. Для каждой категории предметов добавить цветовую рамку:
  - quest — gold;
  - consumable — green;
  - outfit — blue;
  - tool — silver;
  - collectible — teal/purple.
3. В Backpack показывать выбранный предмет крупнее справа с описанием и эффектами.
4. Добавить lock/unsellable marker для quest items.
5. В будущем добавить drag-and-drop или быстрый equip, но только после стабилизации кликов на mobile.

### 20.4 Story и mini-game визуалы

Статус: первый проход закрыт — story scenes получили regional title-card детали с act/landmark/key object, Apathy Shade и sparks; mini-game panels получили разные themed layout-паттерны для газет, прав, гавани, бюллетеней, дебатов, кампании и экзамена; completion screen показывает visual medal/reward block вместе с текстовым score/medal.

1. Для story scenes сделать regional title cards:
  - фон региона;
  - Apathy Shade;
  - ключевой объект региона;
  - название акта.
2. Для мини-игр добавить тематические визуальные компоненты:
  - Source Detective: карточки газетных заголовков, reliable/unreliable stamps.
  - Rights Match: пары карточек rights/responsibilities.
  - Petition Regatta: маленькая карта гавани и лодка.
  - Ballot Count: ballot slips и counting table.
  - Debate Arena: карточки Argument/Evidence/Rebuttal/Empathy.
  - Campaign Planner: board с шагами Research → Plan → Action → Evaluate.
  - Exam Simulation: exam paper, source extract, answer planner.
3. Мини-игры должны отличаться не только текстом, но и layout-паттерном.
4. В конце мини-игры показывать medal screen с визуальной наградой.

---

## 21. Улучшения расположения объектов и дизайна локаций

### 21.1 Принципы построения локаций

1. Каждая локация должна иметь центральный ориентир, видимый почти сразу после входа:
  - Village: civic square / noticeboard.
  - Modern Britain: media plaza.
  - Rights & Law: court square.
  - Democracy: parliament steps.
  - Participation: harbour pier.
  - Action Workshop: campaign board.
  - Exam Hall: castle gate.
2. Вход игрока должен направлять взгляд к первому NPC или центральному объекту.
3. Важные здания должны стоять вдоль понятного маршрута, а не случайно по краям карты.
4. Между зданием, NPC и мини-игрой должна быть визуальная связь:
  - NPC стоит рядом с тематическим объектом;
  - возле NPC есть prop, который намекает на тему;
  - вход в здание находится в зоне, куда естественно ведёт дорога.
5. Каждый регион должен поддерживать цикл: spawn → landmark → NPC cluster → building/interior → travel gate.

### 21.2 Улучшение дорог и навигации

1. Сделать дороги более читаемыми:
  - главная дорога от spawn к центральной площади;
  - вторичные дорожки к зданиям;
  - визуальное отличие bridge/pier/courtyard.
2. Добавить signposts у развилок:
  - `Town Hall`;
  - `Library`;
  - `Court`;
  - `Harbour`;
  - `Exam Hall`;
  - `Travel Gate`.
3. Добавить мини-таблички около зданий, но следить, чтобы текст не перекрывал двери/NPC.
4. На Travel Gate поставить уникальный prop в каждом регионе:
  - train sign;
  - underground arch;
  - clock lift;
  - campaign boat;
  - workshop path;
  - castle bridge.
5. В HUD/Progress добавить подсказку `Next place to go`, привязанную к текущему story/quest state.

### 21.3 Расстановка NPC

1. У каждого NPC должна быть роль в пространстве:
  - quest giver у тематического здания;
  - mini-game NPC рядом с интерактивной зоной;
  - vendor у stall/shop;
  - story NPC у landmark.
2. Избегать NPC, стоящих слишком близко к дверям, travel gate и study stations.
3. Группировать NPC по 2–3 вокруг тем, но оставлять проходы шириной минимум 1–2 player-width.
4. Добавить idle-facing direction, чтобы NPC смотрел на площадь/дорогу/игрока, а не в стену.
5. Для NPC с мини-игрой добавить маленький marker над головой или рядом (`!`, card icon, dice icon), но не перегружать экран.

### 21.4 Расстановка зданий и интерьеров

1. Проверить все здания на «понятность входа»: дверь должна быть на стороне, куда подходит дорога.
2. У каждого building entrance добавить 1–2 props, объясняющих назначение:
  - Town Hall: noticeboard, flags.
  - Library: books cart, reading sign.
  - Court: scales, stone sign.
  - Campaign Hub: posters, clipboard.
3. Интерьеры сейчас функциональны, но их можно сделать тематически разными:
  - Town Hall Interior: desks, council board.
  - Library Interior: shelves, source table.
  - Court Interior: judge bench, witness stand.
  - Park Action Hub: planning table, campaign posters.
4. Study stations внутри зданий должны располагаться как маленький маршрут, а не как набор точек.
5. Exit door всегда должен быть заметен и не перекрываться panel prompts.

### 21.5 Связность регионов

1. Сейчас регионы связаны через travel gate и `location.next`; это работает, но ощущается линейно. Нужно сделать связность более «картой мира».
2. Добавить World Map panel:
  - список регионов;
  - locked/unlocked/completed status;
  - быстрый travel только для уже unlocked регионов;
  - подсказка, почему следующий регион locked.
3. Сделать travel gate визуально связанным с destination:
  - перед поездкой показывать destination card;
  - после открытия региона добавлять marker в Progress/Map.
4. Позволить возвращаться в предыдущие регионы не только через dev menu:
  - public travel menu;
  - map-based fast travel;
  - unlock after completing gate questions.
5. Добавить региональные completion states:
  - `visited`;
  - `questsComplete`;
  - `studyComplete`;
  - `miniGameMedal`;
  - `storyBeatSeen`.

### 21.6 Плотность объектов и читаемость карты

1. Избегать пустых больших зон, но не заполнять всё props.
2. Для каждой локации задать зоны:
  - safe spawn;
  - central hub;
  - learning buildings;
  - NPC cluster;
  - mini-game area;
  - travel edge.
3. Props должны направлять движение, а не блокировать его.
4. Вода/деревья/стены должны создавать границы, но не ловушки.
5. Проверять, что игрок может обойти все decorative objects и не застревает в углах.

---

## 22. Практический план переработки карты и графики

### Map Phase 1 — Audit и карта связности

Статус: закрыто — добавлен `scripts/audit-map.js`, сгенерирован `docs/MAP_AUDIT.md` с таблицей всех exterior/interior локаций, blocked-zone summary и JSON-style zone sketches; `scripts/validate-world.js` расширен проверкой NPC-door interaction conflicts.

1. Составить таблицу всех локаций:
  - spawn;
  - main landmark;
  - NPC positions;
  - building doors;
  - travel gate;
  - mini-game trigger;
  - blocked zones.
2. Написать/расширить VM-check:
  - reachable spawn;
  - reachable NPCs;
  - reachable doors;
  - reachable mini-game triggers;
  - no NPC-door conflicts;
  - no prompt overlap near important objects.
3. Для каждой локации сделать простую ASCII/JSON-схему зон.

### Map Phase 2 — Перекомпозиция регионов

Статус: первый проход закрыт — Modern Britain Borough, Rights & Law Quarter, Democracy Capital, Participation Harbour, Action Workshop и Exam Hall Castle получили auditable signposts/props; `docs/MAP_AUDIT.md` регенерирован и показывает signs/props для всех exterior-регионов.

1. Переставить NPC и props так, чтобы появился маршрут от spawn к landmark.
2. Добавить региональные landmarks и signposts.
3. Уточнить дороги и подходы к дверям.
4. Добавить thematic props около NPC/зданий.
5. Проверить desktop/mobile визуально.

### Map Phase 3 — Интеграция мини-игр в локации

Статус: первый проход закрыт — все семь mini-games имеют explicit trigger props/markers или host markers; trigger props валидируются в `scripts/validate-world.js`, отображаются в `docs/MAP_AUDIT.md`, а Progress → Mini-games показывает host, trigger location и dynamic marker status.

1. Добавить mini-game trigger props:
  - newspaper stand;
  - rights card table;
  - petition boat;
  - ballot table;
  - debate podium;
  - campaign planning board;
  - exam desk.
2. Привязать trigger props к `MINI_GAMES`.
3. Добавить маркеры «new / completed / medal» около trigger props.
4. В Progress → Mini-games показывать location hint и completion marker.

### Map Phase 4 — Asset pass

Статус: первый проход закрыт — для trigger props `kiosk`, `notice`, `petitionStand`, `ballotBox`, `podium`, `planningBoard`, `examDesk`, `debateBench` добавлены PNG runtime assets в `assets/props/region/`; SVG source-файлы лежат рядом; `game.js` использует asset-backed canvas render с fallback на primitive drawing; `scripts/validate-world.js` проверяет наличие asset files.

1. Создать `assets/items/`, `assets/props/region/`, `assets/story/`.
2. Перевести самые заметные CSS-рисунки в изображения:
  - item icons;
  - Apathy Shade;
  - regional landmarks;
  - mini-game cards.
3. Добавить fallback на CSS/primitive drawing, если asset не загрузился.
4. Проверить размер bundle: игра должна оставаться лёгкой для Static Web Apps.

### Map Phase 5 — QA маршрутов

Статус: первый проход закрыт — добавлен `scripts/qa-route-audit.js`, сгенерированы `qa-route-audit-result.json` и `docs/MAP_ROUTE_QA.md`; route QA passed для всех 7 exterior-регионов, а `qa-regional-playthrough.mjs`, `qa-release-smoke.mjs` и `qa-visual-smoke.mjs` прошли с `blockingIssues: 0`.

1. Для каждой локации пройти вручную:
  - spawn → first NPC;
  - spawn → every building door;
  - spawn → mini-game trigger;
  - spawn → travel gate;
  - travel gate → next region;
  - return to previous region.
2. Прогнать automated checks.
3. Сделать скриншоты desktop и mobile.
4. Исправить overlap labels/prompts.
5. После проверки обновить `docs/AI_HANDOFF.md` с новой структурой карты.

### Критерий успеха графико-карточного релиза

Статус: достигнут локально первым проходом — все exterior-регионы имеют auditable visual anchors, mini-game trigger props/markers, route QA coverage и visual smoke без blocking issues. Public deploy smoke не выполнялся без явного deploy-запроса.

Игрок должен по одному взгляду понимать:

- какой это регион;
- где главный путь;
- кто важный NPC;
- где здание/мини-игра/travel gate;
- какие области уже пройдены;
- куда идти дальше без открытия dev menu.
