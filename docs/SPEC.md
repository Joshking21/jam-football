# TOUCHLINE (working title) — Complete Build Specification

Version 1.7 · 22 November 2026 · Target: OpenGame Game Jam #1 (entries close **18 December 2026, 23:59 PT**)

This is the single source of truth for building the game. It is written for an AI coding agent (Gemini) doing most of the implementation, with Claude producing art, models, audio and asset tools in parallel. Every number, file path, screen and rule needed to build the game is here. If something you need is missing, follow §0.4. Do not invent it silently.

**Changes in 1.7 (22 Nov):** the game becomes a club you live in. Every screen sits in a room of one 3D club building (office, boardroom, dressing room, tunnel, training ground, press room). The coach walks between rooms, and the player can look around each room with the mouse (§11.25). People share one rig and have painted face layers whose mouths move with their voices (§14.11). Players knock on the office door for conversations, Theo the assistant is a visible person, and the match gets touchline cuts of the coach and bench (§14.11). The coach is voiced (§17.4), and every room has its own sound (§17.5). New content file `club.json` (§16.9), asset contracts (§18.2, §18.3, §18.6), budgets (§21), and milestone **M6b** (§23). Depth still comes first: rooms frame the screens and never replace them. **Training in detail** (§12.18, M5 task 8): a planned week of sessions, personal plans, one-to-ones, training ratings and progress. **Set pieces in detail** (§13.20, M5 task 9): player jobs, routines, takers by foot, free kicks by area, defending corners and free kicks. **Touchline shouts, match plans and player traits** (§13.21–13.23, M5 task 10). **Injury and discipline decisions** (§12.19–12.20, M5 task 11): knocks, rushing players back, warm-up scares, and incidents (late, sent off, press, bust-ups) with fines, drops and warnings. Referees, contract talks and matchday atmosphere are in §24 as real-life extras, if time allows. A separate shape without the ball is listed in §24 as one of the last items. **Tactics returns to the sideways board** (v3 look, "v5 layout", §11.8); the v1.6 vertical three-column layout is withdrawn. Proposal record: `docs/design/SPEC-1.7-PROPOSAL.md`.

**Changes in 1.6 (20 Nov):** the sidebar is gone: navigation moves into the top bar as tabs (§11.0, §19.6) on **every** screen, on air and office alike, like Football Manager. Office work screens fit the window with no page scroll. Tactics becomes three columns around a vertical board: the player's file (who he is) on the left, his orders (what he's told) on the right (§11.8, layout in `docs/design/tactics/README.md` "v4 layout"). New component RadarChart: the player's shape against what his role needs (§19.5).

**Changes in 1.3 (19 Nov):** new §13.17 Tactical depth: player roles with fit (replace duties), opposition orders, transition and goalkeeper-distribution settings, corner routines, player instructions, key battles, AI and assistant rules, extra calibration checks including "no dominant choice". Tactical depth now outranks visual polish when time is short. Related edits: §8.4 types, §11.8, §13.5, §13.8, §13.12, §15.4, M3 task 0.

**Changes in 1.2 (19 Nov):** the UI design system is rewritten (§19.1–19.7): the game is a broadcast ("on air") plus the manager's office ("behind the scenes"); the accent is now the user's club colour (club theme table, §19.2), the neon green is gone; new base palette, sharper shapes, the sidebar rundown, a ticker, and a full motion system (screen transitions, springs, count-ups, table reorders, stamps, magnets) with performance and reduce-motion rules. Related edits: §11.0 sidebar order and keys, §11.7 player file, §11.8 tactics whiteboard, §17.3 UI sounds, §19.8 focus ring, M3 task 2 (rework the M0 shell).

**Changes in 1.1 (19 Nov):** new §14.10 Realism pass (post-processing, environment lighting, light beams, haze, grass, wet pitch); new rows in the §21.2 presets table; portraits are delivered greyscale and tinted per club at runtime (§18.2, §18.5); `textures/grass_normal.webp` and optional brick/timber stand models added (§18.2); `manager.glb` contract (§18.3); M4 task 7 and M8 task 1 updated. The look of every model and image is defined in `docs/design/ART-DIRECTION.md`; fallbacks SHOULD follow its colours and lighting values.

---

## Table of contents

0. How to work with this document
1. Jam rules that bind the build
2. The game in one page
3. Hard technical constraints
4. Tech stack (exact)
5. Repository layout (exact)
6. Coding conventions
7. Architecture and data flow
8. Data model (TypeScript types)
9. The fixed world: league, clubs, players
10. Game flow and calendar
11. Screens (every screen, every element)
12. Management systems and exact rules
13. Match engine (complete specification)
14. Match presentation (3D view, choreography, cameras, highlights)
15. The assistant coach
16. Content files (commentary, press, talks, conversations, news)
17. Audio
18. Asset contract (what Claude delivers, where, and the fallbacks)
19. UI design system
20. Saving, loading, settings
21. Performance budgets and quality presets
22. Testing, calibration and QA
23. Milestones, tasks and acceptance criteria (with dates)
24. Out of scope and stretch goals
25. Glossary

---

## 0. How to work with this document

### 0.1 Order of work
Build strictly in milestone order (§23). Within a milestone, do tasks in the order listed. Do not start a milestone until the previous one's acceptance criteria pass. Before starting any task, re-read the sections it references.

### 0.2 Words
- **MUST**: required. The game is wrong without it.
- **SHOULD**: required unless it conflicts with a MUST or a performance budget. If you skip it, record why in `docs/DECISIONS.md`.
- **MAY**: optional. Do it only after the milestone's MUSTs pass.

### 0.3 Logging and commits
- After every completed task, append an entry to `docs/PROGRESS.md` (format in §23.0) with what changed, the exact commands you ran and their real output (pass/fail counts), and any open issues.
- Commit locally after every completed task with a message like `feat(match): through-ball resolution and offside (M2.4)`. Never push. Never rewrite history. The git history is our evidence for the jam's "made during the jam" rule.
- Never claim a test passed if you did not run it.

### 0.4 When the spec is silent or contradictory
1. Prefer the reading that keeps the game deterministic, offline-capable and inside performance budgets.
2. Make the smallest reasonable choice, put the number in `src/config/balance.ts` (never inline), and write a short entry in `docs/DECISIONS.md` with: the question, your choice, and why.
3. If the gap blocks correctness (e.g. two MUSTs conflict), write `BLOCKED:` in `docs/PROGRESS.md` with the question, then continue with the next independent task.

### 0.5 Things you must never do
- Never copy source code from `C:\Users\Joshking\Desktop\FOOTBALL-MANAGER` (the older "JFG" project). The jam rules forbid reusing game-specific systems from earlier projects. Its documents describe ideas; this spec already contains the ideas we use. Write all code fresh.
- Never add a backend, database server, login, analytics, ads, payment, crypto or tracking.
- Never put an API key, token or secret in the repository or the build.
- Never use real footballers', clubs', leagues', sponsors' or brands' names, crests, kits or likenesses. Never name the game or anything in it "Football Manager", "FIFA", "FC 2x", "eFootball" or any other existing game.
- Never fetch anything from the internet at runtime (fonts, CDNs, images, analytics). Everything ships in the build.
- Never edit files under `tools/` or `public/assets/` (Claude owns them), except creating the initial `public/asset-manifest.json` in M0.
- Never add a dependency that is not in §4 without writing a `DECISIONS.md` entry that explains why no listed dependency works.
- Never leave placeholder copy ("Lorem ipsum", "TODO", "Coming soon") visible in the UI. Hide unfinished features entirely.
- Never ship anything that breaks the craft bar in §19.8. Read it before building any screen, any content file and the match view.

---

## 1. Jam rules that bind the build

Source: opengame.io/jam and opengame.io/create, read 19 Nov 2026.

| Rule | What it means for us |
|---|---|
| Entries close 18 Dec 2026 23:59 PT; only the latest published build counts | Feature-freeze 15 Dec. Submit by 17 Dec. |
| The game must be made during the jam; no reuse of earlier game-specific code | Fresh repo (this one), fresh code, git history from 19 Nov. |
| Static files, `index.html` at the root of the build folder | Vite build to `dist/` with `base: './'`. |
| Must run with nothing to install and draw its first frame without its own server; review runs offline | No runtime network. All assets local. |
| Desktop only; fully playable with mouse and keyboard; must respond to window resizing | §19.6 layout, §11.0 keyboard map, resize handling everywhere including the 3D canvas. |
| No API keys in the build; no sign-in, email walls, ads, payments | AI voice/images/models are generated before build by Claude's tools and shipped as files. |
| Judging, equally weighted: creativity/originality, depth, fun, performance (load speed, smoothness on an ordinary laptop), visual fidelity | §2 pillars map to these. Performance budgets in §21 are MUSTs. |
| Sponsor tracks: ElevenLabs (voice/sound), fal (images/video/audio/3D), Meshy (3D models that hold up under a player-controlled camera) | Commentary/assistant/press voices (ElevenLabs); portraits, crests, newspaper images (fal); players, stadium, goals (Meshy); free-orbit match camera (§14.5). |
| Size cap 4 GB zipped / 25,000 files | Our target is under 120 MB and under 2,000 files. |
| Tracks | Enter "Simulation & management". |
| Supported submission agents: Claude Code, Codex, Cursor, OpenCode | The final OpenGame check/deploy (M9) is run by Claude Code, not Gemini. Gemini prepares the build. |

---

## 2. The game in one page

**Pitch.** You are the new manager of a club in the fictional *Meridian League*. In one sitting of about 30 minutes you play a full 18-matchday season: pick your XI, set tactics, give team talks, face the press, buy and sell players, and watch every match play out in a 3D stadium with live commentary while your assistant coach whispers tactical advice you can apply with one click. At the end, the board judges you.

**Design pillars** (each one maps to a judging criterion):
1. **Every decision shows up on the pitch** (depth, fun). Tactics change actual action choices in the engine. The assistant explains cause and effect in plain words.
2. **A season in a sitting** (fun). About 30 minutes for a full season. About 80 seconds per matchday at default speed. Nothing is a chore: every screen has a one-click "Let the assistant decide".
3. **Broadcast-quality match day** (visual fidelity, originality). Night-match stadium, floodlights, crowd, broadcast camera, goal replays, voiced commentary.
4. **Runs on any laptop** (performance). Title screen interactive in under 2 s; match 60 fps on integrated graphics at Medium.
5. **A living, fixed world** (depth, originality). 10 hand-designed clubs, 240 fictional players with portraits, rivalries, personalities, press, newspapers.

**Mode in scope:** *Sprint Season* (one season, 18 matchdays). Multi-season career is a stretch goal (§24).

**Session budget (Sprint Season, default settings):**
| Part | Target real time |
|---|---|
| Title → club choice → board meeting | 2:00 |
| Preseason (squad look, tactics, optional transfers) | 3:00 |
| 18 matchdays × ~80 s | 24:00 |
| Midseason transfer window | 2:00 |
| Season end, awards, verdict | 1:30 |
| **Total** | **~32:30** |

---

## 3. Hard technical constraints

1. Build output: `dist/index.html` + hashed assets, all paths relative (`base: './'`).
2. No runtime network requests of any kind. Verify in M8 with DevTools offline mode.
3. Desktop browsers: latest Chrome, Edge and Firefox MUST work; Safari SHOULD work. WebGL2 required; if unavailable, the match falls back to the 2D top-down view (§14.9) and the rest of the game works.
4. Minimum window 1280×720; MUST stay usable down to 1024×640 (scroll allowed below 1280 wide). MUST look correct up to 2560×1440. Every layout and the 3D canvas MUST respond to `resize` within one frame.
5. Mouse + keyboard only. No hover-only information: anything shown on hover MUST also be reachable by click or focus.
6. Deterministic simulation: the same save seed + same inputs + same commands = the same events, on every browser.
7. The simulation (`src/core/**`) MUST NOT import DOM, React, three.js, audio, `Date.now()` or `Math.random()`. Use the seeded RNG (§7.3).

---

## 4. Tech stack (exact)

Node 24 is installed on the dev machine. Use **npm**. Pin exact versions (no `^`/`~`). If a listed exact version fails to install, use the nearest existing patch version and record it in `DECISIONS.md`.

| Package | Version | Use |
|---|---|---|
| vite | 6.0.7 | build/dev server |
| @vitejs/plugin-react | 4.3.4 | React plugin |
| typescript | 5.7.2 | strict TS |
| react, react-dom | 18.3.1 | UI |
| @types/react | 18.3.12 | types |
| @types/react-dom | 18.3.1 | types |
| three | 0.171.0 | 3D match view |
| @types/three | 0.171.0 | types |
| zustand | 5.0.2 | app state |
| idb-keyval | 6.2.1 | IndexedDB saves |
| lucide-react | 0.468.0 | icons (tree-shaken named imports only) |
| @fontsource/barlow-condensed | 5.1.0 | headings font (weights 500, 600, 700) |
| @fontsource/inter | 5.1.0 | body font (weights 400, 500, 600) |
| vitest | 2.1.8 | tests (dev) |
| prettier | 3.4.2 | formatting (dev) |
| tsx | 4.19.2 | run TS scripts (dev) |

**Not allowed:** React Three Fiber, drei, any physics engine, any UI kit (MUI, Chakra, Tailwind, etc.), chart libraries, lodash, moment/dayjs, any CDN.

**npm scripts (exact names):**
```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "gen:world": "tsx scripts/gen-world.ts",
  "calibrate": "tsx scripts/calibrate.ts",
  "check": "npm run format:check && npm run typecheck && npm run test && npm run build"
}
```

`vite.config.ts` MUST set `base: './'`, `build.target: 'es2022'`, `build.assetsInlineLimit: 0`, `worker.format: 'es'`, and split three.js into its own chunk (`manualChunks: { three: ['three'] }`).

`tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: false`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, path alias `@/*` → `src/*`.

---

## 5. Repository layout (exact)

Create directories only when you put a file in them.

```
jam-football/
├─ GEMINI.md                    # agent rules (short)
├─ docs/
│  ├─ SPEC.md                   # this file
│  ├─ PROGRESS.md               # task log (you append)
│  └─ DECISIONS.md              # your decisions on gaps (you append)
├─ index.html
├─ package.json  tsconfig.json  vite.config.ts  vitest.config.ts  .prettierrc  .gitignore
├─ public/
│  ├─ asset-manifest.json       # list of delivered asset files (Claude regenerates it)
│  └─ assets/                   # Claude-owned: models, images, audio (see §18)
├─ scripts/
│  ├─ gen-world.ts              # writes src/core/world/world.snapshot.json
│  └─ calibrate.ts              # match engine calibration report
├─ tools/                       # Claude-owned asset generation tools. Do not edit.
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ config/
│  │  ├─ constants.ts           # GAME_TITLE, versions, seeds, limits
│  │  ├─ balance.ts             # EVERY tunable gameplay number
│  │  ├─ clubThemes.ts          # UI theme colours per club (§19.2)
│  │  └─ formations.ts          # formation slots and anchors
│  ├─ core/                     # pure TypeScript, no DOM/React/three/audio
│  │  ├─ rng.ts  types.ts  ids.ts  math.ts
│  │  ├─ world/   generateWorld.ts  names.data.ts  clubs.data.ts  blocklist.data.ts  world.snapshot.json
│  │  ├─ player/  ratings.ts  value.ts  development.ts  morale.ts  condition.ts  injuries.ts  discipline.ts
│  │  ├─ match/   engine.ts  state.ts  actions.ts  shots.ts  setPieces.ts  involvement.ts  tactics.ts
│  │  │           fouls.ts  ratings.ts  stats.ts  aiManager.ts  commands.ts  highlights.ts  frames.ts
│  │  ├─ season/  fixtures.ts  table.ts  calendar.ts  awards.ts  simulateRound.ts
│  │  ├─ economy/ finance.ts  transfers.ts  contracts.ts  aiTransfers.ts  scouting.ts
│  │  ├─ people/  board.ts  fans.ts  talks.ts  press.ts  conversations.ts  assistant.ts  training.ts
│  │  ├─ news/    news.ts
│  │  └─ game/    newGame.ts  advance.ts  score.ts  migrations.ts
│  ├─ content/  commentary.json  press.json  talks.json  conversations.json  news.json  assistant.json  injuries.json  club.json (§16.9)  training.json (§12.18.10)
│  │            tactics.json   (role/order/setting gain and cost lines, §13.17.6)
│  ├─ workers/  match.worker.ts  season.worker.ts
│  ├─ state/    store.ts  saves.ts  selectors.ts  settings.ts
│  ├─ assets/   registry.ts  procedural/crest.ts  procedural/avatar.ts  procedural/kit.ts
│  ├─ audio/    AudioEngine.ts  commentary.ts  crowd.ts  music.ts  ambience.ts (§17.5)
│  ├─ render3d/ MatchScene.ts  pitch.ts  stadium.ts  crowd.ts  players.ts  ball.ts  cameras.ts
│  │            choreographer.ts  replay.ts  quality.ts  weather.ts  topdown2d.ts
│  │            post.ts  environment.ts  beams.ts   (§14.10)  touchline.ts (§14.11.5)
│  ├─ club3d/   ClubScene.ts  rooms.ts  walk.ts  people.ts  behaviours.ts  faces.ts  mouth.ts   (§11.25, §14.11)
│  └─ ui/
│     ├─ styles/ tokens.css  global.css
│     ├─ components/  (Button, Card, Tabs, Table, Modal, Toast, Tooltip, Badge, AttrBar, OvrBadge,
│     │               Crest, Portrait, KitIcon, PitchBoard, Sparkline, StatCompare, Meter,
│     │               ProgressSteps, KeyHint, ContinueButton, TopBar (with NavTabs; no Sidebar since v1.6), EmptyState, ConfirmDialog,
│     │               Panel, Sheet, Stamp, Magnet, Ticker, ScreenTransition, CountUp, FlipList)
│     ├─ motion/      spring.ts  flip.ts  transitions.ts   (§19.7)
│     └─ screens/     (one folder per screen in §11)
└─ tests/  (vitest *.test.ts mirroring src paths)
```

---

## 6. Coding conventions

- TypeScript strict. No `any` (use `unknown` and narrow). No non-null `!` except with a comment proving safety.
- Functions in `core/` are pure: input → output, plus explicit RNG argument. State mutation in `core/` only on objects passed in and documented as mutated (engine state only). Everything else returns new objects.
- All gameplay numbers live in `src/config/balance.ts`, grouped and commented with units. No magic numbers elsewhere (0, 1, array indexes and pure geometry excepted).
- Money: integers in whole currency units (no cents). Display with `formatMoney()`: `€12.4M`, `€850K`, `€9,500`. Currency symbol constant `CURRENCY = '€'`.
- IDs: players `p0001`…, clubs `c01`…`c10`, fixtures `f001`…, news `n…` (counter), save seed is a 32-bit unsigned int.
- File names: `camelCase.ts`, React components `PascalCase.tsx`, one component per file, CSS Modules `Component.module.css`.
- React: function components, hooks, zustand selectors to avoid re-renders. No business logic in components: call `core/` functions through store actions.
- Comments explain *why*, not what. Each `core/` module starts with a 2–5 line header comment naming the spec section it implements (e.g. `// Implements SPEC §13.6 shots`).
- Tests sit in `tests/` mirroring `src/` paths.

---

## 7. Architecture and data flow

### 7.1 Layers
```
UI (React screens) ──actions──▶ Store (zustand: GameState + UI state)
                                   │  calls pure functions
                                   ▼
                           core/ (rules, world, season, economy, people)
                                   │
            Match day: Store ─▶ match.worker (core/match engine) ─▶ event stream ─▶ MatchPlayback
                                                                               ├▶ render3d (three.js)
                                                                               ├▶ audio (commentary, crowd)
                                                                               └▶ UI HUD (score, clock, stats, assistant)
            Other fixtures of the round: season.worker (instant sim) ─▶ results revealed by minute
Saves: Store ⇄ state/saves.ts ⇄ IndexedDB
Assets: registry.ts reads public/asset-manifest.json → real file or procedural fallback
```

### 7.2 GameState ownership
- `GameState` (§8.9) is the whole save. It lives in the store and is replaced immutably at each "advance" step.
- Transient UI state (open modal, selected tab, playback speed) is NOT saved, except settings (§20.3).

### 7.3 Randomness
- `src/core/rng.ts` implements **sfc32** seeded from a 32-bit seed via **splitmix32** (4 words). API:
  - `createRng(seed: number): Rng`
  - `rng.next(): number` in [0,1)
  - `rng.int(min, maxInclusive)`, `rng.pick(arr)`, `rng.weighted(items, weightFn)`, `rng.normal(mean, sd)` (Box–Muller, cache the second value), `rng.chance(p)`
  - `rng.state(): [number,number,number,number]`, `restoreRng(state)`
- Derive independent streams with `deriveSeed(baseSeed, ...labels: (string|number)[])` = FNV-1a 32-bit hash over the base seed and labels. Examples: `deriveSeed(save.seed, 'match', fixtureId)`, `deriveSeed(save.seed, 'week', matchday, 'training')`.
- `WORLD_SEED = 20261118` (fixed world, §9). `save.seed` = the seed chosen at new game (from `crypto.getRandomValues` in the UI layer, passed into core).

### 7.4 Match worker protocol
`match.worker.ts` hosts one `MatchSim` (§13.14). Messages (all plain JSON):

To worker:
- `{type:'start', input: MatchInput, seed: number, lookaheadSec: 300}`
- `{type:'command', command: MatchCommand}` — see §13.12
- `{type:'need', untilT: number}` — the playback needs events up to match time `untilT`
- `{type:'finishInstant'}` — simulate to the end now (Instant Result / Skip)
- `{type:'dispose'}`

From worker:
- `{type:'events', events: MatchEvent[], simulatedUntil: number}`
- `{type:'rewind', fromSeq: number}` — discard events with `seq >= fromSeq` (a command changed the future)
- `{type:'result', result: MatchResult}`
- `{type:'error', message: string}`

The worker keeps the simulation at most `lookaheadSec` match-seconds ahead of the latest `need`.

---

## 8. Data model (TypeScript types)

Put these in `src/core/types.ts`. Field names are exact.

### 8.1 Basics
```ts
export type ClubId = string;            // 'c01'..'c10'
export type PlayerId = string;          // 'p0001'..
export type FixtureId = string;         // 'f001'..
export type Side = 'home' | 'away';
export type Position = 'GK'|'CB'|'LB'|'RB'|'LWB'|'RWB'|'DM'|'CM'|'AM'|'LM'|'RM'|'LW'|'RW'|'ST';
export type PositionGroup = 'GK'|'DEF'|'MID'|'FWD';
export type Foot = 'Left'|'Right'|'Both';
export type Personality = 'Professional'|'Ambitious'|'Leader'|'Relaxed'|'Temperamental'|'Loyal';
export type SquadRole = 'Star'|'Starter'|'Rotation'|'Backup'|'Prospect';
export type NationCode = 'ENG'|'NGA'|'FRA'|'ESP'|'BRA'|'NED'|'GHA'|'POR'|'GER'|'IRL'|'SEN'|'SCO'|'ARG'|'DEN';
```

### 8.2 Attributes (all integers 1–99)
```ts
export interface Attributes {
  // technical
  finishing: number; longShots: number; passing: number; crossing: number;
  firstTouch: number; dribbling: number; tackling: number; heading: number; setPieces: number;
  // physical
  pace: number; stamina: number; strength: number;
  // mental
  offTheBall: number; positioning: number; decisions: number; composure: number; workRate: number;
  // goalkeeping (outfielders have 1–15 here)
  reflexes: number; handling: number; oneOnOnes: number; aerialCommand: number;
}
export type AttributeKey = keyof Attributes;
```

### 8.3 Player
```ts
export interface Injury { kind: string; matchdaysOut: number; severity: 'Minor'|'Moderate'|'Major'; }
export interface Contract { wagePerWeek: number; yearsLeft: 1|2|3|4; role: SquadRole; promisedRole?: SquadRole; }
export interface PlayerSeasonStats {
  apps: number; starts: number; minutes: number; goals: number; assists: number;
  yellow: number; red: number; ratingSum: number; ratedApps: number; motm: number;
  cleanSheets: number; shots: number; shotsOnTarget: number; keyPasses: number;
  tacklesWon: number; interceptions: number; saves: number; goalsConceded: number;
}
export interface Player {
  id: PlayerId; firstName: string; lastName: string; knownAs?: string;
  nationality: NationCode; age: number; heightCm: number; foot: Foot;
  positions: { pos: Position; familiarity: number }[];   // [0] is primary (100); others 70–95
  attributes: Attributes;
  potential: number;            // hidden OVR ceiling at primary position
  personality: Personality;
  clubId: ClubId | null;        // null = free agent
  squadNumber: number | null;
  contract: Contract | null;    // null for free agents
  condition: number;            // 0–100 match readiness
  fatigue: number;              // 0–100 accumulated load
  morale: number;               // 0–100
  injury: Injury | null;
  suspendedMatches: number;
  yellowAccumulation: number;   // resets after each ban
  form: number[];               // last 5 match ratings, newest last
  stats: PlayerSeasonStats;
  transferListed: boolean;
  notForSale: boolean;
  scoutedBy: ClubId[];          // clubs that have full knowledge
  growth: number;               // fractional OVR progress carried between weeks
  history: { matchday: number; event: string }[];  // e.g. 'Signed from Ironvale for €4.2M'
}
```

### 8.4 Tactics
```ts
export type Formation = '4-4-2'|'4-3-3'|'4-2-3-1'|'3-5-2'|'5-3-2'|'4-1-4-1'|'3-4-3';
export type Mentality = 'Defensive'|'Balanced'|'Attacking';
export type PassingStyle = 'Short'|'Mixed'|'Direct';
export type Tempo = 'Slow'|'Normal'|'Fast';
export type Pressing = 'Low'|'Mid'|'High';
export type DefLine = 'Deep'|'Normal'|'High';
export type Width = 'Narrow'|'Normal'|'Wide';
export type Focus = 'Left'|'Centre'|'Right'|'Mixed';
export type RoleId = string;        // ids from src/config/roles.ts (§13.17.2)
export type OnLoss = 'CounterPress'|'Regroup'|'Mixed';
export type OnWin = 'Counter'|'KeepIt'|'Mixed';
export type Distribution = 'Short'|'Long'|'Wide'|'Mixed';
export type CornersFor = 'NearPost'|'FarPost'|'Short'|'Mixed';
export type CornersAgainst = 'Zonal'|'ManMark'|'Mixed';
export interface TeamInstructions {
  mentality: Mentality; passing: PassingStyle; tempo: Tempo; pressing: Pressing;
  line: DefLine; width: Width; focus: Focus;
  onLoss: OnLoss; onWin: OnWin; distribution: Distribution;           // §13.17.4
  cornersFor: CornersFor; cornersAgainst: CornersAgainst;             // §13.17.5
}
export type PlayerInstruction = 'shootMore'|'shootLess'|'dribbleMore'|'dribbleLess'|'crossMore'|'crossLess'
  |'getForward'|'holdPosition'|'stayWider'|'closeDownMore'|'stayOnFeet'|'longThrows'; // §13.17.11
export interface OppOrder { kind: 'tightMark'|'doubleUp'|'pressOnBall'|'showInside'|'showOutside'; target: PlayerId } // §13.17.3
export interface Tactics {
  formation: Formation;
  lineup: (PlayerId | null)[];      // length 11, index = slot index in formations.ts
  roles: RoleId[];                  // length 11, replaces the old duties (§13.17.2)
  playerInstructions: PlayerInstruction[][]; // length 11, each 0–2
  bench: PlayerId[];                // 0–9
  captain: PlayerId | null;
  takers: { penalty: PlayerId|null; freeKick: PlayerId|null; corner: PlayerId|null; longThrow: PlayerId|null };
  instructions: TeamInstructions;
  opposition: OppOrder[];           // 0–3, set per match (cleared after each match)
}
// ---- SPEC 1.4 additions (§13.18). Mentality gains two outer steps:
//   export type Mentality = 'VeryDefensive'|'Defensive'|'Balanced'|'Attacking'|'VeryAttacking';
export type FinalThird = 'WorkIntoBox'|'ShootOnSight'|'Mixed';
export type CrossStyle = 'Low'|'Whipped'|'Floated'|'Mixed';
export type Tackling = 'StayOnFeet'|'GetStuckIn'|'Mixed';
export type ForceOpp = 'Inside'|'Outside'|'Mixed';
export type TimeWasting = 'Never'|'WhenAhead';
export type FreeKicks = 'Shoot'|'Cross'|'Short'|'Mixed';
export type CornerSwing = 'Inswinger'|'Outswinger'|'Mixed';
export type PostMen = 'None'|'Near'|'Both';
// TeamInstructions gains: finalThird, crossStyle, offsideTrap: boolean, tackling, forceOpp, timeWasting,
//   freeKicks, cornerSwing, menBack: 1|2|3, postMen.  Defaults (all neutral): Mixed / false / Never / 2 / None.
// PlayerInstruction gains: 'roam'|'sitNarrower'|'crossFromByline'|'crossFromDeep'|'riskyPasses'|'playSafe'.
export interface TacticPlan {      // §13.18.10: Plan A/B/C
  name: string; formation: Formation; roles: RoleId[]; playerInstructions: PlayerInstruction[][]; instructions: TeamInstructions;
}
// Tactics: formation/roles/playerInstructions/instructions move into plans: [TacticPlan, TacticPlan, TacticPlan] + activePlan: 0|1|2.
//   lineup, bench, captain, takers and opposition stay on Tactics (shared by all plans).
export interface Familiarity { formation: Record<Formation, number>; mentality: Record<string, number>; passing: Record<PassingStyle, number>; pressing: Record<Pressing, number> } // 0–100, per club (§13.18.11)
```

### 8.5 Club
```ts
export type KitPattern = 'solid'|'stripes'|'hoops'|'halves'|'sash'|'chevron';
export interface Kit { shirt: string; shirt2: string; pattern: KitPattern; shorts: string; socks: string; text: string; }
export interface Club {
  id: ClubId; name: string; shortName: string; code: string;   // code = 3 letters
  nickname: string; city: string; founded: number;
  stadium: { name: string; capacity: number };
  colors: { primary: string; secondary: string; text: string };
  kits: { home: Kit; away: Kit; gk: Kit };
  reputation: 2|3|4|5;
  style: TeamInstructions & { formation: Formation };
  managerName: string;                 // AI manager (fictional)
  rivals: ClubId[];
  balance: number; transferBudget: number; wageBudget: number;   // wageBudget = per week
  expectation: { target: number; acceptable: number; label: string };
  boardConfidence: number;             // 0–100
  fanMood: number;                     // 0–100
  formationFamiliarity: Record<Formation, number>;  // 0–100
  tactics: Tactics;
  squad: PlayerId[];
  trainingPlan: TrainingPlan;
  seasonStats: { gateIncome: number; tvIncome: number; sponsorIncome: number; prizeMoney: number;
                 wagesPaid: number; transferIn: number; transferOut: number; operating: number };
}
export interface TrainingPlan { focus: 'Balanced'|'Attacking'|'Defending'|'Fitness'|'SetPieces'|'Tactical';
  intensity: 'Light'|'Normal'|'Hard'; individual: Record<PlayerId, AttributeKey | null>; }
```

### 8.6 Fixtures, results, table
```ts
export interface Fixture {
  id: FixtureId; matchday: number; homeId: ClubId; awayId: ClubId;
  kickoff: 'Afternoon'|'Evening'|'Night'; weather: 'Clear'|'Overcast'|'Rain';
  isDerby: boolean; result: MatchResultSummary | null;
}
export interface MatchResultSummary {
  homeGoals: number; awayGoals: number;
  scorers: { playerId: PlayerId; side: Side; minuteLabel: string; penalty: boolean; ownGoal: boolean }[];
  attendance: number; motm: PlayerId;
  stats: { home: TeamMatchStats; away: TeamMatchStats };
}
export interface TableRow { clubId: ClubId; p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number; form: ('W'|'D'|'L')[]; }
```

### 8.7 Inbox and news
```ts
export type InboxKind = 'Board'|'Assistant'|'Medical'|'Transfer'|'Player'|'League'|'Press'|'Fans';
export interface InboxItem {
  id: string; matchday: number; kind: InboxKind; title: string; body: string;
  read: boolean; requiresAction: boolean;
  action?: { type: 'conversation'|'transferOffer'|'contract'|'board'; refId: string };
}
export interface NewsItem { id: string; matchday: number; headline: string; body: string;
  image?: string; clubIds: ClubId[]; playerIds: PlayerId[]; }
```

### 8.8 Transfers
```ts
export interface TransferOffer {
  id: string; playerId: PlayerId; fromClubId: ClubId | null; toClubId: ClubId;
  fee: number; status: 'Pending'|'Accepted'|'Rejected'|'Countered'|'Withdrawn'|'Completed'|'PlayerRefused';
  counterFee?: number; createdRound: number; bidsMade: number;
  contractOffer?: { wagePerWeek: number; years: 1|2|3|4; role: SquadRole };
}
export interface TransferWindowState { kind: 'Preseason'|'Midseason'; round: 1|2|3; offers: TransferOffer[];
  scoutingQueue: PlayerId[]; scoutingDoneThisRound: number; boardWageRequestUsed: boolean; }
```

### 8.9 GameState (the save)
```ts
export type Phase = 'BoardMeeting'|'Preseason'|'TransferWindow'|'PreMatch'|'Match'|'PostMatch'
                  | 'WeekSummary'|'SeasonEnd'|'Sacked';
export interface GameState {
  version: number;                 // SAVE_VERSION, see §20.2
  seed: number;                    // save seed
  createdAt: string;               // ISO string from UI layer
  managerName: string;
  userClubId: ClubId;
  matchday: number;                // 0 = preseason, 1..18
  phase: Phase;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  freeAgents: PlayerId[];
  fixtures: Fixture[];
  table: TableRow[];               // always sorted
  window: TransferWindowState | null;
  inbox: InboxItem[];
  news: NewsItem[];
  pressHistory: string[];          // question ids already asked (avoid repeats)
  conversationsHistory: string[];
  tutorial: { step: number; done: boolean };
  pendingMatch: { fixtureId: FixtureId } | null;
  awards: SeasonAwards | null;
  score: number;                   // leaderboard score, computed at season end
  counters: { news: number; inbox: number; offer: number };
}
```
`TeamMatchStats`, `SeasonAwards`, `MatchInput`, `MatchEvent`, `MatchCommand`, `MatchResult` are defined in §13.

---

## 9. The fixed world

The world is identical in every save so that voices, portraits and press can name real (fictional) people. It is generated once by `npm run gen:world` from `WORLD_SEED` and committed as `src/core/world/world.snapshot.json`. After M1 it is **frozen**: never regenerate it (Claude generates portraits and name audio from it). If a change is unavoidable, write `BLOCKED:` in PROGRESS.md and wait.

### 9.1 The league
- Name: **The Meridian League**. Fictional country, not named. Season label "Season 1".
- 10 clubs, double round-robin, 18 matchdays. 3 points for a win, 1 for a draw.
- Tiebreakers in order: points, goal difference, goals for, head-to-head points, head-to-head goal difference, club name A→Z.

### 9.2 The ten clubs (exact data for `clubs.data.ts`)

| id | Name | Code | Nickname | City | Founded | Stadium | Capacity | Rep | Colors primary / secondary / text | Home kit | Away kit | Style: formation, mentality, passing, tempo, pressing, line, width | AI manager | Expectation target / acceptable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c01 | Port Calloway FC | PCF | The Mariners | Port Calloway | 1884 | The Lanternworks | 52,000 | 5 | #0B1F3A / #F2B705 / #FFFFFF | navy solid, gold trim, navy shorts, navy socks | white solid, navy shorts, white socks | 4-3-3, Attacking, Short, Normal, High, High, Wide | Edmund Harrow | 1 / 2 |
| c02 | Ironvale Athletic | IVA | The Forge | Ironvale | 1891 | Furnace Park | 41,000 | 4 | #2B2B2B / #FF6A13 / #FFFFFF | charcoal/orange stripes, black shorts, orange socks | orange solid, charcoal shorts, charcoal socks | 4-4-2, Balanced, Direct, Fast, High, Normal, Normal | Grete Lindqvist | 3 / 4 |
| c03 | Kestrel Bay FC | KBF | The Kestrels | Kestrel Bay | 1902 | Cliffside Ground | 38,500 | 4 | #0E8C8C / #FFFFFF / #FFFFFF | teal solid, white shorts, teal socks | white with teal sash, white shorts, white socks | 4-2-3-1, Balanced, Short, Slow, Mid, Normal, Normal | Oriol Benet | 3 / 4 |
| c04 | Saltmere Rovers | SAL | The Rovers | Saltmere | 1879 | Brinegate Road | 33,000 | 3 | #6D1A36 / #8FC5E8 / #FFFFFF | claret body sky sleeves (halves), white shorts, sky socks | sky solid, claret shorts, sky socks | 4-4-2, Balanced, Mixed, Normal, Mid, Normal, Wide | Declan Ashworth | 5 / 6 |
| c05 | Brightwater City | BWC | The Lamps | Brightwater | 1910 | Lamplight Stadium | 30,500 | 3 | #4FA3E0 / #FFFFFF / #0B1F3A | sky solid, white shorts, sky socks | dark navy solid, navy shorts, navy socks | 4-3-3, Attacking, Short, Fast, High, High, Normal | Amara Okonkwo-Hale | 5 / 6 |
| c06 | Northgate Albion | NGA | The Gate | Northgate | 1888 | The Gatehouse | 29,000 | 3 | #1E7B3C / #FFFFFF / #FFFFFF | green/white hoops, white shorts, green socks | yellow solid, green shorts, yellow socks | 4-1-4-1, Defensive, Mixed, Normal, Mid, Deep, Normal | Pieter Vos | 5 / 6 |
| c07 | Ashcombe United | ASU | The Ashes | Ashcombe | 1896 | Ember Lane | 27,500 | 3 | #C8102E / #111111 / #FFFFFF | red solid, black shorts, red socks | black solid, black shorts, red socks | 3-5-2, Balanced, Direct, Normal, Mid, Normal, Wide | Tomasz Wrona | 5 / 6 |
| c08 | Veldmoor Town | VDT | The Moorsmen | Veldmoor | 1899 | Heathside | 21,000 | 2 | #4B2A7B / #FFFFFF / #FFFFFF | purple solid, white shorts, purple socks | white with purple chevron, purple shorts, white socks | 5-3-2, Defensive, Direct, Slow, Low, Deep, Narrow | Bernard Quill | 8 / 9 |
| c09 | Lindenfield FC | LIN | The Lindens | Lindenfield | 1921 | Linden Meadow | 19,500 | 2 | #FFD100 / #111111 / #111111 | yellow solid, black shorts, black socks | black solid, yellow shorts, black socks | 4-4-2, Balanced, Mixed, Normal, Mid, Normal, Normal | Sade Adeyemi | 8 / 9 |
| c10 | Corvallen Wanderers | COR | The Crows | Corvallen | 1905 | Rookery Park | 18,000 | 2 | #111111 / #FFFFFF / #FFFFFF | black/white stripes, black shorts, black socks | white solid, black shorts, white socks | 3-4-3, Attacking, Direct, Fast, High, High, Wide | Ivo Marchetti | 8 / 9 |

Every club's GK kit: shirt `#2EE59D` (c01–c05) or `#FF8A00` (c06–c10), shorts and socks same as shirt, pattern solid.

Expectation labels: target 1 → "Win the league"; 3 → "Finish in the top three"; 5 → "Finish in the top half"; 8 → "Stay out of the bottom two".

Rivalries (derbies, both directions): c01–c03 "The Coast Derby"; c02–c07 "The Iron & Ember Derby"; c09–c10 "The Little Derby"; c04–c06 "The Old Road Derby".

Finances at season start by reputation:
| Rep | balance | transferBudget | wage budget |
|---|---|---|---|
| 5 | 70,000,000 | 40,000,000 | 108% of generated weekly wage bill, rounded up to 10,000 |
| 4 | 42,000,000 | 22,000,000 | same rule |
| 3 | 24,000,000 | 11,000,000 | same rule |
| 2 | 12,000,000 | 5,000,000 | same rule |

Board confidence starts at 65 and fan mood at 60 for every club.

Formation familiarity: the club's style formation 85; formations sharing its back line (4 at the back: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1; 3 at the back: 3-5-2, 3-4-3; 5 at the back: 5-3-2) 60; all others 40.

### 9.3 Squads
Each club has exactly **24 players**:

| Primary position | Count | Secondary positions |
|---|---|---|
| GK | 3 | — |
| CB | 5 | — |
| LB | 1 | LWB |
| RB | 1 | RWB |
| Full back (primary LB) | 1 | RB |
| DM | 2 | — |
| CM | 3 | — |
| AM | 1 | — |
| LM | 1 | LW |
| RM | 1 | RW |
| LW | 1 | — |
| RW | 1 | — |
| ST | 3 | — |
| **Total** | **24** | |
Free agents: **40 players** (positions: GK 4, CB 7, FB 5, DM 3, CM 6, AM 3, wide 6, ST 6), ages 21–33, OVR 52–68.
Total: 240 + 40 = **280 players**. IDs `p0001`–`p0280`, assigned club by club in club-id order, then free agents.

Squad numbers: give the standard numbers to the highest-OVR player of each role: GK = 1, RB = 2, LB = 3, CB (best) = 4, CB (second) = 5, DM = 6, RW = 7, CM = 8, ST = 9, AM = 10, LW = 11. Every other player, sorted by OVR descending, gets the lowest unused number from 12 to 35.

### 9.4 Player generation (in `generateWorld.ts`)
For each club, assign target OVRs:
1. Club mean `M` by reputation: rep 5 → 74, rep 4 → 70, rep 3 → 66, rep 2 → 62.
2. The best-XI candidates (the 11 primary-slot players of the style formation, picked as: 1 GK, back line, midfield and attack matching the formation) get target `M + normal(2, 3)`; pick two of them at random (not GK) as **key players**: +6 more.
3. 9 squad players get `M + normal(-3, 3)`.
4. 4 prospects (ages 17–20) get `M + normal(-9, 3)`.
5. Clamp targets to 45–90.

Ages: best-XI and squad players: 22–33 drawn with weights 22–24: 30%, 25–28: 40%, 29–31: 22%, 32–33: 8%. Prospects 17–20 uniform. Free agents 21–33 uniform.

Attributes for a player with primary position `P` and target OVR `T`:
1. For each attribute `a`: `w = weight of a in P's OVR table (§9.5)` (0 if absent).
   - if `w > 0`: `raw = T + 2 + 30·w + normal(0, 4)`
   - else if `a` is a goalkeeping attribute and `P ≠ GK`: `raw = rng.int(1, 15)`
   - else if `P = GK` and `a` is an outfield technical/physical attribute (finishing, longShots, crossing, dribbling, tackling, heading, setPieces, pace, offTheBall): `raw = rng.int(8, 35)`
   - else: `raw = T - 10 + normal(0, 6)`
2. Round and clamp each to 1–99.
3. Compute OVR at `P` (§9.5). Let `d = T - OVR`. Add `d` to every attribute with `w > 0`, clamp, recompute. Repeat up to 3 times until `|T - OVR| ≤ 1`.
4. Personal flavour: pick 1 "signature" attribute among P's weighted ones and add `rng.int(4, 9)` (clamp 99); pick 1 weighted attribute as a weakness and subtract `rng.int(4, 9)` (clamp 1). Recompute OVR (it may move by 1–2; that is fine).

Potential: `potential = min(95, OVR + headroom)` where headroom by age: 17–20 → `rng.int(8, 22)`, 21–23 → `rng.int(4, 14)`, 24–27 → `rng.int(0, 8)`, 28–30 → `rng.int(0, 3)`, 31+ → 0.

Secondary positions: as listed in §9.3, plus with 35% chance one natural neighbour from this map: CB↔DM, LB↔LWB↔LM, RB↔RWB↔RM, DM↔CM, CM↔AM, AM↔ST, LM↔LW, RM↔RW, LW↔ST, RW↔ST. Familiarity for secondaries: `rng.int(78, 92)`.

Other fields: heightCm: GK 186–198, CB 183–196, ST 175–193, others 168–188 (uniform). Foot: left-sided positions 70% Left, right-sided 85% Right, central 80% Right / 12% Left / 8% Both. Personality weights: Professional 25, Ambitious 20, Leader 10, Relaxed 20, Temperamental 15, Loyal 10. Condition 95–100, fatigue 0–10, morale 55–70.

Contract: role by squad rank by OVR within club: top 2 = Star, 3–11 = Starter, 12–17 = Rotation, rest = Backup, but prospects = Prospect. `yearsLeft` 1–4 (weights 20/35/30/15). Wage = `wageFor(value)` (§12.10).

Nationality weights: ENG 30, NGA 10, FRA 8, ESP 7, BRA 7, NED 5, GHA 5, POR 5, GER 5, IRL 4, SEN 4, SCO 4, ARG 3, DEN 3.

### 9.5 OVR weight tables (`ratings.ts`)
OVR at position = round(Σ w·attribute). Weights per position group (each row sums to 1.00):

| Group (positions) | Weights |
|---|---|
| GK | reflexes .30, handling .20, oneOnOnes .20, aerialCommand .15, decisions .05, composure .05, passing .05 |
| CB | tackling .22, positioning .25, heading .18, strength .12, pace .08, decisions .08, composure .07 |
| FB (LB, RB, LWB, RWB) | tackling .16, positioning .16, pace .18, stamina .12, crossing .14, passing .10, workRate .08, dribbling .06 |
| DM | tackling .18, positioning .20, passing .18, decisions .14, stamina .10, strength .10, workRate .10 |
| CM | passing .24, decisions .16, firstTouch .12, stamina .12, workRate .10, tackling .08, positioning .06, longShots .06, composure .06 |
| AM | passing .20, dribbling .16, firstTouch .14, decisions .14, offTheBall .12, longShots .10, composure .08, finishing .06 |
| WIDE (LM, RM, LW, RW) | pace .18, dribbling .20, crossing .16, firstTouch .10, offTheBall .12, finishing .08, stamina .08, passing .08 |
| ST | finishing .26, offTheBall .18, composure .14, firstTouch .10, heading .10, pace .10, strength .06, dribbling .06 |

`ovrAt(player, pos) = round(rawOvr(pos) × fam)` where `fam` = familiarity/100 for a listed position; for an unlisted position: same group 0.80, adjacent group (DEF↔MID, MID↔FWD) 0.65, otherwise 0.45; GK slot for an outfielder 0.20; outfield slot for a GK 0.30.

Position groups: GK = GK; DEF = CB, LB, RB, LWB, RWB; MID = DM, CM, AM, LM, RM; FWD = LW, RW, ST.

### 9.6 Names (`names.data.ts`)
- One pool per nation code: at least 40 first names and 60 surnames, culturally plausible and common (not famous).
- Full names MUST be unique across all 280 players and 10 AI managers.
- `blocklist.data.ts`: at least 300 full names of famous current and historic footballers and managers. A generated full name matching (case-insensitive) a blocklisted name, or a surname matching one of the 60 most famous surnames you list in `FAMOUS_SURNAMES`, MUST be re-rolled.
- 15% of BRA and 10% of POR players get a one-word `knownAs` built from a first-name pool (e.g. "Tiago"). Display name = `knownAs ?? lastName` in compact views, `firstName lastName` in profiles.
- Test: uniqueness and blocklist checks run in `tests/core/world/generateWorld.test.ts`.

### 9.7 The manager (the player)
The player types a manager name at new game (default "Alex Morgan" is a real person, so use default **"The Gaffer"**). Max 24 chars, letters, spaces, apostrophes, hyphens. Shown in press and news.

---

## 10. Game flow and calendar

### 10.1 Phases (state machine in `core/game/advance.ts`)
```
New Game ─▶ BoardMeeting ─▶ Preseason ─▶ TransferWindow(Preseason, rounds 1→3)
   ─▶ [ PreMatch ─▶ Match ─▶ PostMatch ─▶ WeekSummary ] × matchdays 1..9
   ─▶ TransferWindow(Midseason, rounds 1→3)
   ─▶ [ PreMatch ─▶ Match ─▶ PostMatch ─▶ WeekSummary ] × matchdays 10..18
   ─▶ SeasonEnd
Any WeekSummary may divert to ─▶ Sacked (§12.7)
```
- The user can skip the transfer windows with "Skip window" (AI rounds still resolve instantly).
- The top-bar **Continue** button (and Space) always advances to the next required step. If an action is required (e.g. invalid lineup, pending offer response with a deadline), Continue opens it instead and explains why in one sentence.

### 10.2 What happens on each advance
1. **PreMatch → Match**: lock lineups (AI picks theirs, §13.13), start worker, simulate the round's other 4 fixtures in `season.worker` instantly but reveal their goals by minute during our match ("Around the league" ticker).
2. **Match → PostMatch**: write results; update table, player stats, condition, fatigue, injuries, discipline, morale, form, board confidence, fan mood, finances (gate on home games).
3. **PostMatch → WeekSummary**: run the week (7 days): training (§12.3), development (§12.4), recovery, injury healing (−1 matchday each), suspensions served are already decremented when a match is missed, AI club transfers are only in windows, generate inbox items (§12.11), news (§16.6), conversation triggers (§12.9), wages paid (§12.10). Autosave.
4. **WeekSummary → PreMatch** (next matchday) or the transfer window after matchday 9, or SeasonEnd after matchday 18.

### 10.3 Fixture list
Circle method for 10 teams, rounds 1–9; rounds 10–18 repeat rounds 1–9 in the same order with home/away swapped. Then permute so no club has more than 2 consecutive home or away games (swap venue within pairs of rounds where needed, test it). Derbies MUST NOT occur in round 1. Kickoff: matchday ordinal per fixture via `deriveSeed(WORLD_SEED,'kickoff',fixtureId)`: 50% Afternoon, 30% Evening, 20% Night; all derbies are Night. Weather: 70% Clear, 20% Overcast, 10% Rain (deterministic per fixture). Fixtures are part of the world snapshot (identical in every save).

---

## 11. Screens

### 11.0 Global shell and keyboard map
- **Top bar** (56 px, full width; there is no sidebar, v1.6): crest + club name (left); then the **navigation tabs** in two groups. On air: Hub, League, Fixtures. The office: Squad, Tactics, Training, Transfers (only enabled during windows; otherwise shows "Scouting" list read-only), Club (Finances + Board), Inbox (unread count as a badge on the tab). Right: status chip "MD 7/18 · 3rd · 14 pts", balance, settings gear, **Continue** button (accent, always visible, label changes: "Continue", "Go to Match", "Kick Off", "Next Round", "Finish Window"). Behaviour and widths in §19.6.
- **Club spaces (v1.7):** each tab is also a place in the club building. A tab click makes the coach walk to that room, and the screen opens there (§11.25).
- **Ticker** (36 px, bottom of on-air screens, §19.5).
- **Keyboard:** `Space` Continue / confirm primary; `Esc` close modal / back / pause match; `1`–`9` navigation tabs in order (outside the match); in match: `P` pause, `1` `2` `3` speed (Key highlights, Extended, Full), `T` tactics panel, `S` substitutions, `C` cycle camera, `R` replay last goal, `H` hide HUD, `F` fullscreen, `I` instant result (with confirm). Show key hints (KeyHint component) next to every primary button.
- Every list/table row is keyboard-focusable and opens with Enter.

### 11.1 Boot / loading
Plain HTML/CSS splash inside `index.html` (no JS needed): dark background, game logo text in the heading font, a thin progress bar. It MUST paint within 300 ms of navigation. React replaces it when ready. Then preload the title assets (logo, title background image, music) and prefetch the three.js chunk in idle time.

### 11.2 Title
- Background: title image `images/ui/title_bg.webp` (fallback: CSS gradient + animated pitch lines). If three.js chunk is loaded and quality ≥ Medium, MAY show a slow 3D stadium flyover instead.
- Logo text: `GAME_TITLE` in Barlow Condensed 700, 96 px.
- Buttons: **Continue** (only if an autosave exists, shows club + matchday), **New Game**, **Load**, **Settings**, **Credits**.
- Music: `music/title_theme.mp3` loop (starts after the first user gesture, per browser autoplay rules: show "Click anywhere to start" overlay on first visit).

### 11.3 New Game
Step 1 — **Choose your club**: a carousel of 10 club cards (crest, name, nickname, stadium, stars for reputation, board expectation, transfer budget, "Difficulty: Easy/Normal/Hard/Very Hard" where rep 5 = Easy, 4 = Normal, 3 = Hard, 2 = Very Hard), plus a squad preview (best XI on a mini pitch with OVRs). Arrow keys/clicks change the club. Enter confirms.
Step 2 — **Your name** (text input, default "The Gaffer") and **Tutorial on/off** (default on).
Step 3 — Start: create the save (§20), go to BoardMeeting.

### 11.4 Board Meeting (once, at start)
Full-screen card styled like a meeting room: chairman portrait (fictional, `images/people/chairman_{clubId}.webp`, fallback avatar), the expectation, transfer budget, wage budget, and three bullet "board notes" generated from club data (e.g. "We expect attacking football." from mentality; "Develop young players." if the club has ≥2 prospects with potential ≥ 75). Button: "Accept the job".
**v1.7:** this takes place in the **Boardroom** (§11.25). The owner sits at the head of the table with 2 directors, speaks the welcome and the expectation (voiced, `club.json`), and the card above slides in on the table.

### 11.5 Hub (home screen)
Grid of cards:
- **Next match** (large): opponent crest, venue, matchday, kickoff, weather icon, opponent form (last 5), table positions, the assistant's one-line preview. Buttons: Go to match (Continue), Opponent report.
- **League snapshot**: top 3, your row, bottom 2, with movement arrows.
- **Inbox**: latest 4 unread.
- **Squad status**: counts of injured, suspended, tired (condition < 75), unhappy (morale < 40), with click-through filters to Squad.
- **Board & fans**: two Meters (0–100) with trend arrows and a one-line verdict ("The board is pleased with progress").
- **Latest news**: newspaper-style card with image and headline.
- **Assistant tip**: one actionable suggestion with an "Apply" button (§15.3).

### 11.6 Squad
- Table columns: #, Name (portrait thumb), Pos, Age, OVR (badge), Pot (★ display only: own players show 1–5 stars from potential), Cond (bar), Morale (icon + word), Form (5 dots coloured by rating), Apps, Goals, Assists, Avg rating, Value, Wage, Contract years, Status icons (injury, suspension, transfer listed, promise).
- Filters: All / GK / DEF / MID / FWD / Injured / Unhappy. Sort by any column. Search by name.
- Row click → Player Profile.

### 11.7 Player Profile (modal-sized page, 960 px wide)
- Presented as a player file opened on the desk (Sheet "file" variant, §19.5; opening animation §19.7): manila tab with the name, the portrait clipped to the first sheet, status shown as Stamps (INJURED, SUSPENDED, TRANSFER LISTED, NOT FOR SALE, SCOUTED).
- Header: portrait (256²), name, number, positions with familiarity chips, age, nationality flag (simple CSS flag or emoji-free SVG; no flag assets needed: draw horizontal/vertical tri-bands per nation in `procedural/flags.ts`), height, foot, personality, OVR badge, potential stars, value, wage, contract, squad role.
- Tabs: **Attributes** (three columns Technical/Physical/Mental, plus Goalkeeping for GKs; each AttrBar coloured per §19.4; for unscouted other-club players show ranges e.g. "60–72", §12.12), **Stats** (season table + last 5 matches ratings sparkline), **Status** (condition, fatigue, morale with reasons list "Won last match +6", injury details, suspension), **History**.
- Actions (own players): Set as captain, Set as taker (penalty/free kick/corner), Transfer list / Remove, Not for sale, Individual training focus (dropdown of attributes, §12.3), Talk to player (opens conversation if allowed: max 1 per player per matchday).
- Actions (other players): Scout (in windows), Make offer (in windows), Shortlist toggle.

### 11.8 Tactics
- The whole screen is the office tactics wall (§19.1): the PitchBoard is a whiteboard (`--board`, pitch lines drawn in `--board-ink` at 35% like marker pen), the tokens are Magnets (§19.5), instructions sit on a clipboard Sheet beside it, and the bench is a row of magnets along the board's bottom edge.
- Left: **PitchBoard** (2D SVG pitch, sideways since v1.7: own goal on the left) with 11 draggable player tokens (shirt colour, number, surname, OVR at slot coloured by fit: green ≥ natural, amber 0.8–0.95, red < 0.8). Drag a token onto another to swap; drag from the bench list onto a token to replace.
- Right: formation dropdown (7), familiarity meter for the selected formation, the seven instructions as three-way segmented controls with a one-line description each (§13.10), roles and player instructions per slot (click token → role card, §13.17.6), transitions and set pieces, opposition orders, captain, takers (penalty, free kick, corner, long throw).
- Bench: up to 9 players, list with drag handles.
- Buttons: **Assistant picks best XI** (§13.13 algorithm), **Reset to club style**, Presets: "Park the bus" (Defensive, Direct, Slow, Low, Deep, Narrow, Centre), "Control" (Balanced, Short, Slow, Mid, Normal, Normal, Mixed), "Gegenpress" (Attacking, Short, Fast, High, High, Normal, Mixed), "Counter" (Defensive, Direct, Fast, Low, Deep, Wide, Mixed), "All-out attack" (Attacking, Mixed, Fast, High, High, Wide, Mixed).
- **Layout (v1.7, wins over the bullets above where they differ; the v1.6 three-column vertical layout is withdrawn):** two columns with no page scroll. **Left:** the whiteboard lying **sideways** (own goal on the left, attacking right), dominant, with the bench strip under it. **Right:** a tall panel that is the clipboard (plans, formation, familiarity, the five dividers, opposition orders) until a player is selected, when his file slides over it: header, a RadarChart that always stays in view, then Orders and Profile tabs. Full layout in `docs/design/tactics/README.md` "v5 layout".
- Validation (blocks Kick Off with a clear message): exactly 1 GK in the GK slot, 11 starters, no injured/suspended player in XI or bench, no duplicates.

### 11.9 Training
**v1.7 (wins over the bullets below where they differ; rules in §12.18):** the screen lives on the training ground (§11.25), with no page scroll. The board on the left is the **week**: a grid of days × morning and afternoon with session cards (category colour, name, load pips). You drag cards from a library strip under it, or press Enter on a slot to pick one. Above it are the template dropdown, intensity, **Theo's week** (memo and Apply), "Let Theo plan every week", the week's load meter with its condition and injury forecast, and the team's average training rating. The panel on the right has tabs: **Players** (focus, workload, extra sessions, rest, mentor, this week's rating with a 6-week sparkline, injury risk, overload flag; selecting a row opens his file with the attribute arrows), **One-to-one** (the week's pick, the four types with their effects, Theo's suggestion, then the scene), and **Progress** (the selected player's season OVR line, attribute arrows and coach's note). The 3D drills on the training ground follow the category that dominates the week.

- Team focus (6 cards with icons and effect descriptions from §12.3), intensity (Light/Normal/Hard with injury-risk and recovery indicators).
- Individual focus table: players with a dropdown grouped as Attribute / Role / Position (or "None") (§12.17.4), a rest toggle (§12.17.3), and an injury-risk chip (§12.17.6).
- "Last week" panel: growth summary (players who improved, with +OVR), training injuries.

### 11.10 Transfers (only in windows)
- Header: window name, "Day 1 of 3 / Day 2 of 3 / Deadline Day" stepper, transfer budget remaining, wage budget used/total, squad size N/26 (min 16, 2 GK).
- Tabs: **Search** (all non-own players + free agents; filters: position group, age range, OVR range (estimated for unscouted), max value, club; columns: name, club, pos, age, OVR (or range), value, wage, contract), **Shortlist**, **Offers** (my bids with status; incoming bids for my players with Accept/Reject/Counter), **Scouting** (queue up to 2 per day; results next day).
- Make Offer dialog: fee input with +/− steps (5% of value), shows "Asking price estimate: high/fair/low" only after scouting the player OR if the club's response was a counter; then on acceptance → Contract dialog: wage, years (1–4), role promise (Star/Starter/Rotation/Backup), signing on.
- "Advance day" button (Continue) resolves AI responses and AI activity (§12.13). After Deadline Day the window closes.

### 11.11 League
Tabs: **Table** (full table with form, positions coloured: 1st gold mark, 2–3 accent mark, bottom 2 red mark; rows reorder with FlipList after each matchday), **Results by matchday** (selector 1–18), **Stats** (top scorers, assists, average ratings (min 5 apps), clean sheets (GK), yellow/red cards), **Clubs** (club cards: click → club page with squad (estimated OVRs), stadium, manager, form).

### 11.12 Fixtures
Your 18 fixtures with result, scorers, attendance, MOTM; upcoming ones show opponent position and form.

### 11.13 Club
Tabs: **Finances** (balance, this season income/expense breakdown bars, weekly wage bill vs budget, projection to season end), **Board** (confidence meter, expectation, history of confidence per matchday as a line chart, messages), **Fans** (mood meter, attendance per home game chart, quotes from §16.6 fan reactions), **Stadium** (name, capacity, image `images/stadium/{clubId}.webp` fallback to a 3D thumbnail or gradient).

### 11.14 Inbox
Two-pane: list (kind icon, title, matchday, unread dot) and reading pane (body, action buttons). Items requiring action are pinned to the top until handled.

### 11.15 Pre-Match
Three steps in a stepper bar, each skippable with Continue:
1. **Opponent report** (assistant): their likely XI on a mini pitch (estimated OVRs), formation and style words ("They press high and play direct"), key player card, a weakness ("Their left back is slow (pace 58)"), and "Suggested approach" with an **Apply** button that sets 1–3 instructions (§15.2).
2. **Team selection** (embedded Tactics with the assistant's suggestion highlighted; warnings for tired players).
3. **Team talk** (§12.8): 6 tone buttons with a short preview of likely reactions ("Most players will respond well").
Then **Kick Off**.

### 11.16 Match (live)
Full-window 3D view (§14) with HUD:
- Top-left: scoreboard bug (crests, codes, score, clock "67:12", added-time "+3" indicator, red-card markers).
- Top-right: speed selector, camera button, pause.
- Bottom: commentary caption strip (latest line, fades after 4 s), with a voice indicator.
- Left drawer (toggle): live stats (possession, shots, on target, xG, corners, fouls, cards), momentum chart (rolling xG per 5 min, both teams).
- Right drawer (toggle): **Assistant** feed (§15.4) with Apply buttons; **Around the league** ticker.
- Bottom-right buttons: **Tactics** (T) opens an overlay with the Tactics screen in compact mode; **Subs** (S) opens a substitution panel (on-pitch list with condition bars and ratings; bench list; pick out → pick in; remaining subs "3 of 5 · windows 2 of 3").
- Between highlights (Key/Extended modes) show a transparent overlay "time-lapse" with the clock ticking fast and a tiny 2D radar of the ball position; never a frozen screen.
- Goal: slow-motion replay (§14.7), score bug animation, crowd roar, commentary.
- Half-time and full-time screens (§11.17, §11.18).

### 11.17 Half-Time
Stats comparison, assistant's half-time analysis (2–3 bullets with Apply buttons), team talk (half-time contexts), quick substitutions and tactics changes, then "Second half" (Continue). Real-time budget: the user controls it; no timer.

### 11.18 Full-Time and Post-Match
1. **Result**: final score, scorers with minutes, MOTM card, player ratings for both teams (sortable), full stats, shot map (2D pitch with shot dots sized by xG, filled for goals), xG timeline.
2. **Team talk** (full-time contexts).
3. **Press conference** if triggered (§12.6): journalist portrait, voiced question, 3 answers.
4. **Back page**: newspaper-style headline for the match (§16.6) with image.
5. Continue → WeekSummary.

### 11.19 Week Summary
One screen: other results of the round, updated table excerpt, injuries/returns, training growth highlights, finance line (wages paid, gate income), board/fan changes with reasons, inbox items that need action. Continue → next PreMatch.

### 11.20 Season End
Sequence of full-screen cards (each Continue): Final table → Awards (§12.15) → Your season in numbers (W/D/L, goals, best win, top scorer, signings) → Board verdict with grade (§12.16) and score → "Share card" (a 1200×630 canvas image the user can download as PNG, with club crest, final position, grade, top scorer) → buttons: New Game, Title.

### 11.21 Sacked
Dramatic card: "You have been relieved of your duties." Reason, record, grade F, score. Buttons: Load last save, New Game.
**v1.7:** the coach is called to the **Boardroom**. The owner tells him to his face (voiced, `club.json`, mood angry or worried by the reason), then the card.

### 11.22 Settings (modal)
Audio: master, music, crowd, commentary, effects (sliders 0–100), commentary voice on/off (captions stay). Gameplay: default match speed, auto-continue after highlights (on/off), confirm before Instant Result, **coach walks between rooms (on/off, §11.25.2)**. Graphics: Quality Auto/Low/Medium/High, show FPS. Accessibility: reduce motion, larger UI text (+12.5%), colour-blind-friendly attribute colours (blue→orange scale). Data: export save (JSON download), import save, delete saves.

### 11.23 Credits
Game by [entrant name] — leave a placeholder constant `CREDITS` in `constants.ts` that the user fills in. Lists collaborators, "Voices: ElevenLabs", "Images: fal", "3D models: Meshy", fonts (Barlow Condensed, Inter — SIL OFL), three.js (MIT), React (MIT). Show license notices.

### 11.24 Tutorial (first season, can be turned off)
Seven coach-marks shown by the assistant in a speech-bubble component, each once: (1) Hub overview, (2) Continue button, (3) Tactics: drag a player, (4) Assistant Apply button in Pre-Match, (5) Team talk, (6) Match HUD controls (speed, subs, camera), (7) Week summary and board meter. "Skip tutorial" always visible.

### 11.25 Club spaces (v1.7, `src/club3d/`)
The menus become places. Every screen in §11 keeps its content, rules and keyboard access, and is shown inside a room of one club building. You play the coach living the club's week, filmed like a TV documentary.

#### 11.25.1 Rooms
Each room is one small three.js set. Walls, floors, ceilings and windows are built in code (`rooms.ts`), with props from `models/club/*.glb` and window and backdrop images from `images/club/` (§18.2). Only the current room is drawn. The next room loads while the coach walks, and a room's props are kept in memory after its first visit.

| Room | Set | Screens and moments |
|---|---|---|
| **Exterior** | The club at dusk: brick main stand, floodlights warming up, car park | Title, New Game. On Start, the camera flies in through the front doors. |
| **Corridor** | A short corridor with a door per room. Each door has a sign (text drawn by the game) and a lamp that lights on hover. | Between every two rooms |
| **Office** | Desk, chair, lamp, phone, wall TV, a window onto the pitch, the sideways whiteboard (§11.8) on the wall, a second chair for Theo | Hub, Inbox, Club (finances), Transfers, and **Tactics** (the coach and Theo at the whiteboard, §14.11.4). **On-air screens (League, Fixtures, Week Summary) play on the wall TV:** the camera pushes into the TV and the broadcast UI fills the screen. Player conversations (§14.11.3). |
| **Boardroom** | A long table, leather chairs, framed portraits of past chairmen (programme print, no text), the owner and 2 directors | Board Meeting (§11.4), board reviews (when §12.7 confidence crosses a band, and budget requests from Club), Sacked (§11.21) |
| **Dressing room** | **One big room with lockers and a bench running around the walls** (back wall and both sides, a U), so the squad sits in a ring facing the middle. The coach stands in the middle on a crest-pattern floor (pattern only), with Theo near the door and a tactics board on a stand. The players' shirts hang in the lockers (name and number drawn by the game, §14.2 kit). The default shot is from the front of the U, slightly raised, looking past the coach at the players. | **Squad**: click a locker to open that player's Profile. **Pre-Match briefing**: the coach presents Plan A on the board (key battles, takers, who marks whom) while the players listen. **Team talks** pre-match, at half-time and full-time (§12.8). Half-Time and Full-Time. |
| **Tunnel** | Concrete walls, studs, the pitch light at the end | The walk-out after the pre-match talk, straight into the M4 match intro |
| **Training ground** | A grey afternoon, cones, mannequins, a small stand, a clipboard in the foreground | Training (§11.9), with drills by focus (§14.11.4) |
| **Press room** | A table with microphones, a club backdrop (pattern only), rows of reporters, camera flashes | Press Conference (§11.18 step 3, pre-match press) |

#### 11.25.2 Moving between rooms (`walk.ts`)
- A tab click or a door click makes **the coach walk there** on a fixed path through the corridor. The camera follows behind him at shoulder height like a documentary shot, and he opens the door (`DoorOpen`). **A walk takes at most 2.5 s**; paths are timed to fit.
- **Any click or key during a walk skips to arrival.** Number keys `1`–`9` cut straight to the room with the `ScreenTransition` wipe (§19.7) and no walk.
- Setting **"Coach walks between rooms"** (§11.22), default **on**. When off, every move is a cut with a wipe.
- The Continue button moves the story on through rooms by itself: Hub → (press, if pre-match press) → dressing room briefing and talk → tunnel → match → dressing room → press room → office.
- **Budget:** walks add no more than 3 minutes to a full season with default settings (measure in M6b, §23).
- Reduce motion (§11.22): walks become cuts; people still animate in place.

#### 11.25.3 How screens sit in a room
- When the camera settles on a room's mark, the screen arrives as an object in the shot: papers slide onto the desk, the board on the wall, the clipboard at training, cards on the boardroom table. Layout and content are the existing screen designs (§19, `docs/design/`), re-framed to sit in the shot.
- **The room is the frame and the UI is the content.** The room stays visible around the edges. Panels behind text are opaque, so legibility never depends on the 3D. Office screens still fit the window with no page scroll (§19.6).
- The top bar stays on every screen. On-air screens on the TV keep their broadcast look; office screens keep their paper and board look.
- With no models or images, rooms are lit boxes in the ART-DIRECTION colours and people are capsules (§14.2 fallback). Every screen stays fully usable, and the game plays offline with nothing delivered.

#### 11.25.4 Look around (the player controls the camera)
The Meshy sponsor track judges models "under a camera you do not control", so in every room the player can move the camera.
- **Mouse:** hold the right mouse button and drag to turn the camera around the room's mark: yaw ±60°, pitch −20° to +15°. The scroll wheel leans in or out by up to 1.5 m along the view. **Keyboard:** `Shift` + arrow keys turn, and `Shift` + `+`/`−` lean.
- **Limits:**
  - The camera never passes through walls or props (clamp against the room's bounding box minus 0.3 m).
  - It never gets closer than 1.2 m to any person's head, so the §14.11.8 framing rule still holds.
- **Release:** let go and the camera eases back to the room's normal shot over 600 ms (spring, §19.7). A screen panel stays where it is while you look; panels fade to 30% while the button is held, so the room can be seen behind them.
- **Not available during a walk, a cutscene or a touchline cut.** In the match, the existing Free camera (§14.4) does this job.
- **First time in each room:** a small one-time hint "Right-drag to look around" (KeyHint style) shows for 4 s, then never again. This is not one of the seven tutorial coach-marks.
- **Reduce motion:** the ease-back is instant.
- **Craft:** because anyone can look at any prop from any side, every Meshy prop and person must hold up from every angle reachable inside these limits. Claude checks this in the M6b review.


#### 11.25.5 Talk scenes: watch, then choose (the user, 22 Nov)
**This is the one pattern for every moment in the game where people talk** (the user, 22 Nov): team talks, the pre-match briefing, press conferences, player conversations at the door or locker, board meetings and reviews, the sacking, one-to-one sessions, Theo's office visits and week plan, signing day (§24 extras), and any later scene. No screen ever shows choices while someone is speaking. (The only exception is the live match: touchline shouts use the HUD wheel, §13.21, because the match doesn't stop for them.) Every such moment is a scene made of two kinds of beat:
- **Speaking beats** (someone talks): no menus or panels on screen, only the caption strip and the scene. The player can't act during them, except to skip:
  - `Space` or a click skips the current line.
  - `Esc` skips straight to the next choice, or to the end if there is none.
  - The skip hint ("Space skip · Esc skip to choice") shows small in a corner.
- **Choice beats** (your turn): the scene holds on an idle shot. The people keep breathing, blinking and glancing; nobody talks. The **choice card** slides up on screen with the options and nothing else: for a team talk, the 6 tones with each one's predicted reaction (§12.8); for press, the 3 answers; and so on. Pick with a click, number keys `1`–`6` or arrows and Enter. There is no timer.
- **After the choice,** the card slides away and the scene continues: the coach says the chosen line (voiced), the room reacts (§14.11.2), and either more talk follows or the scene ends. A short "How they took it" summary (one line per group of players) shows for 3 s after a team talk, then fades. It is also kept in the Half-Time and Full-Time screen's history.
- **Team talk order:**
  1. The coach walks into the middle.
  2. A short opener from Theo or the coach (speaking beat).
  3. Choice.
  4. The chosen line: if it names a player, he is the one looked at (§16.3).
  5. Reactions.
  6. For half-time only, Theo's analysis (§15.5) as a speaking beat with its Apply buttons on a small card.
  7. Continue to the tunnel.
- Reduce motion: cards appear without sliding. Keyboard-only play must reach every choice.

---

## 12. Management systems and exact rules

All numbers below go into `balance.ts`.

### 12.1 Condition (0–100)
- In-match drain per minute on the pitch: `0.22 × staminaFactor × pressingFactor × tempoFactor`, where `staminaFactor = 1.25 − stamina/200`, pressing High 1.12 / Mid 1.0 / Low 0.92, tempo Fast 1.05 / Normal 1.0 / Slow 0.96. A 90-minute player loses ~15–25.
- Weekly recovery (between matchdays): `+ (18 + stamina/10) × intensityRecovery`, Light 1.2, Normal 1.0, Hard 0.8; Fitness focus +4. Players who did not play recover an extra +6. Cap 100.
- Match effect: if condition < 70: all of that player's skill scores get `−(70 − condition)/100` in z-units (§13.4).
- A player with condition < 40 MUST NOT be selected (the UI blocks it; AI never does it).

### 12.2 Fatigue (0–100)
- After each match: `+ minutes/9`. Weekly: −6 (Light −9, Hard −4).
- Fatigue > 60: injury hazard × 1.5 and weekly recovery × 0.85. Fatigue > 80: show a red warning and the assistant suggests rest.

### 12.3 Training
Team focus effects (applied for the next match only, as a "preparation" bonus, and to development):

| Focus | Next-match bonus (z-units on listed contests) | Development weighting (attributes that receive growth) |
|---|---|---|
| Balanced | none | all weighted attributes of the player's primary position |
| Attacking | +0.04 to pass/dribble/shot execution | finishing, passing, firstTouch, dribbling, offTheBall, crossing |
| Defending | +0.04 to tackle/interception/block | tackling, positioning, heading, strength, decisions |
| Fitness | condition recovery +4 | stamina, pace, strength (only stamina for 30+) |
| SetPieces | +0.08 on corners, free kicks, penalties | setPieces, heading, crossing |
| Tactical | current formation familiarity +10 (extra) | decisions, positioning, composure, workRate |

Intensity: Light (growth ×0.6, injury ×0.5, recovery ×1.2), Normal (×1, ×1, ×1), Hard (×1.3, ×2.0, ×0.8).
Training injury chance per player per week: `0.004 × intensityInjury × (fatigue > 60 ? 1.5 : 1)`. Severity per §12.5.
Individual focus: 40% of that player's growth goes to the chosen attribute; the rest follows the team focus.

### 12.4 Development (weekly, in `development.ts`)
- Base OVR growth per week by age: ≤20: +0.45, 21–23: +0.30, 24–27: +0.12, 28–30: 0, 31–33: −0.10, 34+: −0.25.
- Multipliers for positive growth: `headroomFactor = clamp((potential − OVR)/10, 0, 1)`, `minutesFactor = 0.6 + 0.4 × min(1, minutesLastMatch/90)` (players who did not play: 0.6), `intensity` (§12.3), `morale ≥ 60 ? 1.1 : morale < 30 ? 0.8 : 1`.
- Add the result to `player.growth` (it can be negative). While `growth ≥ 1`: subtract 1 from `growth` and add +1 to each of **3** attributes picked (without repeats) from the training-focus list (§12.3), weighted by each attribute's OVR weight at the player's primary position (attributes with weight 0 get weight 0.05). If the player has an individual focus, that attribute is always one of the 3. Never raise an attribute above 99, and stop raising once OVR reaches `potential`. Recompute OVR after each +1 round.
- While `growth ≤ −1`: add 1 to `growth` and subtract 1 from 3 attributes, physical ones first (pace, stamina, strength), then any weighted attribute. Never below 1.
- Show "+1 OVR" toasts in WeekSummary.

### 12.5 Injuries
- In-match hazard per player per minute: `λ = 0.00012 × (1 + max(0, 70 − condition)/30) × (fatigue > 60 ? 1.5 : 1) × (opponent pressing High ? 1.15 : 1)`; probability over a step of `dt` minutes = `1 − exp(−λ·dt)`.
- Severity: Minor 55% (1–2 matchdays), Moderate 35% (3–5), Major 10% (6–12). Kind from `content/injuries.json` (at least 20 kinds with severity tags, e.g. "Hamstring strain", "Twisted ankle", "Knee ligament damage").
- An injured player on the pitch: if subs remain, the AI or user (prompted with a modal; auto after 10 s at Key/Extended speed) replaces them at the next stoppage; otherwise the team plays on with 10 (the player's skill scores −1.0 until then).
- Weekly: `matchdaysOut −1` each WeekSummary; at 0 → injury cleared, "Returned from injury" inbox item, condition set to 75.

### 12.6 Discipline and press triggers
- Yellow probability per foul `0.16 × foulerFactor` (Temperamental ×1.3, Professional ×0.85, tackling < 50 ×1.15). Direct red per foul `0.006` (Temperamental ×1.5). Second yellow → red.
- Bans: 5 yellows accumulated → 1-match ban (then reset); red (second yellow) → 1; direct red → 2.
- Press conference triggers after a match: derbies (always), matchday 1, results against a club ≥ 2 reputation higher (win or draw), losses by 3+, a winning/losing streak reaching 3, and otherwise 30% chance. Max one per matchday. Pre-match press (optional) before derbies only: shown as step 0 in Pre-Match.

### 12.7 Board confidence and sacking
- After each match: win +3 (opponent rep higher: +5), draw +1 if opponent rep higher else 0 (lower rep: −1), loss −3 (opponent rep lower: −5; by 3+ goals: −2 extra).
- After each matchday from matchday 4: if position ≤ target: +1; if position > acceptable: −1; if position ≥ acceptable + 3: −2 extra.
- Wage bill > wage budget at WeekSummary: −2. Balance < 0: −4.
- Clamp 0–100. At WeekSummary: if confidence < 25 and no warning yet → "Final warning" inbox item from the board. If confidence < 12 at any WeekSummary from matchday 6 → **Sacked**.

### 12.8 Team talks (`talks.ts` and `content/talks.json`)
Tones: **Calm**, **Motivate**, **Demand more**, **Praise**, **Disappointment**, **Focus**.
Contexts: `PRE_FAV` (our team avg OVR ≥ theirs + 3), `PRE_DOG` (≤ −3), `PRE_EVEN`, `HT_WIN`, `HT_DRAW`, `HT_LOSE`, `FT_WIN`, `FT_DRAW`, `FT_LOSE`.
Base morale effect per player (before personality): 

| Context \ Tone | Calm | Motivate | Demand | Praise | Disappoint | Focus |
|---|---|---|---|---|---|---|
| PRE_FAV | +2 | +1 | +3 | 0 | −3 | +3 |
| PRE_DOG | +3 | +4 | −2 | +1 | −4 | +2 |
| PRE_EVEN | +2 | +3 | +1 | +1 | −3 | +3 |
| HT_WIN | +2 | 0 | +2 | +3 | −4 | +3 |
| HT_DRAW | +1 | +3 | +2 | 0 | −1 | +2 |
| HT_LOSE | +1 | +3 | +2 | −2 | +1 | +1 |
| FT_WIN | +1 | 0 | −1 | +5 | −5 | +1 |
| FT_DRAW | +2 | +1 | 0 | +1 | −1 | +1 |
| FT_LOSE | +2 | +1 | +1 | −3 | +3 | 0 |

Personality multipliers on the base value: Professional ×1.0 (and never below 0 for Demand/Focus), Ambitious ×1.2 for Demand/Focus, ×0.8 for Calm, Leader ×1.3 for all positive, Relaxed: negative effects ×0.5, positive ×0.8, Temperamental: Demand and Disappointment flip sign with 40% chance (roll per player), all ×1.3, Loyal ×1.0 (Praise ×1.3).
In-match effect: pre-match and half-time talks also grant a team-wide `focusBoost` for the next 20 match minutes = average morale change / 100 in z-units (e.g. average +3 → +0.03).
UI shows each tone's predicted reaction as "Most will respond well / Mixed / Likely to backfire" from the sign and size of the expected average.

### 12.9 Player conversations (`conversations.ts`, `content/conversations.json`)
Triggers (checked at WeekSummary, at most 1 new conversation per week):
- **Playing time**: role Star/Starter or promisedRole Starter, started < 50% of the last 4 matches while fit → 60% chance.
- **New contract**: Ambitious or OVR rose by ≥ 3 this season and yearsLeft = 1 → 30% chance.
- **Unhappy morale**: morale < 30 → 40% chance.
- **Praise form**: avg rating ≥ 7.5 over last 3 → 20% chance (positive conversation).
Each conversation: the player's opening line and 3 replies with exact effects (morale, promise flags, a contract renewal flow that raises wage by 15–30%). A broken promise (promised Starter, started < 50% of the next 4 matches) → morale −15 and the player asks to be transfer listed.
Minimum content: 4 conversation types × 3 openings × 3 replies (with variation lines).

### 12.10 Finances
- `valueOf(player) = 1_200_000 × 1.16^(OVR − 60) × ageFactor × potentialFactor × contractFactor`, rounded to 2 significant figures (min 50,000). ageFactor: ≤21 1.4, 22–24 1.25, 25–28 1.0, 29–30 0.75, 31–32 0.5, 33+ 0.3. potentialFactor = `1 + max(0, potential − OVR)/40`. contractFactor: yearsLeft 1 → 0.75, else 1. Free agents: value shown, but no fee.
- `wageFor(value) = max(1_000, round to 500(value × 0.0016))` per week.
- Per matchday income: TV `600_000` each club; sponsor rep5 800k / rep4 600k / rep3 400k / rep2 250k; gate on home games = attendance × ticket price (rep5 €45, rep4 €38, rep3 €32, rep2 €26).
- Attendance = `capacity × clamp(0.55 + 0.4 × fanMood/100 + (derby ? 0.08 : 0) + (opponent rep 5 ? 0.04 : 0) + noise(±0.03), 0.4, 1.0)`.
- Expenses per week: wages (sum of squad wages), operating `100_000 × reputation`.
- Season-end prize money by final position: 1st 20M, then −2M per place (10th: 2M).
- Transfer fees move between balances; the buying club's transferBudget decreases by the fee; selling adds 50% of the fee to the transferBudget (and 100% to balance).

### 12.11 Inbox generation
At WeekSummary generate, in this order: medical (new injuries, returns), discipline (bans), board (warnings, praise when confidence ≥ 80 first time), assistant (one tip, §15.3), player (conversation requests), league (player of the month every 4 matchdays: best average rating with ≥ 3 apps in that span; manager of the month), transfer (incoming bids during windows; rumours outside windows: 1 per 3 weeks about a rival). Each item body is 1–3 sentences from templates in `content/news.json` (inbox section). No item may be generated twice for the same fact.

### 12.12 Knowledge and scouting
- Own players: exact attributes and OVR.
- Others unscouted: each attribute shown as a 12-point band containing the true value, offset deterministic per (playerId, viewer club) via `deriveSeed`: `low = clamp(true − rng.int(0, 11), 1, 88)`, `high = low + 11`. OVR shown as a band computed the same way with 8 points. Bands MUST be stable across reloads.
- Scouted (by user's club): exact values. Scouting a player takes until the next window round ("Day"); 2 players per round. Outside windows, the user may scout 1 player per matchday from the League → Clubs pages.
- Potential: never exact. Own and scouted players show stars: potential ≥ 85 ★★★★★, 78–84 ★★★★, 71–77 ★★★, 64–70 ★★, else ★.

### 12.13 Transfers (windows)
Window = 3 rounds (Day 1, Day 2, Deadline Day). On each **Advance day**:
1. Resolve the user's pending bids (in creation order).
2. Resolve scouting.
3. AI incoming bids for the user's players (§12.13.4).
4. AI–AI activity (§12.13.5).
5. Generate news for completed deals.

12.13.1 **Asking price** (selling AI club): `ask = value × importance × windowFactor × repFactor`, importance: player is in the club's top 3 by OVR ×1.6, rank 4–11 ×1.25, else ×1.0; windowFactor: Deadline Day ×1.1, else 1.0; repFactor: buyer rep > seller rep ×1.05 else 1.0. Players marked "not for sale" by AI: the club's top 1 by OVR at rep-5 clubs (reject all bids below 2.5× value).

12.13.2 **Response to a bid** `fee`: `fee ≥ ask` → Accepted; `fee ≥ 0.82 × ask` → Countered at `round(ask × rng(0.95,1.0))`; else Rejected. Max 2 bids per player per round. A counter can be accepted instantly by the user (then it is Accepted).

12.13.3 **Player decision** (after club acceptance): willing if `buyer rep ≥ seller rep − 1` OR offered wage ≥ 1.3 × current wage. Ambitious: requires buyer rep ≥ seller rep. Loyal: 30% refuse regardless (deterministic roll per (player, buyer)). Wage ask = `max(current × 1.15, wageFor(value))`, × 1.2 if promised role is lower than his current role. The user offers wage/years/role; the player accepts if wage ≥ ask × (role promise Star ×0.9, Starter ×0.95, others ×1.0); one counter allowed (player asks for the midpoint); then accept/refuse. Constraints: wage bill after signing ≤ wage budget, squad ≤ 26, fee ≤ transfer budget. Completion moves the player, adds history entries, news, fan mood +5 if the player's OVR ≥ club's best-XI average + 3.

12.13.4 **Incoming bids** for user players: each round, for each AI club with transferBudget > 0, 15% chance it bids for the user player that most improves its weakest starting slot (OVR ≥ that slot's current OVR + 2), ×3 chance if the player is transfer listed. Fee offered = `value × rng(0.85, 1.15)`. The user Accepts/Rejects/Counters (counter: AI accepts if counter ≤ 1.25 × value, else walks away). Selling a player whose morale ≥ 60, apps ≥ 5 and OVR in top 3 → fan mood −8.

12.13.5 **AI–AI**: each round each AI club has a 25% chance to make one move: sign a free agent if a starting slot OVR < club mean −6 (free agents with OVR above that), else buy from a lower-reputation AI club a player that improves its weakest slot by ≥ 3, paying ask. Budgets and squad caps apply. Each deal becomes a news item.

12.13.6 **Board wage request**: once per window, the user can ask for +10% wage budget: granted if board confidence ≥ 60, otherwise denied (confidence −2).

### 12.14 Fans
Fan mood after a match: home win +4, away win +3, draw −1, loss −4, margin ≥ 3 goals ±2 extra, derby result ×2. Press answers (±0–5). Signings (§12.13.3), sales (§12.13.4). Drift toward 60 by 1 per week. Fan mood affects attendance (§12.10) and is part of the season grade (§12.16).

### 12.15 Awards (season end)
Player of the Season (highest average rating, ≥ 12 rated apps), Golden Boot (goals; tiebreak assists, then fewer minutes), Playmaker (assists), Golden Glove (clean sheets, GK ≥ 12 apps), Young Player (≤ 21, best avg rating, ≥ 8 apps), Manager of the Season (club with the best (target − final position); tiebreak points), Team of the Season (4-3-3, best average rating per slot group with ≥ 10 apps, players placed by primary position group). Show portraits and stats.

### 12.16 Season grade and score
- Grade from `delta = target − finalPosition` (positive = better): ≥ 2 → A+, 1 → A, 0 → B, −1 → C, −2 → D, ≤ −3 → F. Sacked → F.
- If the final position is within `acceptable` but worse than target, grade B− instead of C.
- Score (for the OpenGame leaderboard, optional): `points × 10 + goalDifference × 2 + delta × 50 + (champion ? 300 : 0) + round(boardConfidence) + round(fanMood)`. Minimum 0.

### 12.17 Club depth (SPEC 1.4, approved by the user 20 Nov)
Same rules as §13.17: every option has a gain and a cost, defaults are neutral, all numbers in `balance.ts` under `K.club.*`. AI clubs use neutral values (3★ staff, no prep, no rest, cohesion fixed at 50), so they cost nothing to simulate.

**12.17.1 Staff.** Four people per club: the assistant (Theo Vance for the user, fixed at 3★, not replaceable), first-team coach, head of scouting and physio, each `{ id, role, name, stars: 1–5, wage }`. The user's club starts with stars `round(reputation × 0.6 + 1)` ± rng(0,1), clamped 1–5. Effects:
- Coach: positive development (§12.4) × `0.85 + 0.06·stars` (1★ 0.91 … 5★ 1.15).
- Physio: injury length (matchdays) × `1.2 − 0.08·stars`, rounded, min 1; in-match injury hazard (§12.5) × `1.1 − 0.04·stars`.
- Scout: knowledge gain (§12.12) × `0.6 + 0.15·stars`.
- Cost: weekly wage = `K.club.staffWage × stars²` (default 1,500 × stars²), paid from the wage budget like players.
- Replacing: during a transfer window round, the Club screen shows 3 generated candidates per replaceable role (stars 1–5, names from `names.data.ts`). Hiring one replaces the current person, who is paid 4 weeks' wages as compensation. At most one replacement per window round. Inbox memo on each change.

**12.17.2 Match preparation.** Training gets `prep: 'None'|'SetPieces'|'Press'|'Wingers'|'Shape'`, for the next match only:
- SetPieces: the opponent's corner and free-kick header duels −0.12 for them. Press: our passes in DEF/MID against their Mid or High press ctx +0.15. Wingers: their wide players' dribble and cross delivery ctx −0.12. Shape: +8 familiarity (§13.18.11) for the active plan's formation, this match only.
- Cost: that week the team focus's next-match bonus is halved and development × 0.85.
- The assistant's week tip (§15.3) suggests a prep from the next opponent's style (Direct → SetPieces, Pressing High → Press, Width Wide → Wingers).

**12.17.3 Rest days.** Per player, per week: `rest: boolean`. Rested: condition +8 and fatigue −6 on top of §12.1–12.2; no development that week. A fit player (condition ≥ 90) rested 3 weeks running gets morale −5 ("Wants to train"). A rested player can still be picked.

**12.17.4 Individual training: role or position** (approved by the user 20 Nov). A player's individual focus (§12.3) is one of: an attribute (as before), a **role**, or a **position**. Only one at a time.
- **Role:** 40% of his growth goes to that role's key attributes, split by their weights, so his fit stars for it rise (§13.17.1). Cost: that 40% no longer goes to anything else.
- **Position:** pick any position he isn't natural in (a GK can't learn outfield positions and vice versa). If it isn't listed yet, it's added at the §9.5 unlisted value × 100 (same group 80, adjacent group 65, otherwise 45). Each week its familiarity rises by `(3 + (age ≤ 23 ? 2 : age ≥ 30 ? −1 : 0) + (decisions ≥ 70 ? 1 : 0)) × (0.85 + 0.06 × coach stars)`, plus 2 more for each match he played there that week. The cap is 95 (only the primary position is 100). Cost: his development that week × 0.8 (time spent learning), and no attribute or role focus.
- An inbox memo when a trained position reaches 85 ("Achebe is comfortable at RWB now"). The player's file shows each position as a chip with a small progress bar while it's being trained.
- No engine change: `ovrAt` (§9.5) already uses position familiarity.

**12.17.5 Dressing room.**
- Leaders: the top 3 players by `leaderScore = (personality Leader ? 30 : 0) + (captain ? 20 : 0) + (Professional ? 8 : 0) + age × 0.8 + min(apps, 40) × 0.5`, recomputed weekly.
- Cohesion 0–100, user club starts at 55. Weekly change, clamped to ±6 in total: `(mean leader morale − 55) / 10` (±3 max), win +1, loss −1, a leader sold −8, a promise broken −5, each new signing −2 (settling in).
- Morale spread: each week every non-leader's morale moves 10% toward the leaders' mean morale.
- Match effect: all execution ctx (passes, dribbles, shots, crosses) + `(cohesion − 50) / 1000` (±0.05).
- Cost: unhappy leaders drag the whole squad down; selling one hurts.
- UI: a leader badge in Squad and on magnets; a pinned "Dressing room" sheet in Club with the three leaders, the cohesion meter and the last 3 reasons it moved.

**12.17.6 Injury risk (display only).** Per player, Low / Medium / High from the §12.5 hazard terms (condition, fatigue) × physio, plus age ≥ 30 shown as a reason. Thresholds: hazard factor < 1.2 Low, < 1.6 Medium, otherwise High. It shows in a Squad column and in the player's file. It is not a new engine rule.

**12.17.7 Not in this jam** (SPEC-1.4 proposal Tier C, kept for later): a free-draw set-piece designer (the job-based version is §13.20), contract clauses, youth academy, social groups, multi-season careers.

### 12.18 Training in detail (v1.7, approved by the user 22 Nov; `core/people/training.ts`)
This replaces the single weekly team focus of §12.3 with a planned week. The §12.3 tables stay as the **category** numbers. The same rules apply as §13.17: every option has a gain and a cost; the **default week reproduces the old Balanced / Normal results**, so the §13.16 calibration still holds; Theo can set everything with one Apply; all numbers go in `balance.ts → K.train.*`. AI clubs don't simulate any of this: they use the default week's effects.

#### 12.18.1 The week
Each week between matchdays has these slots:

| Day | Slots |
|---|---|
| 1 | **Recovery** (fixed). Players who played ≥ 60' recover; everyone else does a Small-sided game. Not editable. |
| 2–5 | **Morning and afternoon**: 8 free slots |
| 6 | **Match prep**: 1 slot (Opponent prep, Shape work, Set-piece practice, Video analysis or Light session) |
| 7 | Matchday |

Every free slot holds one session from the library (§12.18.2) or **Rest**.

#### 12.18.2 Session library
Each session belongs to a category (the §12.3 focus rows). It lists the attributes it grows and has a **load** (how much it tires players). Goalkeepers always do goalkeeping work in parallel; their growth goes to reflexes, handling, oneOnOnes and aerialCommand, whatever the session.

| Session | Category | Grows | Load |
|---|---|---|---|
| Finishing | Attacking | finishing, composure, offTheBall | 2 |
| Crossing and delivery | Attacking | crossing, setPieces, passing | 2 |
| Combination play | Attacking | passing, firstTouch, offTheBall, decisions | 2 |
| 1v1 dribbling | Attacking | dribbling, firstTouch, pace | 2 |
| Defensive shape | Defending | positioning, decisions, workRate | 1 |
| Defending the box | Defending | heading, tackling, strength, positioning | 2 |
| Pressing | Defending | workRate, stamina, decisions | 3 |
| Endurance | Fitness | stamina | 3 |
| Speed and power | Fitness | pace, strength | 3 |
| Shape work | Tactical | positioning, decisions; formation familiarity +3 per session | 1 |
| Video analysis | Tactical | decisions, composure; all four familiarity areas +1 per session | 0 |
| Opponent prep (day 6 only) | Tactical | none; applies the §12.17.2 prep (SetPieces, Press, Wingers or Shape) | 1 |
| Set-piece practice | SetPieces | setPieces, heading, crossing | 1 |
| Small-sided game | Balanced | the player's primary-position weights; morale +1 | 2 |
| Recovery | Fitness | none; condition +3, fatigue −2 | −2 |
| Rest | none | none; condition +2 | −1 |
| Light session (day 6 only) | none | none | 0 |

#### 12.18.3 What the week does
- **Development** (§12.4): the 3 attributes picked per growth point come from the union of the week's "Grows" lists. Each attribute is weighted by how many sessions include it × its OVR weight at the player's position (weight-0 attributes count 0.05). An individual focus (§12.17.4) still always takes its 40%.
- **Volume:** positive growth × `0.6 + 0.05 × trainingSessions`, where `trainingSessions` = free slots that aren't Rest or Recovery (8 → ×1.0, 4 → ×0.8).
- **Next-match bonus (sharpness):** only day 5 (both slots) and day 6 count. Each category's §12.3 bonus × (its sessions in those 3 slots ÷ 3). For example, Finishing + Combination play + Light = Attacking bonus × ⅔.
- **Load and condition:** `weekLoad` = the sum of the 8 free slots' loads plus day 6. Weekly recovery (§12.1) gets `+ K.train.loadCond × (12 − weekLoad)` (default 0.6 per point). Training injury chance (§12.3) × `weekLoad / 12`. Team intensity (Light / Normal / Hard, §12.3) still multiplies growth, injury and recovery on top.
- **The default week ("Balanced week"):**
  - Day 2: Combination play, Defensive shape
  - Day 3: Endurance, Finishing
  - Day 4: Small-sided game, Defending the box
  - Day 5: Shape work, Set-piece practice
  - Day 6: Light session

  `weekLoad` = 12. Its sharpness and familiarity are the baseline the §13.16 calibration is measured with.
- **Templates:**

  | Template | Use |
  |---|---|
  | Balanced week | the default |
  | Tactical week | more Shape work and Video analysis; low load |
  | Physical week | Endurance, Speed and power; high load; best early in the season |
  | Attacking week | |
  | Defensive week | |
  | Opponent week | Theo fills day 5–6 against the next opponent |
  | Recovery week | for congested or tired squads; low growth |

  The user can save one custom week.

#### 12.18.4 Theo's week (one click)
Theo builds a suggested week from the Balanced week:
- If ≥ 4 starters have fatigue > 50: swap the two load-3 sessions for Recovery.
- If any familiarity area is < 70: add Shape work or Video analysis on day 5.
- Day 6: Opponent prep with the prep §12.17.2 suggests from the opponent's style.
- If the next opponent's set-piece threat (their best header ≥ 75) is high: Set-piece practice on day 5.

He shows it as a memo with the reasons (one line each) and **Apply**. A setting on the Training screen, **"Let Theo plan every week"**, applies it automatically each week.

#### 12.18.5 Each player's plan (personal training)
In the Players tab of Training, and in the player's file:
- **Individual focus:** attribute, role or position (§12.17.4, unchanged).
- **Workload:**

  | Workload | Growth | Injury chance | Condition | Training rating |
  |---|---|---|---|---|
  | Light | ×0.8 | ×0.6 | +3 per week | |
  | Normal | (default) | | | |
  | Heavy | ×1.15 | ×1.6 | −3 per week | +0.2 |

- **Extra sessions** (on or off): he stays after training. Growth ×1.15, fatigue +4 per week, injury ×1.3, training rating +0.2. A Relaxed or Temperamental player has a 30% chance each week to skip them ("Didn't fancy it"), with morale −3 and no gain.
- **Rest** (§12.17.3, unchanged).
- **Mentoring:** up to 3 pairs. The mentor must be a leader (§12.17.5) or aged ≥ 28 and Professional or Leader; the mentee must be aged ≤ 21.
  - **Gain:** each week the mentee's morale moves 20% toward the mentor's (on top of §12.17.5), and his positive development is ×1.08.
  - **Cost:** the mentor's own development ×0.9. If the mentor is sold or loses his place for 3 matches running, the mentee's morale −6.

#### 12.18.6 One-to-one sessions
Once per week the coach takes **one player** for a personal session on the training ground. It is a scene with that player, with faces and voices (§11.25, §14.11), and the coach's lines come from `training.json`. Pick one type:

| Type | Effect | When it's offered |
|---|---|---|
| Technique work | his positive growth this week ×1.25 (it lands on his individual focus first) | always |
| Confidence talk | morale +6 if his morale < 50, else +2 (Relaxed ×0.5, Leader ×1.2) | always |
| Fitness work | condition +6, fatigue −4 | always |
| Video of his last match | next match: his decision-weighted contests ctx +0.05 | only if he played the last match |

- **Cost: favourites.** Picking the same player 3 weeks running gives every other leader morale −2, with an inbox memo ("The lads think you've got a favourite").
- The session is optional; skipping it costs nothing.
- Theo suggests one each week from the clearest need: lowest morale among starters, a fatigue > 60 starter, or a young player with an individual focus.

#### 12.18.7 Training ratings
- Every player gets a weekly **training rating** from 1.0 to 10.0 (one decimal):
  `6.4 + (Professional +0.6, Ambitious +0.3, Relaxed −0.4) + 0.6·(morale − 50)/50 + (condition < 80 ? (condition − 80)/50 : 0) + workload and extra-session bonuses + rng.normal(0, Temperamental ? 1.0 : 0.6)`, clamped.
- **Effects:**
  - **≥ 7.5:** development ×1.05 and morale +1.
  - **≤ 5.5:** development ×0.95.
  - **3 weeks running ≥ 7.5 while he started < 50% of those matches:** a new §12.9 trigger, **"Training well, not playing"**, at 50% chance (content: its own `conversations.json` type `training_well`, ≥ 3 openings × 3 replies).
- **Shown in:** a Training Players-tab column (this week's rating and a 6-week sparkline), the player's file, and an assistant remark when a player is "flying in training" (≥ 8.0) or "going through the motions" (≤ 5.0). The team average shows on the Week tab.

#### 12.18.8 Progress you can see
- Store for the user's club only:
  - weekly OVR for the season (`ovrHistory: number[]`)
  - a 4-week attribute snapshot ring (`attrHistory`)
  - the last 8 training ratings
- **The player's file and the Training Progress tab show:**
  - an arrow beside each attribute: ▲ if it's +1 or more over 4 weeks, ▼ if −1 or less, nothing otherwise
  - the season's OVR line
  - a coach's note, one line chosen from `training.json` by the strongest signal (rating trend, growth, condition, workload): "Sharper on the ball this month.", "Struggling with the pace of training.", "Ready for more minutes."
- **Week Summary** lists the top 3 improvers and anyone whose rating dropped 2+ points.

#### 12.18.9 Workload and the physio
- Day 1 Recovery is automatic for players who played ≥ 60'.
- A player is **overloaded** if his fatigue > 60 and his workload isn't Light, or he does Extra sessions with fatigue > 50. The physio raises it in an inbox memo ("Overloaded: Calder, Mensah. Ease them off?") with a one-click "Set workload Light". His injury-risk chip (§12.17.6) adds "overloaded" as a reason.

#### 12.18.10 Content (`training.json`, new)
- Coach's notes: ≥ 24, by signal.
- One-to-one coach lines: ≥ 3 per type, voiced (`vo/coach/`), `nameSlot` allowed (§16.3).
- Player replies per type: ≥ 3, with mood.
- Theo's week memo reasons: ≥ 1 per rule.

#### 12.18.11 Coaches per area (only if time allows, after everything above is accepted)
- **New staff (§12.17.1):** attacking coach, defending coach, fitness coach and goalkeeping coach, each 1–5 stars.
- **Gain:** sessions of that coach's category grow × `0.85 + 0.06·stars`, replacing the first-team coach's multiplier for that category. The fitness coach also scales the Recovery and Rest condition gains by the same factor. The goalkeeping coach drives goalkeeper growth.
- **Cost:** wages as §12.17.1.
- They are replaced the same way as other staff. Without these coaches, the first-team coach covers every category.

#### 12.18.12 Calibration and tests
- **Default-week check:** the default week, Normal intensity and default player plans reproduce the M5.1 development numbers within ±3% over a 2,000-season-week sample.
- **No-dominant-choice check:** no template beats the Balanced week on total OVR growth by more than 15% without paying for it in injuries or condition.
- **Unit tests:** every session's growth list, sharpness, `weekLoad`, workload, extra sessions, mentoring, one-to-one effects and costs, training ratings, and the new conversation trigger.

### 12.19 Injury decisions (v1.7, approved by the user 22 Nov; `core/player/injuries.ts`)
The physio (staff, §12.17.1) brings the manager real calls to make. All decisions are scenes (§11.25.5), with the physio speaking (`club.json`, speaker `physio`, voiced; `person.glb`). Until M6b they show as a choice card on the current screen. All numbers go in `K.inj.*`. AI clubs always take the cautious option.

#### 12.19.1 Knocks in a match
- **What a knock is:** a separate event from §12.5 injuries, with hazard `0.6 × λ` (§12.5) and event `KNOCK`. The player goes down, and play stops at the next dead ball.
- **The physio's read:** "He can carry on. About {pct}%." `pct` = 70–90, higher with better physio stars.
- **Choices:**

  | Choice | Effect |
  |---|---|
  | **Take him off** | substitution at that dead ball; no layoff, condition −10 |
  | **Let him carry on** | his skill scores −0.3 while on the pitch; his §12.5 injury hazard ×4 for the rest of the match. If he gets injured, the severity rolls one level up (Minor → Moderate, Moderate → Major) |
  | **Carry on until half-time** | only offered in the first half. Carry-on rules until 45', then he's replaced at half-time without using a window |

- **Deciding:** live playback pauses on the choice. In Instant result, or if no subs remain, the default from the setting **"Knocks": Ask me (default) / Always take off / Play on if under 15' left** applies; when asking isn't possible, Ask me uses Always take off. The decision is a match command (`{ kind: 'knock'; side; playerId; decision; issuedAtT }`) with the usual rewind rules (§13.12), so it stays deterministic.
- **In 3D:** the player sits on the grass, the physio jogs on (`person.glb`), and there's a touchline cut of the coach waiting.

#### 12.19.2 Rushing a player back
- **When it's offered:** a player with `matchdaysOut = 1` (one week from fit). At WeekSummary the physio knocks: "He's close. We could risk him this week."
- **Choices:**
  - **Wait** (default): normal recovery (§12.5).
  - **Risk him:** he's available this matchday with condition 70 and a **"Not fully fit"** chip. For his next 2 matches: §12.5 hazard ×3 (× physio factor `1.2 − 0.08·stars`), and skill scores −0.1. If he breaks down, the same injury kind returns at `ceil(original matchdaysOut × 1.5)`, with an inbox memo and fans −1.
- Theo comments when it's a derby or a top-3 opponent: "Big one. Your call, gaffer."

#### 12.19.3 Warm-up scare
- **When:** before each match, one starter has a "tight" muscle with chance 3% (×2 if his fatigue > 50, ×0.7 with a 4–5★ physio). It is a speaking beat in the dressing room before the team talk, then a choice.
- **Choices:**
  - **Start him:** his §12.5 hazard ×2.5 this match, skill −0.1.
  - **Leave him out:** the best bench player for the slot (§13.13 rule) starts; he goes to the bench, or stands down if the bench is full.
- Instant result uses Leave him out.

#### 12.19.4 What shows up
- An injury log on the player's file: kind, matchdays out, re-injuries, and whether he was rushed.
- The squad injury-risk chip (§12.17.6) adds "rushed back" and "carried a knock" as reasons for 2 weeks.
- Week Summary lists the decisions and how they turned out ("Risked Calder: came through 90 minutes").
- **Calibration:** with Ask me answered cautiously, §13.16 targets and the season's injury count stay within ±10%. Knocks add ≤ 0.3 forced subs per team per match.
- **Tests:** every choice's effect, the severity step-up, the re-injury length, the warm-up chance, the deterministic knock command, and the Instant defaults.

### 12.20 Discipline decisions (v1.7, approved by the user 22 Nov; `core/people/incidents.ts`; bans stay in `core/player/discipline.ts`)
Incidents the manager must deal with. Each is a scene (§11.25.5): the player is called to the office (or knocks), there are speaking beats, then the choice card. Theo may add one line of advice. Until M6b, it's a choice card on the current screen. All numbers go in `K.disc.*`. AI clubs don't simulate this.

#### 12.20.1 Incidents
| Incident | When | Chance |
|---|---|---|
| **Late for training** | WeekSummary, per player | 1.5% base; Relaxed ×2, Professional ×0.2, morale < 30 ×2, Extra sessions ×0.5 |
| **Sent off** | after a match with our direct red or second yellow | always (one per red) |
| **Mouthing off in the press** | WeekSummary, a player with morale < 30 and a broken promise or an "unhappy" conversation in the last 4 weeks | 30%; a back-page headline is generated (§16.6) |
| **Training-ground bust-up** | WeekSummary when cohesion (§12.17.5) < 45; two players, at least one Temperamental | 10%; the incident involves both |

At most one new incident per week (priority: sent off, bust-up, press, late). An incident must be dealt with before Continue (the Continue rule of §10.1).

#### 12.20.2 Choices and effects
Morale numbers are scaled by personality: Professional ×0.5 on negatives, Temperamental ×1.5, Leader ×0.8. Fines go to the club's balance.

| Choice | Player | Dressing room | Other |
|---|---|---|---|
| **Fine him** (a week's wages; two for a repeat within 8 weeks) | morale −8 | cohesion +2 if the offence was clear (late, sent off, bust-up) | a repeat fine of a Temperamental player: 30% he asks to be transfer listed |
| **Drop him** for the next match | morale −6, unavailable for selection | cohesion +1 | — |
| **Warn him** | morale −2 | — | his chance of the same incident ×1.5 for 4 weeks |
| **Let it go** | no change | leaders' morale −3, cohesion −2 | his chance of the same incident ×2 for 4 weeks |
| *Press only:* **Answer him in public** | morale −10; 40% he asks to leave | — | fans +2 |
| *Press only:* **Talk privately** | opens his §12.9 conversation now (with its own replies and effects) | — | — |
| *Bust-up only:* **Side with the senior player** | the younger player's morale −8, the senior's +3 | — | — |
| *Bust-up only:* **Team meeting** (both fined half a week) | both −3 | cohesion +3 | — |

- **Consistency:** the game keeps a 6-week record of offences and punishments. If two players commit the same kind of offence and get different punishment levels (Let it go < Warn < Fine or Drop), cohesion −4 and a memo: "The lads think there's one rule for him and another for them." Leaders are exempt from nothing.
- **Records:** a discipline record shows in the player's file. The inbox keeps each incident and its outcome, and the news covers fines of Star players.
- **Tests:** incident chances, the one-per-week priority, each choice's effects, the personality scaling, the consistency rule, the fine to the balance, and the Continue block.

#### 12.20.3 Content (`club.json` additions)
- **Physio:** knock reads, rush-back offers, warm-up scares, outcomes. ≥ 3 lines each, voiced.
- **Incidents:** the opener, per kind, ≥ 3 each.
- **Coach lines** for every choice, voiced, `nameSlot` allowed.
- **Player replies** per choice × personality group (calm, hot-headed): ≥ 2 each.
- **Theo's advice** per incident: ≥ 2 each.

---

## 13. Match engine (complete specification)

The engine is an **abstract possession-and-event simulation** over a 3×3 zone grid plus explicit box/set-piece contexts. It never picks the result first. Actions create chances, chances create shots, shots may create goals. The 3D view (§14) illustrates events; it never decides them.

### 13.1 Coordinate frames
- **Absolute frame** (used in `MatchEvent`): pitch 105 × 68 metres. `x ∈ [0,105]`, `y ∈ [0,68]`. `y = 0` is the touchline nearest the main camera. The home team attacks toward `x = 105` in the first half and toward `x = 0` in the second half.
- **Attacking frame** (used inside the engine for the team in possession): `ax ∈ [0,105]` where `ax = 105` is the goal being attacked; `ay ∈ [0,68]` where `ay = 0` is the attacking team's left touchline.
- `frames.ts` provides `toAbsolute(ax, ay, side, half)` and `toAttacking(x, y, side, half)` and their tests (round-trip, both halves, both sides).
- **Zones** (attacking frame): third `T = DEF (ax < 35) | MID (35 ≤ ax < 70) | ATT (ax ≥ 70)`; lane `L = Left (ay < 22.67) | Centre | Right (ay ≥ 45.33)`. **Box** = `ax ≥ 88.5 && 13.84 ≤ ay ≤ 54.16`. Six-yard = `ax ≥ 99.5 && 24.84 ≤ ay ≤ 43.16`.

### 13.2 Match input and output types
```ts
export interface TeamSheet {
  clubId: ClubId; side: Side; tactics: Tactics; familiarity: number;     // 0–100 for tactics.formation
  players: Record<PlayerId, { attributes: Attributes; positions: Player['positions'];
    condition: number; fatigue: number; morale: number; personality: Personality; name: string; shirt: number }>;
  trainingBonus: { attack: number; defence: number; setPieces: number }; // z-units, §12.3
  focusBoost: number;                                                   // from team talk, §12.8
}
export interface MatchInput {
  fixtureId: FixtureId; home: TeamSheet; away: TeamSheet; isDerby: boolean;
  weather: Fixture['weather']; userSide: Side | null; aiControls: Side[];   // sides run by aiManager
}
export type MatchEventType =
  | 'KICKOFF'|'PASS'|'PASS_FAIL'|'INTERCEPTION'|'LONG_BALL'|'AERIAL_DUEL'|'SWITCH'|'DRIBBLE'|'DRIBBLE_FAIL'
  | 'TACKLE'|'FOUL'|'FREE_KICK'|'CROSS'|'CLAIM'|'CLEARANCE'|'THROUGH_BALL'|'OFFSIDE'|'SHOT'|'BLOCK'|'SAVE'
  | 'MISS'|'POST'|'GOAL'|'CORNER'|'THROW_IN'|'GOAL_KICK'|'YELLOW'|'RED'|'INJURY'|'SUB'|'TACTIC_CHANGE'
  | 'PENALTY_AWARDED'|'ADDED_TIME'|'HALF_TIME'|'FULL_TIME';
export interface MatchEvent {
  seq: number; t: number;               // t = match clock seconds since kickoff of the match (first half 0..2700+stoppage, second half starts at 2700 regardless of first-half stoppage)
  minuteLabel: string;                  // '23', '45+2', '90+4'
  half: 1 | 2; type: MatchEventType; side: Side;    // side = team that performed the action
  playerId?: PlayerId; targetId?: PlayerId; opponentId?: PlayerId;
  from?: { x: number; y: number }; to?: { x: number; y: number };   // absolute frame
  duration: number;                     // sim seconds this event spans (for animation)
  height?: 'ground'|'lofted'|'high';   // ball flight
  shot?: { context: ShotContext; xg: number; onTarget: boolean; bodyPart: 'Foot'|'Head'; target?: { y: number; z: number } };
  importance: 0 | 1 | 2 | 3;           // 0 routine, 1 notable, 2 chance/card, 3 goal/red/penalty
  commentaryKey?: string;               // key into content/commentary.json
  scoreAfter: { home: number; away: number };
}
export interface TeamMatchStats {
  goals: number; shots: number; shotsOnTarget: number; xg: number; possessionSec: number;
  passes: number; passesCompleted: number; corners: number; fouls: number; offsides: number;
  yellow: number; red: number; tackles: number; interceptions: number; saves: number; bigChances: number;
}
export interface PlayerMatchLine {
  playerId: PlayerId; side: Side; minutes: number; rating: number; goals: number; assists: number;
  shots: number; shotsOnTarget: number; keyPasses: number; passes: number; passesCompleted: number;
  dribbles: number; tackles: number; interceptions: number; saves: number; yellow: number; red: number;
  injured: boolean; conditionEnd: number;
}
export interface MatchResult {
  fixtureId: FixtureId; homeGoals: number; awayGoals: number; events: MatchEvent[];
  stats: { home: TeamMatchStats; away: TeamMatchStats }; players: PlayerMatchLine[]; motm: PlayerId;
  injuries: { playerId: PlayerId; injury: Injury }[];
}
```

### 13.3 Engine state
`state.ts`: clock `t` (seconds), `half`, `periodEnd` (2700 + stoppage1 or 5400 + stoppage2, in "match clock" terms; second half clock restarts at 2700), possession side or `null` (dead ball), ball position (attacking frame of the possessing side, plus absolute), ball holder id, `phase` (`Open` | `Counter` (remaining steps) | `SetPiece`), pending restart, on-pitch players per side (ids by slot), bench, subs used and windows used, cards, score, per-player live condition and match line, team stats, RNG, event seq, command queue, current instructions per side, `focusBoost` expiry, momentum (rolling xG window).

### 13.4 Shared maths (`math.ts`)
- `z(a) = (a − 50) / 25`.
- Skill score `S(player, weights) = Σ w_i · z(attr_i)` with Σ w_i = 1, plus the player's **modifiers**: condition penalty (§12.1), morale `0.1 × (morale − 50)/50`, team `focusBoost` (if active), team familiarity `(familiarity − 70)/300`, home advantage `+0.06` for the home side (all contests), training bonus where it applies, weather Rain `−0.08` on passing/firstTouch-based contests.
- `σ(x) = 1/(1 + e^(−x))`. `logit(p) = ln(p/(1 − p))`.
- Softmax choice: `P(i) = exp((U_i − U_max)/τ) / Σ`, `τ = 0.35`.

### 13.5 Involvement (who gets the ball, who defends)
In possession, each on-pitch player has weights over the 9 zones (attacking frame, `D/M/A` × `L/C/R`). Table for left-side or central slots (mirror L↔R for right-side slots; central slots use their own row):

| Slot role | DL | DC | DR | ML | MC | MR | AL | AC | AR |
|---|---|---|---|---|---|---|---|---|---|
| GK | 0 | 1.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CB (left of pair) | .30 | .60 | 0 | 0 | .10 | 0 | 0 | 0 | 0 |
| CB (central of three) | 0 | .80 | 0 | 0 | .20 | 0 | 0 | 0 | 0 |
| LB | .45 | 0 | 0 | .40 | 0 | 0 | .15 | 0 | 0 |
| LWB | .30 | 0 | 0 | .40 | 0 | 0 | .30 | 0 | 0 |
| DM | 0 | .35 | 0 | .075 | .50 | .075 | 0 | 0 | 0 |
| CM (left) | 0 | .10 | 0 | .20 | .45 | 0 | .10 | .15 | 0 |
| CM (central) | 0 | .10 | 0 | .10 | .55 | .10 | 0 | .15 | 0 |
| AM | 0 | 0 | 0 | 0 | .25 | 0 | .125 | .50 | .125 |
| LM | .15 | 0 | 0 | .50 | 0 | 0 | .35 | 0 | 0 |
| LW | 0 | 0 | 0 | .30 | 0 | 0 | .55 | .15 | 0 |
| ST (left of pair) | 0 | 0 | 0 | 0 | .15 | 0 | .20 | .65 | 0 |
| ST (lone/central) | 0 | 0 | 0 | 0 | .15 | 0 | .10 | .65 | .10 |

Modifiers (apply then renormalise each player's row to sum 1):
- Mentality Attacking: move 15% of each outfielder's DEF weight to MID and 15% of MID to ATT (CB: half of that). Defensive: the reverse.
- Role and player-instruction involvement modifiers (§13.17.2, §13.17.11) replace the old duty step here.
- Width Wide: wide slots (FB, WB, LM/RM, LW/RW) move 20% of their Centre weight to their lane; Narrow: move 20% of lane weight to Centre.

Out of possession, defenders for a zone are chosen with the same table using the **mirrored** zone (attacker's `(T, L)` → defender's `(opposite third, mirrored lane)`: ATT↔DEF, MID↔MID, Left↔Right).

**Selection:** the receiver of a pass to zone Z = weighted pick among teammates (not the passer, not sent-off) by their weight in Z. If all weights are 0, pick by distance in the slot table order (fallback, test it). The **primary defender** in zone Z = weighted pick among defenders by their weight in the mirrored zone; GK only eligible in the box.

### 13.6 Possession step: candidate actions and base utilities
The holder chooses an action. Legal actions by ball location (attacking frame):

| Location | recycle | progress | long | switch | dribble | through | cross | shot | clear |
|---|---|---|---|---|---|---|---|---|---|
| DEF any lane | 1.2 | 1.4 | 0.6 | 0.4 | 0.4 | — | — | — | 0.2* |
| MID Centre | 1.0 | 1.5 | 0.5 | 0.5 | 0.8 | 0.6 | — | 0.15 | — |
| MID wide | 1.0 | 1.5 | 0.5 | 0.5 | 0.8 | 0.4 | 0.2 | — | — |
| ATT Centre (outside box) | 0.9 | 1.0 | — | 0.4 | 1.0 | 0.8 | — | 0.7 | — |
| ATT wide (outside box) | 0.9 | 1.0 | — | 0.4 | 1.0 | 0.5 | 1.2 | 0.2 | — |
| In box | 0.3 | 0.9 (cut-back/square) | — | — | 0.8 | — | — | 2.2 | — |

`*` clear is legal only in DEF when the step is under pressure (the opponent's pressing is High, or the previous step was a won tackle by the opponent's press).

Tactic modifiers added to utilities:
| Instruction | Effect |
|---|---|
| Mentality Defensive | recycle +0.3, progress −0.2, shot −0.2, long +0.1 |
| Mentality Attacking | progress +0.3, through +0.2, shot +0.2, recycle −0.3 |
| Passing Short | recycle +0.3, progress +0.1, long −0.5, through −0.1 |
| Passing Direct | long +0.6, through +0.3, recycle −0.3 |
| Tempo Slow | recycle +0.3 (and durations ×1.2, execution +0.15) |
| Tempo Fast | progress +0.2, dribble +0.1 (durations ×0.82, execution −0.2) |
| Width Narrow | cross −0.4, switch −0.2 |
| Width Wide | cross +0.4, switch +0.3 |
| Focus Left/Centre/Right | any action whose destination lane is the focus lane +0.3 |
| Counter phase (§13.9) | progress +0.5, through +0.5, recycle −0.5 |
| Score state (≥ 75' and losing) | progress +0.2, shot +0.2, long +0.2 (players naturally push; not a rescue bonus) |
| Opponent line Deep | shot from ATT Centre outside box +0.2 |

### 13.7 Resolving each action
Notation: `A` = actor (holder), `R` = receiver, `D` = primary defender. "ctx" = sum of context terms. All base constants go in `balance.ts` as `K.*`.

**Destinations.** recycle: stay in the same third (60%) or go back one third (40%), lane any (weighted toward Centre 50%). progress: forward one third (or into the box from ATT: 45%), same lane 60% / adjacent 40%. long: forward one or two thirds (DEF→ATT 50%). switch: same third, lane Left↔Right (from Centre: either). dribble: forward within the third (stays, 50%) or into the next third/box. through: to ATT Centre or box (box 60%). cross: into the box. Pick the exact point uniformly inside the destination zone (box: inside the box; avoid the six-yard area except cut-backs: 20% of in-box passes go to six-yard).

**Short passes (recycle, progress, switch, in-box pass):**
`p = σ(K.passBase + 0.9·S_pass(A) + 0.3·z(R.firstTouch) − 0.7·S_press(D) + ctx)`
- `K.passBase`: recycle 2.6, progress 2.2, switch 1.8, in-box pass 1.2.
- `S_pass` = passing .6, decisions .2, composure .2. `S_press` = positioning .5, workRate .3, tackling .2.
- ctx: zone ATT −0.6, MID −0.2; opponent pressing High −0.35 in our DEF/MID (Low +0.2); tempo Fast −0.2, Slow +0.15; Rain −0.08; trainingBonus.attack.
- Success → `PASS`, R becomes holder at destination; counts pass completed. If it was the pass before a shot in the next step, A gets a key pass (and assist if goal).
- Failure → 75% `INTERCEPTION` by D (possession changes at the destination point mirrored), 25% out of play → `THROW_IN` to the opponent at the nearest touchline point.

**Long ball:** delivery `p_d = σ(0.6 + 0.8·z(A.passing) + ctx)`; if delivered, `AERIAL_DUEL`: `p_win = σ(−0.3 + 0.7·S_air(R) − 0.7·S_airD(D) + (opponent line High ? +0.3 : 0))` with `S_air` = heading .6, strength .4 and `S_airD` = heading .5, strength .3, positioning .2. Win → R holds at destination. Lose or undelivered → opponent possession at destination (mirrored); 10% of lost duels are a `FOUL` by the loser (§13.8).

**Dribble:** `p = σ(0.2 + 0.9·S_drib(A) − 0.9·S_tkl(D) + 0.3·(z(A.pace) − z(D.pace)) + ctx)` with `S_drib` = dribbling .5, pace .25, firstTouch .25 and `S_tkl` = tackling .5, positioning .3, strength .2. Success → `DRIBBLE` to destination. Failure → 75% `TACKLE` (D wins the ball), 25% `FOUL` by D (§13.8).

**Through ball:** `p = σ(−0.2 + 0.8·S_tp(A) + 0.6·S_run(R) − 0.8·S_cover(D) + lineCtx + ctx)` with `S_tp` = passing .6, decisions .4; `S_run` = offTheBall .5, pace .5; `S_cover` = positioning .6, pace .4; `lineCtx` = defending line High +0.4, Deep −0.4.
- Success → R holds; with probability `oneOnOne` = High line 0.35, Normal 0.20, Deep 0.10 the next step is a forced `ONE_ON_ONE` shot; else R holds in the box (next step normal).
- Failure → offside with probability High 0.45, Normal 0.25, Deep 0.10 (`OFFSIDE`, indirect free kick to the opponent at the point); otherwise `INTERCEPTION`.

**Cross** (from ATT wide, MID wide (early cross), corners, wide free kicks): taker = A (or set-piece taker).
1. GK claim: `p_claim = 0.12 + 0.06·z(GK.aerialCommand)` → `CLAIM`, opponent possession (GK holds).
2. Delivery: `p_d = σ(−0.3 + 0.8·z(A.crossing) + ctx)` (corners/free kicks use setPieces instead of crossing, + trainingBonus.setPieces). Failure → `CLEARANCE` (25% of failures become a `CORNER` for the attacking side).
3. Header duel: target R = weighted pick among attackers in the box by heading×involvement; D = weighted pick among defenders by heading. `p_win = σ(−0.1 + 0.8·S_air(R) − 0.8·S_airD(D))`. Win → `SHOT` with context `HEADER` (40% of won crosses on the ground instead: `BOX_CENTRAL`). Lose → `CLEARANCE`: 40% second ball to the attackers in MID Centre, 60% to defenders.

**Clearance:** ball goes to MID (60%) or ATT (40%) of the clearing team's frame; possession: 50/50 aerial duel there.

**Shot:** see §13.8.

**Durations (seconds):** recycle 5–9, progress 6–11, long 4–6, switch 5–8, dribble 4–8, through 4–7, cross 4–6, shot 2–3, then restarts: throw-in 12, goal kick 22, corner 30, free kick 25, goal (celebration + kickoff) 60, injury stoppage 45, substitution 30, offside 20. Multiply open-play durations by tempo (Slow 1.2, Normal 1.0, Fast 0.82). Use `rng.int` for ranges. **Possession time** accrues to the side that has the ball for the duration of each step.

### 13.8 Shots, fouls, set pieces
**Shot contexts and reference xG:**

| ShotContext | When | xG_ref | Block prob | Skill weights (S_fin) |
|---|---|---|---|---|
| PENALTY | penalty kick | 0.76 | 0 | setPieces .4, finishing .3, composure .3 |
| ONE_ON_ONE | through ball (§13.7) | 0.38 | 0.05 | finishing .5, composure .5 |
| SIX_YARD | shot from six-yard area | 0.35 | 0.08 | finishing .7, composure .3 |
| BOX_CENTRAL | box, central lane | 0.16 | 0.18 | finishing .6, composure .4 |
| BOX_WIDE | box, wide | 0.07 | 0.18 | finishing .6, composure .4 |
| HEADER | won cross | 0.11 | 0.10 | heading .7, composure .3 |
| REBOUND | after a parried save | 0.25 | 0.10 | finishing .6, composure .4 |
| OUTSIDE_CENTRAL | ATT Centre outside box, MID Centre | 0.035 | 0.28 | longShots .7, composure .3 |
| OUTSIDE_WIDE | ATT wide outside box | 0.02 | 0.28 | longShots .7, composure .3 |
| DIRECT_FK | direct free kick | 0.06 | 0.20 (wall) | setPieces .8, composure .2 |

Keeper skill `S_gk`: ONE_ON_ONE and PENALTY: oneOnOnes .6, reflexes .4; HEADER: reflexes .6, aerialCommand .4; others: reflexes .6, handling .2, oneOnOnes .2.

Resolution:
1. `p_goal = σ(logit(xG_ref) + 0.55·S_fin(A) − 0.55·S_gk(GK) + ctx)` where ctx includes trainingBonus.attack for open play / setPieces for PENALTY and DIRECT_FK, and the defender `D` cover term `−0.15·z(D.positioning)` (not for PENALTY).
2. Block: with `p_block = blockProb + 0.05·z(D.positioning)` (min 0) → `BLOCK`: 30% `CORNER`, 20% the attacking side keeps the ball (MID/ATT Centre outside box), 50% defenders' possession.
3. Otherwise goal with `min(0.95, p_goal / (1 − p_block))` → `GOAL`.
4. Otherwise on target with `p_ot = clamp(0.42 + 0.1·S_fin(A), 0.25, 0.6)` → `SAVE`: catch with `σ(0.0 + 0.8·z(GK.handling))` (defenders' possession, GK), else parry: 40% `CORNER`, 25% `REBOUND` shot by the nearest attacker (weighted by box involvement) in the next step, 35% defenders clear.
5. Otherwise `MISS` (6% of misses hit the post or bar: `POST`, then 50% rebound chance → REBOUND, else goal kick). Miss → `GOAL_KICK`.
- **xG** recorded on the event is always `xG_ref` (public, comparable). Big chance = xG_ref ≥ 0.3.
- Shot target for the animation: `target.y` in [−3.66, 3.66] metres across the goal mouth and `target.z` in [0, 2.44] for on-target/goals; outside those for misses (by up to 4 m wide or 2 m high); posts at ±3.66 or z = 2.44.

**Fouls.** Sources: failed dribble (25%), lost aerial duel (10%), pressing tackles: when the opponent's pressing is High, each opponent possession step in its DEF/MID third has a 2.5% foul chance (Mid 1.2%, Low 0.5%). Foul location = current ball point. Cards per §12.6.
- Foul by the defending team inside its own box (attacking frame box) → `PENALTY_AWARDED`, then PENALTY shot by the penalty taker (or best S_fin on the pitch).
- Foul in ATT Centre within 30 m of goal (ax ≥ 75) → `FREE_KICK`: 50% DIRECT_FK shot by the free-kick taker, 50% cross delivery.
- Foul in ATT wide → `FREE_KICK` cross delivery.
- Elsewhere → `FREE_KICK`, attacking side keeps the ball at the point.

**Corners** → cross resolution with the corner taker using setPieces, header target weighting ×1.3 for CBs and STs (they go up for corners).

**Throw-ins** → the side keeps possession at that point (next step from there with recycle +0.4).
**Goal kicks** → defenders' possession in DEF Centre (Passing Direct: 60% long instead). This is the `Mixed` distribution; other settings in §13.17.4. Corners: `cornersFor`/`cornersAgainst` in §13.17.5.
**Kick-off** → MID Centre, holder = a central midfielder or striker; first action is recycle.

### 13.9 Transitions and counters
When possession changes in open play (interception, tackle, clearance won, claim), set the new holder at the mirrored point. If the ball was won in the winner's DEF or MID third **and** the losing side had Mentality Attacking or its line High, set `phase = Counter` for the next 2 steps (utilities §13.6; the defending side gets ctx −0.3 on its press/cover terms during those steps).

### 13.10 Tactical instructions (descriptions for the UI, exact wording)
- Mentality — Defensive: "Keep men behind the ball." Balanced: "Pick the right moments." Attacking: "Commit players forward."
- Passing — Short: "Keep it on the floor, patient." Mixed: "Mix it up." Direct: "Get it forward quickly, go long."
- Tempo — Slow: "Control the rhythm." Normal: "Natural pace." Fast: "Play at speed; more mistakes."
- Pressing — Low: "Hold shape, save energy." Mid: "Press in midfield." High: "Hunt the ball high; tiring and risky."
- Line — Deep: "Protect the space behind." Normal: "Standard line." High: "Squeeze the pitch; vulnerable to balls in behind."
- Width — Narrow: "Crowd the middle." Normal: "Balanced width." Wide: "Stretch the pitch, cross more."
- Focus — Left / Centre / Right: "Attack through the left / middle / right." Mixed: "No preference."

### 13.11 Stoppage time, halves, and the clock
- First half ends at 2700 + stoppage1, stoppage1 = `clamp(60·(1 + goals1H·0.5 + subs1H·0.5 + injuries1H·1) + rng.int(0,60), 60, 300)` seconds, announced at 45:00 (`ADDED_TIME`). Second half: `clamp(60·(2 + goals2H·0.5 + subs2H·0.5 + injuries2H·1 + cards2H·0.25) + rng.int(0,90), 180, 540)`.
- A step that would cross `periodEnd` finishes; then `HALF_TIME`/`FULL_TIME` (don't cut an attack mid-shot).
- Second-half kickoff by the side that did not kick off first. Teams swap ends (absolute frame).

### 13.12 Commands (user changes mid-match)
```ts
export type MatchCommand =
  | { kind: 'instructions'; side: Side; instructions: TeamInstructions; issuedAtT: number }
  | { kind: 'formation'; side: Side; formation: Formation; lineup: (PlayerId|null)[]; roles: RoleId[]; playerInstructions: PlayerInstruction[][]; issuedAtT: number }
  | { kind: 'opposition'; side: Side; orders: OppOrder[]; issuedAtT: number }
  | { kind: 'sub'; side: Side; outId: PlayerId; inId: PlayerId; slot: number; issuedAtT: number };
```
- Instructions/formation/roles/player instructions/opposition orders take effect at the first step starting at or after `issuedAtT + 30` (a touchline shout).
- Subs take effect at the first dead ball (THROW_IN, GOAL_KICK, CORNER, FREE_KICK, FOUL, OFFSIDE, GOAL, INJURY, HALF_TIME) at or after `issuedAtT`. Limits: 5 subs, 3 in-play windows (half-time changes do not use a window), no re-entry, a sent-off player cannot be replaced.
- The worker, on receiving a command: find the effective step (above). If events beyond it were already produced, restore the snapshot taken at that step (snapshots stored every step in a ring buffer of the last 400 steps), emit `{type:'rewind', fromSeq}`, apply the command, continue. Everything before the effective step stays byte-identical.

### 13.13 AI manager (`aiManager.ts`)
**Lineup:** formation = club style formation (if 2+ of its slots would have fit < 0.8, choose the formation among its familiarity ≥ 60 list with the highest total). Fill slots in this order: GK, CBs, FBs/WBs, DM, CM, AM, wide mids/wingers, STs. For each slot pick the available player maximising `ovrAt(player, slotPos) × (0.7 + 0.3·condition/100) × (morale < 30 ? 0.97 : 1)`, excluding injured, suspended and condition < 60 if any alternative ≥ 0.85 of the best score exists. Bench: best remaining by OVR, ensure 1 GK, then fill to 9.
Captain = highest OVR Leader in the XI, else highest OVR. Takers: penalty = best `S_fin(PENALTY)`, free kick = best setPieces, corner = best setPieces among wide/central mids.
**In-match** (evaluated every 5 match minutes after kickoff):
- At 60', 70', 78': substitute the player with the lowest `condition` if < 65, or lowest rating if < 5.8 (like-for-like position). Max 5 subs, 3 windows.
- Losing at 65'+: Mentality Attacking; at 80'+ losing: also Tempo Fast, Line High, and swap a DM/CB for a forward if subs remain.
- Winning by 1 at 80'+: Mentality Defensive, Tempo Slow.
- Down to 10 men: drop one forward → 4-4-1 equivalent (use 4-4-2 with ST slot empty; involvement renormalised).
- The user's side is never automated except when the user enables "Assistant manages the match" (setting).
The same lineup function powers "Assistant picks best XI".

### 13.14 Match ratings (`ratings.ts`)
Start 6.0. Adjust: goal +1.0 (+0.3 if the winning goal), assist +0.6, key pass +0.15, shot on target +0.1, successful dribble +0.05, tackle/interception won +0.08, pass completion `+(pc − 0.80) × 2` (only with ≥ 10 passes), failed dribble −0.04, foul −0.05, yellow −0.3, red −1.0, error leading directly to a goal (the failed action that started the opponent's scoring possession within 2 steps) −0.6, GK save +0.25, goal conceded −0.25 (GK), −0.10 (on-pitch DEF), clean sheet (60+ minutes) +0.5 for GK and DEF, team win +0.2, loss −0.2. Clamp 3.0–10.0, round to 1 decimal. Players with < 10 minutes get no rating. MOTM = highest rating (tie: more goals, then the winning team, then lower id).

### 13.15 MatchSim API (`engine.ts`)
```ts
export interface MatchSim {
  step(): MatchEvent[];                 // one action and any immediate consequences
  runUntil(t: number): MatchEvent[];
  runToEnd(): MatchEvent[];
  applyCommand(c: MatchCommand): void;  // queues; effect per §13.12
  snapshot(): MatchSnapshot;            // JSON-serialisable, includes rng state
  isFinished(): boolean;
  result(): MatchResult;                // only after FULL_TIME
}
export function createMatch(input: MatchInput, seed: number): MatchSim;
export function restoreMatch(snapshot: MatchSnapshot): MatchSim;
export function simulateInstant(input: MatchInput, seed: number): MatchResult;  // AI-vs-AI and Instant Result
```
`simulateInstant` MUST take < 30 ms per match on a mid laptop (benchmark in the calibration script).

### 13.16 Calibration targets (equal teams, both OVR 68, all Balanced/Mixed/Normal/Mid/Normal/Normal/Mixed, 4-4-2 vs 4-4-2, 5,000 matches)
| Metric | Target |
|---|---|
| Goals per match | 2.5–2.9 |
| Home win / draw / away win | 43–47% / 24–28% / 27–31% |
| Shots per team | 11–14 |
| Shots on target per team | 3.8–5.0 |
| xG per team | 1.2–1.5 |
| Pass completion | 78–86% |
| Passes per team | 300–480 |
| Corners per team | 4.5–6 |
| Fouls per team | 10–13 |
| Yellows per match | 3.0–4.5 |
| Matches with a red card | 5–12% |
| Penalties per match | 0.20–0.32 |
| Offsides per team | 1.5–3 |
| Injuries per match | 0.15–0.35 |
| 0–0 draws | 6–10% |
| Possession std-dev across matches | 4–9 percentage points |

Strength response (same setup, 5,000 matches each):
| Gap (home OVR − away OVR) | Home win % |
|---|---|
| +5 | 55–65 |
| +10 | 68–78 |
| −10 | 15–25 |

Tactic sanity (must hold in the report): Pressing High vs Low (equal teams) → more opponent turnovers in their DEF/MID third and more fouls, and the pressing side's average condition at FT ≥ 4 lower; Width Wide → more crosses (≥ +30%); Passing Direct → fewer passes (≥ −20%) and more aerial duels; Line High → more offsides and more one-on-ones conceded; Mentality Attacking → more shots for and more counter-attacks against.

**Tuning procedure:** only change `K.*` constants in `balance.ts`, in this order: shot utility base (goals and shots), `K.passBase` (pass %), durations (pass counts), cross/delivery constants (corners), foul rates (fouls/cards), skill coefficients 0.55/0.9 (strength response). After each change re-run `npm run calibrate`. Record the final report in `docs/PROGRESS.md`.

### 13.17 Tactical depth: roles, opposition orders, transitions, set pieces
This section adds the decisions that let one change turn a match. Design rules (MUST):
- **No free lunch.** Every role, order and setting has a gain and a cost written into its numbers, and the UI shows both in one line each. Nothing is strictly better than the neutral choice.
- **Neutral defaults.** Every slot's default role and every new setting's `Mixed` value have zero modifiers, so the §13.16 calibration targets still hold with defaults.
- **Fit matters.** A role suits some players and not others. A badly suited player gets the role's risks in full but only part of its gains.
- All numbers below go in `balance.ts` (`K.roles.*`, `K.opp.*`, `K.trans.*`, `K.setp.*`, `K.pi.*`) or in the role table `src/config/roles.ts`.
- **Priority (the user's call, 19 Nov):** tactical depth outranks visual polish. If time runs short, cut or simplify visual and motion work (§14, §19.7) before any part of this section. Every rule here MUST work in the engine, even if its UI ends up plain.

#### 13.17.1 Modifier vocabulary
Each role or order is a list of modifiers of these kinds:
- **inv** (involvement, applied in §13.5 after the mentality step, in place of the old duty step, then renormalise): `X→Y n%` moves n% of the player's weight in group X to group Y. Groups: `DEF`, `MID`, `ATT` (thirds), `lane→C` (from his own lane to Centre in the same third), `C→lane` (the reverse).
- **recv** (receiver weight ×k): multiplies his weight when teammates pick a receiver (§13.5 selection), optionally limited to thirds.
- **use** (holder utilities, §13.6): added to an action's utility when he has the ball.
- **as A / as R / as D** (resolution ctx, §13.7–13.8): added to the ctx of rolls where he is the actor, the receiver, or the primary defender. `S_x +v` means add v to that skill term before weighting.
- **team** (a team-wide ctx term while he is on the pitch; if two players give the same team term, only the larger applies).
- **cost**: fatigue drain multiplier (§12.2), foul probability multiplier (§13.8).

**Fit**: `score = Σ w·attribute` over the role's key attributes; `fit = clamp((score − 50) / 30, 0, 1)`. Positive modifiers (gains) are multiplied by `0.4 + 0.6·fit`; negative modifiers (risks and costs) always apply in full. The UI shows fit as 1–5 stars: `1 + round(4·fit)`. Neutral roles have no modifiers, so fit does not matter for them.

#### 13.17.2 Roles (replace duties)
Every slot has a role. Slot groups and their roles (first one listed = neutral default):

| Role id | Name (UI) | Slots | Description (UI, exact) | Gains | Risks / costs | Key attributes |
|---|---|---|---|---|---|---|
| `gk` | Goalkeeper | GK | "Stays on his line." | none | none | none |
| `sweeper_keeper` | Sweeper keeper | GK | "Comes off his line to sweep behind the defence." | team: opponent through balls ctx −0.3, their `oneOnOne` probability ×0.75; Short distribution pass ctx +0.2 | opponent OUTSIDE_CENTRAL `xG_ref` +0.02 (he's off his line); 3% of opponent through balls become a GK foul outside the box (FREE_KICK) | oneOnOnes .4, decisions .3, passing .3 |
| `cb` | Centre-back | CB | "Defends his zone." | none | none | none |
| `stopper` | Stopper | CB | "Steps out to win it early." | as D: `S_tkl` +0.35, `S_press` +0.25, `S_airD` +0.2 | when he is D and loses a tackle or duel, the opponent's next step gets through ctx +0.3; fouls ×1.2 | tackling .4, strength .3, heading .3 |
| `covering_cb` | Covering centre-back | CB | "Drops off and sweeps up behind." | team: opponent through balls ctx −0.25 | as D: `S_tkl` −0.15, `S_press` −0.2 | positioning .4, pace .4, decisions .2 |
| `ball_playing_cb` | Ball-playing centre-back | CB | "Brings it out and starts attacks." | use in DEF: progress +0.3, switch +0.2, long +0.1; as A: pass ctx +0.15 | when the opponent's pressing is High, his failed passes are always interceptions in our DEF (no throw-in) and the opponent's next step gets shot utility +0.3 | passing .5, composure .3, decisions .2 |
| `fb` | Full-back | LB, RB, LWB, RWB | "Gets forward when it's on." | none | none | none |
| `fb_defensive` | Defensive full-back | LB, RB, LWB, RWB | "Stays home and guards the flank." | team: opponent actions in his lane in our DEF ctx −0.15 | inv `ATT→DEF 60%`, `MID→DEF 15%`; use: cross −0.3 | positioning .4, tackling .4, strength .2 |
| `fb_overlapping` | Overlapping full-back | LB, RB, LWB, RWB | "Bursts past the winger to cross." | inv `MID→ATT 25%`; use: cross +0.4; team: crosses from his lane delivery +0.1 | during an opponent Counter phase, their actions in his lane ctx +0.25; fatigue ×1.08 | crossing .4, pace .3, stamina .3 |
| `fb_inverted` | Inverted full-back | LB, RB, LWB, RWB | "Steps into midfield when we have it." | inv `lane→C 40%` in MID; team: our recycle and progress passes in MID ctx +0.1; use: progress +0.2 | use: cross −0.4; during an opponent Counter phase, their actions in his lane ctx +0.2 | passing .4, decisions .3, firstTouch .3 |
| `dm` | Holding midfielder | DM | "Shields the back line." | none | none | none |
| `anchor` | Anchor | DM | "Never leaves the space in front of the defence." | inv `MID→DEF 20%`, `ATT→MID 50%`; team: opponent actions in their ATT Centre ctx −0.15; use: recycle +0.3 | use: progress −0.2, through −0.2 | positioning .5, tackling .3, decisions .2 |
| `deep_playmaker` | Deep playmaker | DM, CM | "Dictates play from deep." | recv ×1.3 in DEF/MID; use: switch +0.3, long +0.2, through +0.2; as A: pass ctx +0.1 | when the opponent's pressing is High, his failed passes start an opponent Counter phase | passing .5, decisions .3, composure .2 |
| `ball_winner` | Ball-winner | DM, CM | "Hunts the ball down." | as D: `S_press` +0.4, `S_tkl` +0.3 | fouls ×1.5; fatigue ×1.1; use: through −0.2 | tackling .4, workRate .3, stamina .3 |
| `cm` | Central midfielder | CM | "Does a bit of everything." | none | none | none |
| `box_to_box` | Box-to-box | CM | "Covers every blade of grass." | inv `MID→ATT 10%`, `MID→DEF 10%`; as D in MID: `S_press` +0.2 | fatigue ×1.12 | stamina .4, workRate .3, passing .3 |
| `playmaker` | Playmaker | CM, AM | "Gets on the ball and picks the pass." | recv ×1.25; use: through +0.35, progress +0.1; as A: pass ctx +0.1 | as D: `S_press` −0.2, `S_tkl` −0.1 | passing .4, decisions .3, firstTouch .3 |
| `runner` | Late runner | CM | "Arrives late in the box." | inv `MID→ATT 25%` (into ATT Centre); use in box: shot +0.3; as R on through balls: `S_run` +0.2 | team: opponent progress passes through our MID ctx +0.1 | offTheBall .5, finishing .3, stamina .2 |
| `am` | Number 10 | AM | "Links midfield and attack." | none | none | none |
| `shadow_striker` | Shadow striker | AM | "Plays off the striker and gets in the box." | inv `MID→ATT 30%`; use in ATT Centre and box: shot +0.3; as R on through balls: `S_run` +0.2 | as D in MID: `S_press` −0.2, `S_tkl` −0.2 | offTheBall .4, finishing .4, composure .2 |
| `wm` | Wide midfielder | LM, RM | "Works the flank both ways." | none | none | none |
| `wm_defensive` | Defensive winger | LM, RM, LW, RW | "Tracks back to help his full-back." | inv `ATT→MID 30%`, `MID→DEF 15%`; team: opponent actions in his lane in our DEF ctx −0.15 | use: cross −0.1, dribble −0.1 | workRate .4, tackling .3, stamina .3 |
| `wide_playmaker` | Wide playmaker | LM, RM | "Drifts inside to make things happen." | inv `lane→C 25%` in MID; use: through +0.3, switch +0.2 | use: cross −0.3 | passing .4, decisions .3, dribbling .3 |
| `wf` | Wide forward | LW, RW | "Attacks his flank." | none | none | none |
| `winger` | Winger | LM, RM, LW, RW | "Hugs the line, beats his man, crosses." | inv `C→lane 25%`; use: cross +0.4, dribble +0.2 | use: shot −0.2 | crossing .4, dribbling .3, pace .3 |
| `inside_forward` | Inside forward | LM, RM, LW, RW | "Cuts inside to shoot." | inv `lane→C 30%` in ATT; use in ATT: shot +0.4, dribble +0.1; 50% of his shots from ATT wide use the central context instead (BOX_CENTRAL / OUTSIDE_CENTRAL); if the full-back behind him is Overlapping, that full-back's cross delivery +0.15 | use: cross −0.5; if the full-back behind him is Defensive or Inverted, nobody holds the width: team cross utility from that lane −0.3 | finishing .3, dribbling .3, longShots .2, pace .2 |
| `st` | Striker | ST | "Leads the line." | none | none | none |
| `target_man` | Target man | ST | "Wins headers and holds it up." | team: long utility +0.2; as R in aerial duels: `S_air` +0.35; cross header target weight ×1.4; after he wins an aerial duel, the next step's recycle and progress pass ctx +0.2 (knock-down to a runner) | use: dribble −0.3; as R on through balls: `S_run` −0.2 | heading .4, strength .4, firstTouch .2 |
| `poacher` | Poacher | ST | "Lives in the box." | inv `MID→ATT 50%`, `lane→C 20%` in ATT; use in box: shot +0.3; as A on SIX_YARD/BOX_CENTRAL shots: `S_fin` +0.15 | recv ×0.5 outside ATT; team: our pressing effect in the opponent's DEF third is 10% weaker | finishing .4, offTheBall .4, composure .2 |
| `pressing_forward` | Pressing forward | ST | "Leads the press from the front." | team: our `S_press` +0.3 against the opponent's DEF third; opponent passes in their DEF third ctx −0.2 | fatigue ×1.15; use: shot −0.1 | workRate .4, stamina .3, pace .3 |
| `false_nine` | False nine | ST | "Drops deep and drags defenders out." | inv `ATT→MID 35%` (ATT Centre → MID Centre); recv ×1.2 in MID; use: through +0.4, progress +0.2; team: teammates' `S_run` on through balls +0.25 | his cross header target weight ×0.5; team: header duels won from crosses −0.15 (fewer bodies in the box) | passing .3, decisions .3, firstTouch .2, dribbling .2 |
| `advanced_forward` | Advanced forward | ST | "Runs in behind the defence." | recv ×1.4 on through balls; as R: `S_run` +0.3; `oneOnOne` probability +0.05 on his runs | offside probability ×1.25 on his runs; recv ×0.7 in MID | pace .4, offTheBall .4, finishing .2 |

Slots LM/RM may use `wm`, `wm_defensive`, `wide_playmaker`, `winger`, `inside_forward`; LW/RW may use `wf`, `winger`, `inside_forward`, `wm_defensive`. The "full-back behind him" is the FB/WB slot on the same side.

#### 13.17.3 Opposition orders
`orders: OppOrder[]`, at most 3, one per target, targets must be on the pitch (an order on a substituted player lapses; on a sent-off player it is removed). The **marker** for a target = our defender with the highest weight in the target's mirrored zone at the moment the order starts (recomputed after any formation change or sub).

| Order | UI wording (exact; `{player}` = target) | Effect | Cost |
|---|---|---|---|
| `tightMark` | "Stay touch-tight on {player}. He'll see less of the ball, but his marker gets dragged about." | target recv ×0.75; in any roll where the target is A or R, the marker is D and gets `S_press` and `S_tkl` +0.3 | when the target is in MID, opponent through balls into the marker's usual zone get ctx +0.2; marker fouls ×1.2 |
| `doubleUp` | "Two on {player} whenever he has it. It leaves space on the other side." | when the target holds: dribble ctx −0.5, shot and cross ctx −0.2, pass ctx −0.1 | opponent actions in the lane opposite the target's lane ctx +0.2. Max one `doubleUp` |
| `pressOnBall` | "Close {player} down the moment he gets it. If he beats the press, we're open." | when the target holds in his DEF/MID: our `S_press` +0.4 on him, his pass ctx −0.3, his recycle utility +0.3 | if his pass succeeds, the opponent's next step gets progress +0.3 and through +0.2; fatigue ×1.05 for our player nearest him |
| `showInside` | "Force {player} inside. Fewer crosses, more shots." (wide players and full-backs only) | target cross utility −0.5, dribble −0.2 | target shot utility in ATT +0.2; 50% of his ATT-wide shots use central contexts |
| `showOutside` | "Force {player} down the line. Fewer shots, more crosses." (wide players and full-backs only) | target shot utility −0.4; his ATT-wide shots keep wide contexts | target cross utility +0.2, dribble +0.1 |

#### 13.17.4 Transitions and goalkeeper distribution (new instruction fields)
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `onLoss` (when we lose it) | **Counter-press** "Win it back in seconds. Get it wrong and they're through." · **Regroup** "Get back into shape and let them have it." · **Mixed** "Read the moment." (default) | Counter-press: when we lose the ball in open play in our MID or ATT third, the opponent's first step is a press check: `p_regain = σ(−1.0 + 0.8·S̄_press − 0.6·S_pass(holder))` (S̄_press = mean `S_press` of our 3 players with the highest weight in that zone); success = `TACKLE` back to us at that point. Regroup: an opponent Counter phase (§13.9) can only start if our line is High (not from our mentality), and their first step gets recycle +0.3 | Counter-press: if the press check fails, the opponent gets a Counter phase for 2 steps with an extra ctx +0.2; team fatigue ×1.05. Regroup: we never win the ball back in their half on the first step; their next 2 steps' pass ctx +0.1 |
| `onWin` (when we win it) | **Counter** "Break at speed." · **Keep it** "Calm down and keep the ball." · **Mixed** "Read the moment." (default) | Counter: our Counter phase starts when we win the ball in DEF/MID if the §13.9 condition holds, or with probability 0.4 otherwise. Keep it: our first 2 steps after winning it get recycle +0.4 and pass ctx +0.1 | Counter: Counter-phase execution ctx −0.1 (rushed). Keep it: we never get a Counter phase |
| `distribution` (goalkeeper) | **Short** "Play out from the back." · **Long** "Go long to the front men." · **Wide** "Find the full-backs." · **Mixed** "Keeper's choice." (default, the old §13.8 goal-kick rule) | Short: goal kicks and held saves/claims go to a CB in DEF Centre, first action utilities as normal. Long: a long ball from the GK to MID/ATT Centre (aerial duel; target man bonus applies). Wide: to a FB/WB in his DEF lane, first action progress +0.2 | Short: against opponent pressing High, the first pass ctx −0.4 and a failed first pass gives the opponent the ball in our DEF Centre. Long: 45% of deliveries are contested (aerial duel instead of a clean catch). Wide: the first pass is forced to the touchline lane (switch and through not allowed on that step) |

#### 13.17.5 Set pieces (new instruction fields)
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `cornersFor` (our corners) | **Near post** "Flick-ons at the near post." · **Far post** "Big men at the back stick." · **Short** "Work it short and keep the ball." · **Mixed** "Taker's choice." (default) | Near post: GK claim −0.04; header target weight favours pace (heading .5, pace .5); won headers use `xG_ref` 0.13. Far post: header target weight ×1.5 for the best header; header duel +0.2 for our target. Short: no cross; we keep the ball in ATT wide outside the box, next step cross utility +0.3 | Near post: delivery ctx −0.1. Far post: GK claim +0.03. Short: no immediate header chance |
| `cornersAgainst` (their corners) | **Zonal** "Defend the space." · **Man-mark** "Pick up a man each. Watch the wrestling." · **Mixed** "Bit of both." (default) | Zonal: their Near post deliveries ctx −0.15. Man-mark: our header defender is our best header matched to their target; header duel −0.15 for them | Zonal: their Far post header duel +0.1 for them. Man-mark: 4% of their corners become a foul in our box (penalty) |

#### 13.17.6 What the player sees (Tactics, §11.8)
- Click a magnet → its **role card** (a Sheet): the slot's roles as a list, each with the name, fit stars for this player, the description, and two short lines "Gives you: …" / "Costs you: …" generated from the modifier list (templates in `content/tactics.json`, one per modifier kind, e.g. "more crosses", "space behind him on the counter").
- The clipboard is grouped: **With the ball** (mentality, passing, tempo, width, focus), **Without the ball** (pressing, line), **Transitions** (when we lose it, when we win it, goalkeeper), **Set pieces** (our corners, their corners, takers). Each option shows its exact wording above.
- The role card also holds that player's **instructions** (§13.17.11): up to 2, as toggles with their gain and cost lines; conflicting ones are disabled with the reason.
- **Opposition** tab: the opponent's likely XI as red-marker magnets on a second board; click one → choose an order (only valid ones shown), with its wording and cost line. Shows "2 of 3 orders used".
- In Pre-Match step 2 and in the match Tactics overlay, the same controls in compact form.

#### 13.17.7 Key battles (Pre-Match opponent report and half-time)
Show up to 3 duels with an arrow to the side that has the edge: our FB vs their winger in each lane (pace + dribbling vs pace + tackling), our CBs vs their ST (heading + strength vs heading + strength; pace vs pace if their ST is an Advanced forward), our DM vs their AM/false nine (positioning + tackling vs decisions + passing). Edge = difference of the summed z-scores; label "big edge" when |diff| ≥ 1.0. Pure UI, computed from attributes and roles; the assistant uses it (§15.2).

#### 13.17.8 AI managers (§13.13 additions)
- Roles: for each slot pick the best-fit role in the slot's list; keep the neutral role unless the best fit ≥ 0.6. Club style overrides when the player's fit ≥ 0.5: Passing Direct → ST `target_man`; Pressing High → ST `pressing_forward`; Width Wide → wide slots `winger`; Passing Short → one CB `ball_playing_cb`; Mentality Defensive → DM `anchor` and FBs `fb_defensive`.
- Transitions: Pressing High + Mentality Attacking → `onLoss` Counter-press; Mentality Defensive → `onLoss` Regroup and `onWin` Counter; Passing Direct → `distribution` Long. Everything else Mixed.
- Orders: clubs with reputation ≥ 3 put `tightMark` on the user's highest-OVR attacker if his OVR ≥ their best defender's OVR + 5. In-match: `doubleUp` on a user player with ≥ 2 goals + assists in the match (once).

#### 13.17.9 Assistant rules (add to §15.2 and §15.4)
Pre-match (each with Apply):
- Their highest-OVR attacker ≥ our best defender + 5 → "Put {marker} touch-tight on {player}." (`tightMark`)
- Their slowest CB pace ≤ 60 and our best ST pace ≥ 75 → "Make {player} an advanced forward and go in behind." (role + Passing Direct)
- Their CB with passing ≤ 55 → "Press {player} when he has it. He'll panic." (`pressOnBall`)
- Their Inside forward with longShots or finishing ≥ 75 → "Show {player} outside. Make him cross." (`showOutside`)
- Their best header ≥ our best header + 8 → "Go zonal at their corners." (`cornersAgainst` Zonal)
- Their pressing High and our GK passing ≤ 50 → "Don't play out from the back today. Go long." (`distribution` Long)
In-match (last 15 minutes of events):
- An opponent with ≥ 2 shots or key passes → "{player} is running the show. Get two on him." (`doubleUp`)
- Our Counter-press failed ≥ 3 times and they had a Counter phase each time → "We're getting caught. Regroup when we lose it." (`onLoss` Regroup)
- Our far-post corners lost ≥ 3 header duels → "Their keeper's eating the back post. Try near post." (`cornersFor` Near post)
- Our full-back role Overlapping and they had ≥ 2 Counter-phase attacks down his lane → "{player} keeps getting caught upfield. Tell him to stay home." (role `fb_defensive`)

#### 13.17.10 Calibration additions (§13.16)
With all defaults (neutral roles, Mixed settings, no orders) every §13.16 target still holds. Add these sanity checks (equal teams, 2,000 matches each), all MUST hold:
- `tightMark` on the opponent's most-involved CM → his touches −20% to −35%.
- Counter-press vs Mixed → our ball wins in the opponent's MID/ATT third ≥ +25%, and Counter phases conceded higher.
- Target man + Passing Direct → aerial duels won by that striker ≥ +30%.
- Inside forward vs Winger (same player) → his shots ≥ +40%, his crosses ≤ −40%.
- Sweeper keeper with Line High → one-on-ones conceded ≥ −20% vs `gk`.
- **No dominant choice:** no single role, order, setting or player instruction moves the win rate between equal teams by more than ±6 percentage points.
- "Shoot more" on a player with longShots ≤ 50 → his xG per shot falls and his team's possession falls (shots from bad spots give the ball away).

#### 13.17.11 Player instructions
`playerInstructions: Record<slotIndex, PlayerInstruction[]>`, at most 2 per player, stacked on top of his role. Pairs that contradict each other (more/less of the same thing, Get forward + Hold position) cannot be combined. Instructions belong to the slot and move with a swap.

| Instruction | UI wording (exact) | Effect | Cost |
|---|---|---|---|
| `shootMore` | "Shoot more: try his luck from distance." | use: shot +0.35 (also allowed from MID Centre and ATT wide at OUTSIDE contexts) | more low-xG shots; a blocked or missed long shot gives up possession |
| `shootLess` | "Shoot less: work a better chance." | use: shot −0.35 outside the box, progress +0.15 | fewer shots; more passes in the final third (more chances to lose it) |
| `dribbleMore` | "Take players on." | use: dribble +0.35 | failed dribbles lose the ball higher up; fouls won +, ball lost + |
| `dribbleLess` | "Move it on quickly." | use: dribble −0.35, recycle +0.15 | fewer fouls won, fewer chances created alone |
| `crossMore` | "Get it in the box early." | use: cross +0.4 (also early crosses from MID wide) | more crosses claimed by the keeper |
| `crossLess` | "Keep it on the floor." | use: cross −0.4, progress +0.15 | fewer headers; wide play is easier to defend |
| `getForward` | "Get forward at every chance." | inv `MID→ATT 20%`, `DEF→MID 15%` | his zone is empty on opponent counters (their actions there ctx +0.15); fatigue ×1.06 |
| `holdPosition` | "Hold your position." | inv moves 50% of any weight outside his slot's main third back into it | less support in attack (recv ×0.9 for him outside his third) |
| `stayWider` | "Stay wide and stretch them." | inv `C→lane 25%` | fewer bodies centrally (team recycle in MID Centre ctx −0.05) |
| `closeDownMore` | "Close down more." | as D: `S_press` +0.3 | fatigue ×1.08; when beaten, the opponent's next step progress +0.2 |
| `stayOnFeet` | "Stay on your feet." | fouls ×0.5 (fewer cards, fewer penalties) | as D: `S_tkl` −0.25 |
| `longThrows` | "Take the long throws." (players with strength ≥ 70) | our throw-ins in the ATT third become a cross delivery into the box (delivery uses strength instead of crossing) | the throw takes longer (+6 s) and the opponent's GK claim chance +0.04 |

Player instructions are part of the `instructions` command (§13.12) and of the AI manager (§13.17.8: AI uses at most one per player, only `shootLess` for low-longShots midfielders, `stayOnFeet` for players on a yellow after 60', `getForward` when chasing a game at 75'+).

### 13.18 Depth pass 2 (SPEC 1.4, approved by the user 20 Nov)
Same design rules as §13.17: no free lunch, neutral defaults change nothing (the §13.16 targets hold), numbers in `balance.ts` under `K.d2.*`, UI wording exact as written here, and the assistant can set any of them with Apply. A season must still play in about 30 minutes, so every item has a sensible default and never needs touching.

#### 13.18.1 Mentality in five steps
`VeryDefensive` "Everyone behind the ball." · `Defensive` · `Balanced` · `Attacking` · `VeryAttacking` "Throw everything forward."
- The Very steps apply the §13.6 Defensive/Attacking utility rows × 1.6.
- VeryAttacking: inv `MID→ATT 15%` for every outfield player except CBs. Cost: the opponent's Counter phase (§13.9) also starts from wins in their DEF third, with their execution ctx +0.1; team fatigue × 1.04.
- VeryDefensive: inv `ATT→MID 15%` for every player except STs. Cost: our Counter phase can only start if `onWin` is Counter; our shot utility −0.1 everywhere.
- AI (§13.13): losing at 80'+ uses VeryAttacking instead of Attacking.

#### 13.18.2 Final third (`finalThird`)
**Work it into the box** "Walk it in. Only shoot from good spots." · **Shoot on sight** "Have a go whenever you can." · **Mixed** "Players decide." (default)
- Work it in: shot utility outside the box −0.4; in ATT: progress +0.2, dribble +0.1, in-box pass +0.2. Cost: pass ctx −0.1 in ATT (crowded), so more turnovers near their box.
- Shoot on sight: shot utility outside the box +0.4 (MID Centre +0.2), in the box +0.2. Cost: lower xG per shot; a blocked shot is a defenders' possession 65% of the time (not 50%).

#### 13.18.3 Crosses (`crossStyle`)
**Low** "Drill it across the six-yard box." · **Whipped** "Bend it in with pace." · **Floated** "Hang it up for the big men." · **Mixed** "Crosser's choice." (default)
- Low: 60% of won crosses become ground chances (BOX_CENTRAL or SIX_YARD 30/70) instead of 40%; the ground "duel" uses pace .5 and offTheBall .5; GK claim −0.04. Cost: 15% of low crosses are blocked (→ 40% CORNER, 60% CLEARANCE).
- Whipped: HEADER xG_ref 0.13 (not 0.11), on-target +0.05. Cost: delivery ctx −0.15.
- Floated: delivery ctx +0.15; both header skills (S_air and S_airD) × 1.3, so height decides more. Cost: GK claim +0.04.

#### 13.18.4 Offside trap (`offsideTrap`, on/off)
"Step up together and catch them offside." Default off.
- On: a failed through ball becomes offside with probability +0.20 (cap 0.7); 10% of the opponent's long balls into ATT are flagged offside.
- Cost: a through ball that beats the trap gives `oneOnOne` +0.08.

#### 13.18.5 Tackling (`tackling`, team)
**Get stuck in** "Win every fifty-fifty." · **Stay on your feet** "Stay up and stay on the pitch." · **Mixed** (default)
- Get stuck in: as D, `S_tkl` +0.25 for the whole team. Cost: fouls × 1.35, yellow chance per foul × 1.2.
- Stay on your feet: fouls × 0.6. Cost: `S_tkl` −0.2.
- A player's own `stayOnFeet` (§13.17.11) overrides the team setting for him.

#### 13.18.6 Force them (`forceOpp`, team, without the ball)
**Inside** "Show them inside. Fewer crosses." · **Outside** "Show them down the line. Fewer shots." · **Mixed** (default)
- Inside: every opponent wide holder's cross utility −0.3. Cost: his shot utility in ATT +0.15.
- Outside: every opponent wide holder's shot utility −0.25. Cost: his cross utility +0.2.
- An opposition order (§13.17.3) on a player replaces this for him.

#### 13.18.7 Time-wasting (`timeWasting`)
**Never** (default) · **When ahead late** "Take your time over everything when we're winning late on."
- When ahead late (only while leading at 70'+): restart durations (throw-in, goal kick, free kick, substitution) × 1.4, recycle +0.2.
- Cost: the referee adds 50% of the extra time to stoppage time; each restart has a 2% yellow for the taker; from 85' the opponent's attacking steps get ctx +0.1 (we sit too deep).

#### 13.18.8 Set pieces, extended
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `freeKicks` (ours, ATT Centre within 30 m) | **Shoot** "Go for goal." · **Cross** "Put it in the box." · **Short** "Play it short and keep it." · **Mixed** (default, the §13.8 50/50) | Shoot: 85% DIRECT_FK. Cross: 85% cross delivery. Short: we keep the ball at the point, next step progress +0.3 | Shoot or Cross: the other option is mostly gone. Short: no immediate chance |
| `cornerSwing` (ours) | **Inswinger** "Bend it towards goal." · **Outswinger** "Bend it away from the keeper." · **Mixed** (default) | Inswinger: header duel +0.1 for our target, 15% of won headers use SIX_YARD. Outswinger: GK claim −0.03, second balls to our attackers 55% (not 40%) | Inswinger: GK claim +0.03. Outswinger: header duel −0.05 |
| `menBack` (our corners) | **1** "One back. Everyone else attacks." · **2** (default) · **3** "Three back. Safety first." | 1: header target weights × 1.15 | 1: when their clearance reaches them, 50% chance of a Counter phase. 3: header weights × 0.85, and no Counter phase from our corners |
| `postMen` (their corners) | **None** (default) · **Near post** "A man on the near post." · **Both posts** "A man on each post." | Near: their near-post headers xG_ref −0.03. Both: their header goals × 0.85 | Near: their second balls to attackers 50%. Both: 55% (fewer markers on the edge of the box) |

#### 13.18.9 More player instructions (same rules as §13.17.11: at most 2, clashing pairs blocked)
| Instruction | UI wording (exact) | Effect | Cost | Clashes with |
|---|---|---|---|---|
| `roam` | "Roam from position." | inv: 25% of his weight spread evenly over adjacent zones; recv × 1.15 | as D in his slot's zones, `S_press` −0.15 | holdPosition |
| `sitNarrower` | "Sit narrower." | inv `lane→C 25%` | his cross utility −0.3; opponent actions in his lane ctx +0.1 | stayWider |
| `crossFromByline` | "Get to the byline before crossing." | his crosses only from ATT wide: delivery ctx +0.1, 30% become cut-backs (in-box pass to BOX_CENTRAL) | no early crosses from MID wide; one extra step in ATT (more chances to lose it) | crossFromDeep, crossLess |
| `crossFromDeep` | "Cross early, from deep." | early-cross utility from MID wide +0.4 | delivery ctx −0.2, GK claim +0.03 | crossFromByline, crossLess |
| `riskyPasses` | "Try the killer pass." | use: through +0.3, progress +0.1 | his pass ctx −0.15 | playSafe |
| `playSafe` | "Play it safe." | use: recycle +0.3; his pass ctx +0.15 | through −0.3 | riskyPasses |

#### 13.18.10 Plans A, B and C
- Three `TacticPlan`s (§8.4), named by the user (default "Plan A", "Plan B", "Plan C"). A new game copies the club style into all three. The lineup, bench, captain, takers and opposition orders are shared; switching plans keeps players on the same slot indices (as in a formation change).
- Switching before a match is free. In a match it is one command `{ kind: 'plan'; side; plan: 0|1|2; issuedAtT }` that acts like a formation + instructions command (§13.12: takes effect after 30 s).
- Cost: familiarity is tracked per area (§13.18.11), so a rarely used plan plays with a sharpness penalty.
- Assistant (§15.4, in-match): losing at 60'+ and Plan B's mentality is more attacking than the active plan's → "Time for Plan B?" (Apply switches).
- AI managers don't use plans (their in-match rules in §13.13 already cover it).

#### 13.18.11 Familiarity per area
- Per club, `Familiarity` (§8.4), 0–100 for each formation, mentality, passing style and pressing level. Starting values: the club style's values 90, one step away 65, others 45. For a formation: the club's formation 90, formations sharing its back line 65, others 40.
- Match effect: for each of the 4 areas in use, if its familiarity is under 70, all execution ctx `−(70 − fam) / 400`. The total is capped at −0.25.
- Weekly: every area used in a match +6 (cap 100); Tactical training (§12.3) +6 more for the active plan's areas; unused values −2 (floor 40).
- This replaces the single formation familiarity of §12.3 (Tactical training now raises all four areas of the active plan).
- **Calibration runs with all familiarity at 100**, so §13.16 is unchanged.

#### 13.18.12 Match analysis (UI only, no engine change)
In Half-Time and Full-Time, an **Analysis** panel (on air, telestrator marker style as in `docs/design/hub/`):
- **Heat map** for any player: density of the event points where he was A, R or D, blurred over a 21×14 grid.
- **Pass network**: each player as a node at his average event position (size = touches); an edge for each pair with ≥ 3 completed passes (width ∝ count).
- **Where our chances came from**: shots grouped by the action before them (cross, through ball, dribble, set piece, long shot, rebound) and by lane, with xG totals, for both teams.
- **Key battles** (§13.17.7): duels won and lost by each pair this match, with an arrow to the winner.
- The assistant's half-time bullets (§15.5) may point at one of these ("Look where their chances are coming from").

#### 13.18.13 Calibration additions (equal teams, 2,000 matches each; all MUST hold)
Every check is a **band**, not a floor (v1.6): an effect far above its target is as wrong as one below it, because real football doesn't move that much from one instruction. Tune `K.d2.*` until each value sits inside its band.
- VeryAttacking vs Balanced: our shots +20% to +50%; Counter phases conceded +40% to +150%.
- ShootOnSight vs Mixed: shots +25% to +55%; xG per shot −20% to −40%.
- Offside trap on: offsides won +40% to +150%; one-on-ones conceded +15% to +45%.
- Get stuck in vs Stay on feet: tackles won +10% to +35%; fouls +25% to +70%.
- Floated crosses with a target man vs Low crosses with a pace forward: header shots +30% to +120%; ground chances from crosses −30% to −70%.
- menBack 1 vs 3: header shots from our corners +10% to +40%; Counter phases conceded after our corners +50% to +250%. With menBack 3 that count MUST still be at least 0.15 per match (a percentage from a near-zero base is meaningless).
- Familiarity 40 everywhere vs 100: win rate between equal teams falls by 6–14 points.
- **Absolute sanity, per team per match, at every setting tested above:** shots 6–22, fouls 6–18, tackles won 10–35, offsides 0.5–5, Counter phases 2–14. A setting that pushes any of these outside its range fails even if its band passes.
- The ±6-point "no dominant choice" rule of §13.17.10 covers every option in this section.
- The same rule applies to §13.17.10 and §13.19.7: an upper bound of 3× the stated floor unless a band is given there.

### 13.19 Attacking and defensive roles (SPEC 1.5, approved by the user 20 Nov)
Every player has **two roles**: an attacking role (what he does when we have the ball) and a defensive role (what he does when they have it). Instructions are split the same way and offered by role. This **replaces** the single role of §13.17.2 and the player-instruction rules of §13.17.11 / §13.18.9 where they differ. Same design rules: no free lunch, the first role in each list is neutral (zero modifiers), all numbers in `balance.ts` (`K.roles.*`, `K.droles.*`, `K.pi.*`), the UI matches `docs/design/tactics/`.

#### 13.19.1 Attacking roles: the §13.17.2 table split by phase
Rule for the split: an attacking role keeps only its **in-possession** modifiers (inv, recv, use, as A, as R) and its **transition** costs (what happens because of where he is when we lose the ball, e.g. the overlapping full-back's lane during an opponent Counter phase). Its **as D** and settled-defence team modifiers move to the defensive roles below.

| Slot | Attacking roles (first = neutral) |
|---|---|
| GK | `gk` Goalkeeper · `bp_keeper` Ball-playing keeper (the old sweeper keeper's Short-distribution bonus; cost: against a High press his short passes ctx −0.2) |
| CB | `cb` · `ball_playing_cb` |
| FB/WB | `fb` · `fb_defensive` renamed **Stays home** "Stays back when we attack." (inv as before, use cross −0.3; gain now: opponent Counter-phase actions in his lane ctx −0.2) · `fb_overlapping` · `fb_inverted` |
| DM | `dm` · `anchor` (keeps inv and recycle +0.3, costs progress/through −0.2; its team defence term moves to nothing, it was a defensive effect) · `deep_playmaker` |
| CM | `cm` · `box_to_box` (inv MID→ATT 10%, fatigue × 1.06; its press bonus moves to the defensive Press role) · `deep_playmaker` · `playmaker` · `runner` |
| AM | `am` · `playmaker` · `shadow_striker` |
| LM/RM | `wm` · `wide_playmaker` · `winger` · `inside_forward` |
| LW/RW | `wf` · `winger` · `inside_forward` |
| ST | `st` · `target_man` · `poacher` · `false_nine` · `advanced_forward` |

Moved out of the attacking lists: `stopper`, `covering_cb`, `sweeper_keeper` (defensive part), `ball_winner`, `wm_defensive`, `pressing_forward`. They become defensive roles below.
Two attacking roles lose a cost that was defensive and get an in-possession cost instead: `playmaker`: his failed passes in MID start an opponent Counter phase with probability 0.3; `shadow_striker`: recv × 0.7 in MID (less involved in the build-up).

#### 13.19.2 Defensive roles (new; key attributes in brackets give the fit, §13.17.1)
| Slot | Role | UI description | Gain | Cost |
|---|---|---|---|---|
| GK | `gk_line` **Stay on the line** | "Guards his goal." | none | none |
| GK | `gk_sweep` **Sweep behind** (oneOnOnes .5, decisions .5) | "Comes off his line to clear balls in behind." | opponent through balls ctx −0.3, their oneOnOne × 0.75 | opponent OUTSIDE_CENTRAL xG_ref +0.02; 3% of their through balls become a GK foul outside the box |
| CB | `cb_hold` **Hold the line** | "Defends his zone with the back line." | none | none |
| CB | `cb_step` **Step out** (tackling .4, strength .3, heading .3) | "Steps out to win it early." | as D: S_tkl +0.35, S_press +0.25, S_airD +0.2 | when beaten, the opponent's next step through ctx +0.3; fouls × 1.2 |
| CB | `cb_cover` **Cover behind** (positioning .4, pace .4, decisions .2) | "Drops off and sweeps up behind." | team: opponent through balls ctx −0.25 | as D: S_tkl −0.15, S_press −0.2 |
| FB/WB | `fb_track` **Track the winger** | "Stays with the man on his side." | none | none |
| FB/WB | `fb_press` **Press high** (workRate .4, pace .3, tackling .3) | "Closes their winger down early, high up." | as D in his lane in MID: S_press +0.3 | when beaten in his lane, the opponent's next step through ctx +0.25 |
| FB/WB | `fb_tuck` **Tuck in** (positioning .5, decisions .3, strength .2) | "Narrows to protect the middle." | opponent actions in our DEF Centre ctx −0.1 | opponent actions in his lane in our DEF ctx +0.15, their cross utility from his lane +0.2 |
| DM | `dm_screen` **Screen the defence** | "Sits in front of the back line." | none | none |
| DM | `dm_win` **Win it back** (tackling .4, workRate .3, stamina .3) | "Hunts the ball down." | as D: S_press +0.4, S_tkl +0.3 | fouls × 1.5, fatigue × 1.1 |
| DM | `dm_drop` **Drop between the centre-backs** (positioning .5, heading .3, strength .2) | "Becomes a third centre-back." | opponent through balls ctx −0.2; their header duels in our box −0.05 | opponent actions in our MID Centre ctx +0.15 |
| CM | `cm_hold` **Hold the zone** | "Keeps his place in the shape." | none | none |
| CM | `cm_press` **Press** (workRate .4, stamina .3, tackling .3) | "Closes down whoever comes into his zone." | as D in MID: S_press +0.3 | fatigue × 1.08; when beaten, the opponent's next progress +0.2 |
| CM | `cm_track` **Track runners** (stamina .4, workRate .3, positioning .3) | "Follows midfield runners into the box." | opponent late runs / through balls into our box from his side ctx −0.15 | fatigue × 1.05; opponent actions in our MID Centre ctx +0.1 |
| AM | `am_screen` **Screen their midfield** | "Blocks passes into their midfield." | none | none |
| AM | `am_press` **Press** (workRate .5, stamina .5) | "Closes down their holding midfielder." | as D on their DM/CM in their MID: S_press +0.3 | fatigue × 1.08; opponent progress past him +0.15 |
| Wide | `w_track` **Track back** | "Comes back to help his full-back." | none | none |
| Wide | `w_press` **Press their full-back** (workRate .4, pace .3, stamina .3) | "Closes their full-back down high." | as D on their FB in their DEF lane: S_press +0.3 | fatigue × 1.08; opponent actions in his lane in our DEF ctx +0.1 |
| Wide | `w_high` **Stay high** (pace .5, offTheBall .5) | "Stays up the pitch as an outlet." | our Counter phase starts with probability +0.15 when we win it in DEF/MID; its first step through +0.2 | opponent actions in his lane in our DEF ctx +0.2 |
| ST | `st_central` **Stay central** | "Waits between their centre-backs." | none | none |
| ST | `st_press` **Press the defenders** (workRate .4, stamina .3, pace .3) | "Leads the press from the front." | team: our S_press +0.3 against their DEF third; their passes in their DEF third ctx −0.2 | fatigue × 1.15 |
| ST | `st_shoulder` **Stay on the shoulder** (pace .5, offTheBall .5) | "Stays on the last defender, ready to run." | our long balls and through balls to him: S_run +0.2 | team: opponent recycle in their DEF ctx +0.2 (nobody presses them) |

Fit works as §13.17.1: gains × `(0.4 + 0.6·fit)`, costs in full.

#### 13.19.3 Instructions, split and offered by role
- Each player: up to **2 attacking** instructions and up to **1 defensive** instruction.
- **Attacking** = §13.17.11 + §13.18.9 except `closeDownMore` and `stayOnFeet` (they move to defensive).
- **Defensive** (new set, max 1, effects in `K.pi.*`):

| Instruction | UI wording (exact) | Gain | Cost | Clashes with |
|---|---|---|---|---|
| `closeDownMore` | "Close down more." | as D: S_press +0.3 | fatigue × 1.08; when beaten, the opponent's next progress +0.2 | standOff |
| `standOff` | "Stand off him." | opponent through balls in his zone ctx −0.1 | his opponent's pass and dribble ctx +0.15 | closeDownMore |
| `tackleHarder` | "Get stuck in." | as D: S_tkl +0.25 | fouls × 1.35, yellow chance × 1.2 | stayOnFeet |
| `stayOnFeet` | "Stay on your feet." | fouls × 0.5 | as D: S_tkl −0.25 | tackleHarder |
| `markTighter` | "Mark tighter." | recv × 0.85 for the opponent in his zone | through balls past him ctx +0.15 | none |
| `trackRuns` | "Track runners all the way." | opponent S_run −0.2 on runs from his zone | fatigue × 1.05; opponent actions in his zone ctx +0.1 | none |

- **Offered by role**: each attacking role and each defensive role lists which instructions it allows (the exact lists are the `ATT_ALLOW` and `DEF_ALLOW` tables in `docs/design/tactics/index.html`; copy them into `src/config/roles.ts`). Examples: an Inside forward can't take "Get to the byline"; a Target man can't take "Take players on"; "Stay high" and "Stay on the shoulder" take no defensive instruction. Changing a role drops instructions the new role doesn't allow.
- **Instruction fit**: every instruction has key attributes (also in that file), and fit uses the §13.17.1 formula: gains × `(0.4 + 0.6·fit)`, costs in full. So "Shoot more" on a poor long-shooter gives few extra goals and the full cost.

#### 13.19.4 Types (§8.4)
`Tactics` and `TacticPlan`: `roles` becomes `attRoles: RoleId[]` + `defRoles: DefRoleId[]`; `playerInstructions` becomes `attInstructions: PlayerInstruction[][]` (each 0–2) + `defInstructions: DefInstruction[][]` (each 0–1). Save migration: old roles map to their attacking role where one exists (`stopper`→`cb` + `cb_step`, `covering_cb`→`cb` + `cb_cover`, `sweeper_keeper`→`gk` + `gk_sweep`, `ball_winner`→`cm`/`dm` + `cm_press`/`dm_win`, `wm_defensive`→`wm`/`wf` + `w_track`, `pressing_forward`→`st` + `st_press`); everything else gets the neutral defensive role.

#### 13.19.5 AI managers and the assistant
- AI (§13.17.8): Pressing High → ST `st_press`, one CM `cm_press`; Mentality Defensive → FBs Stays home, DM `dm_drop` if fit ≥ 0.5; Width Wide → wide players `winger`; on the counter (Defensive + onWin Counter) → one wide player `w_high`. Fit ≥ 0.5 as before.
- Assistant (§13.17.9), re-pointed: "Put {player} on Step out" instead of the old stopper advice; in-match "They're getting in behind {player}. Tell him to stand off." when ≥ 2 through balls past him in 15 minutes.

#### 13.19.6 The board (UI)
The Tactics board has a **With ball / Without ball** switch. Without ball, the magnets slide (spring) into the defensive shape: each slot's x = `0.07 + (x − 0.05) × 0.62` plus the line offset (Deep −0.03, High +0.05), then per defensive role (Step out +0.04, Cover −0.03, Press high +0.10, Tuck in moves 30% toward the centre, Drop between the CBs x = 0.17, Press roles +0.06–0.08, Track runners −0.05, Track back −0.05, Stay high and Stay on the shoulder keep their attacking x). This is display only; the engine uses zones. Attacking marks show With ball; defensive role marks, the offside trap and "force them" show Without ball.

#### 13.19.7 Calibration (add to §13.18.13; equal teams, 2,000 matches each)
- `st_press` + `cm_press` vs neutral: ball wins in the opponent's DEF third ≥ +30%, our fatigue higher.
- `w_high` on both wingers vs neutral: our Counter phases ≥ +20%, opponent attacks down those lanes ≥ +15%.
- `dm_drop` vs neutral: opponent through balls completed ≤ −20%, opponent shots from outside the box ≥ +15%.
- `cb_step` vs `cb_cover` (same player): his tackles won ≥ +20%, through balls conceded ≥ +20%.
- All defaults neutral: §13.16 unchanged. The ±6-point rule covers every role and instruction here.

### 13.20 Set pieces in detail (v1.7, approved by the user 22 Nov; `core/match/setPieces.ts`)
This builds on §13.8, §13.17.5 and §13.18.8. The **defaults reproduce today's behaviour** (one Mixed routine, auto jobs, auto takers, Auto wall, 1 forward up), so §13.16 holds. Every option has a gain and a cost. All numbers go in `balance.ts → K.sp.*`. AI clubs use the defaults with auto jobs.

#### 13.20.1 Jobs on our corners
A corner routine places our outfield players in **jobs**. Players without a job stay in their open-play spots outside the box.

| Job | Max | What it does in the engine |
|---|---|---|
| `nearPost` | 2 | header candidate; weight ×2 when the routine targets the near post |
| `farPost` | 2 | header candidate; weight ×2 when it targets the far post |
| `penaltySpot` | 2 | header candidate; weight ×2 when it targets the spot. Won headers here use `BOX_CENTRAL` instead of `HEADER` 30% of the time |
| `keeperScreen` | 1 | stands on the keeper: GK claim −0.04. Header weight ×0.3 |
| `edge` | 2 | takes second balls. 0 edge players: second balls to us 25%; 1: 40% (default); 2: 50%. A second ball he wins goes to a `LONG_RANGE` shot (utility +0.3) or a recycle |
| `short` | 1 | the short option. Only used when the routine's target is Short |
| `stayBack` | 1–3 | replaces `menBack` (§13.18.8): the count of stay-back jobs is the men back |

- **Header candidates** use the §13.7 weights × the job weight. Attackers not in a box job can't win the header.
- **Auto jobs** (the default; also what "Reset to club style" and Assistant pick): the best 2 by `S_air` go to the target zone, the next best to the other post, the best long-range shooter to `edge`, the two slowest defenders to `stayBack` (2), and the rest stay in their spots. The old 13.8 "CBs and STs ×1.3" rule is replaced by these jobs.

#### 13.20.2 Routines (up to 3 per side)
- A routine is `{ name, target: 'Near'|'Far'|'Spot'|'Short'|'Mixed', swing: 'Auto'|'In'|'Out', jobs }`. Our left and right corners each have up to 3. They are named by the user; the defaults are "Near-post flick", "Big man far post" and "Short".
- `target` replaces `cornersFor` (§13.17.5) and keeps its effects: Near is the Near post row, Far is the Far post row, Short is the Short row, Spot is new (header duel −0.05 for our target, won headers on target +0.03, see 13.20.1), and Mixed is the default.
- **Use:** pick one routine per side, or **Rotate** (1 → 2 → 3 in turn).
- **Predictability:** in a match, the n-th use of the same routine gives the defenders header duel `+0.04 × (n − 1)`, capped at +0.12 ("They've read it"). Rotating keeps n low.
- **Sharpness:** each routine has familiarity 0–100. New routines start at 40 and the defaults at 70. Each Set-piece practice session in the training week (§12.18) adds **15 in total, split equally** across the routines in use (one routine +15; rotating three, +5 each). Routines not practised that week lose 5. Effect: delivery ctx `(familiarity − 70) / 300` (±0.1). Choice: one sharp routine that gets read, or three fresh ones that are blunter.

#### 13.20.3 Takers and swing
- **Takers:** left corner, right corner, direct free kick, wide free kick, penalty order 1, 2 and 3 (the first one on the pitch takes it), long throw. Each defaults to Auto (the §13.13 rule; for corners, the best setPieces with the right foot for an inswinger).
- **Swing from the foot:**
  - **Auto (default):** a Right-footed taker from the left corner, or a Left-footed taker from the right corner, takes an inswinger; the reverse is an outswinger; a Both-footed taker uses the routine's swing, or Mixed. Swing effects are the `cornerSwing` rows of §13.18.8.
  - **Forced swing:** if a routine forces In or Out against the taker's foot, delivery ctx −0.08.
- The `cornerSwing` team field becomes each routine's `swing`.

#### 13.20.4 Our free kicks by area
| Area | Options (UI wording) | Effects and costs |
|---|---|---|
| **Central**, within 30 m (ax ≥ 75) | **Shoot** · **Cross near** · **Cross far** · **Short** · **Dummy and shoot** "One runs over, the other strikes." · **Mixed** (default) | Shoot, Short: the §13.18.8 `freeKicks` rows. Cross near and Cross far: crosses with that target's job weights. Dummy: DIRECT_FK xG_ref +0.02 and wall block −0.05, taken by the second-best setPieces player; cost: 20% of dummies are mistimed and become a recycle with no shot |
| **Wide**, left and right (ATT wide) | **Cross near** · **Cross far** · **To the spot** · **Short** · **Mixed** (default) | As the corner targets, with the same jobs (they reuse that side's active corner routine's jobs) |
| **Deep** (MID third and our half) | **Quick** "Take it quick before they set." · **Long into the box** · **Keep it** (default) | Quick: next step progress +0.3; 15% are rushed and lost. Long: a cross delivery from deep, delivery ctx −0.2, the target is the best `S_air` in a box job. Keep: today's "attacking side keeps the ball" |

#### 13.20.5 Defending corners
On top of `cornersAgainst` (Zonal / Man-mark / Mixed, §13.17.5):
- **Mark their main man:** one of our players is assigned to their best `S_air` (Auto: our best `S_air`). When their header target is that player, our D is this marker. Man-mark: the assignment also applies the −0.15.
- **Post men:** who stands on the posts (`postMen`, §13.18.8), now as named jobs.
- **Edge guard (0 or 1):** with 1, their second balls to attackers −10 points and their `LONG_RANGE` from second balls xG_ref −0.02. Cost: one fewer defender in the box, so their header duel +0.04.
- **Forwards up (0, 1 or 2; default 1):**
  - 0: their header duel −0.05, and our clearances never start a Counter.
  - 1: today's behaviour.
  - 2: their header duel +0.06, and 35% of our won clearances start a Counter phase (§13.9).

#### 13.20.6 Defending free kicks
- **Wall:**
  - **Auto** (default): 3–5 by distance, today's behaviour.
  - **Small**: 2 men. DIRECT_FK `blockProb` 0.12 (from 0.20) and xG_ref +0.01; their cross header duel −0.05 (more markers).
  - **Big**: +1 man. Block 0.26; their header duel +0.05.
- **Who's in the wall:** Auto picks the tallest. The block chance also gets `+0.02 × mean z(heading, strength)` of the wall players.
- **Line height on wide free kicks:**
  - **High:** 20% of their deliveries are caught offside (indirect free kick to us), but when a delivery beats the line, their header xG_ref +0.03.
  - **Normal** (default).
  - **Deep:** GK claim +0.04, their second balls to attackers +10 points.

#### 13.20.7 What the player sees (Tactics, §11.8)
- The **Set pieces** divider opens **set-piece mode**: the whiteboard zooms to the attacking box (ours) or our box (theirs). The jobs are drawn as marker circles labelled Near, Far, Spot, Keeper, Edge, Short and Back.
- **Tabs on the board:** Our corners (Left and Right, routines 1–3, Rotate), Their corners, Our free kicks (Central, Wide, Deep), Their free kicks, Takers.
- **Assigning jobs:** drag a magnet onto a circle, or use the keyboard (Enter on a magnet, then Enter on a circle). A full circle swaps players.
- **Marker drawings:** the routine draws its delivery arc (curving in or out from the taker's foot), the runs to each job, and the edge player's shot line. Rename a routine by clicking its name.
- **Every option shows its gain and cost line,** as in §13.17.6.
- **The routine familiarity bar** shows on each routine, with "Practise it in training (Set-piece practice)" under 70.
- In Pre-Match step 2 and the in-match Tactics overlay, a compact version: pick the routine per side, Rotate, Forwards up, Wall.

#### 13.20.8 In the 3D match (§14.3)
At corners and free kicks, the choreographer places players at their job spots: Near (5 m out, near post), Far (far post), Spot (penalty spot), Keeper (on the six-yard line in front of the GK), Edge (the D), Short (5 m from the taker), Back (halfway line, or our box edge for 2+). The opponent sets up as its own jobs say. Delivery and runs follow the routine's target and swing.

#### 13.20.9 Analysis, AI and the assistant
- **Full-Time and Club analysis:**
  - corners and free kicks won
  - shots and goals from each routine
  - set-piece goals conceded
  - who won the most headers in each box
- **The opponent report** (§15.2) shows their set-piece threat (their best `S_air` and their usual target), and suggests a marker and the posts.
- **AI clubs:** auto jobs, one Mixed routine, Auto wall, 1 forward up. A rep ≥ 4 AI club with a strong header (`S_air` z ≥ 1.0) targets its best header's zone.
- **Assistant rules:**
  - "They've read our near-post routine. Rotate?" when n ≥ 3 and two headers were lost to the marker.
  - "Put [best header] on their [target man]" before matches.
  - "Drop a forward back, they're winning everything at corners" when they've won ≥ 3 headers in our box in 20 minutes.

#### 13.20.10 Calibration and tests (add to §13.18.13; equal teams, 2,000 matches each)
- **Defaults:** all §13.16 targets unchanged. Set-piece goals are 22–32% of all goals.
- **Predictability:** the same routine for every corner in a match. Its header goal rate from the 5th use onward is ≥ 20% lower than from the first two uses.
- **Practice:** one routine practised twice a week for 4 weeks vs the default. Corner goals rise by 10–30%, never more.
- **No dominant choice:** the ±6-point rule covers every routine, job layout, wall and forwards-up setting. The best "all headers in one zone" layout must not beat auto jobs by more than +4 points.
- **Unit tests:** job weights, Rotate order, the predictability cap, the familiarity split, swing from the foot, each free-kick area, the wall and line options, and the forwards-up counters.

### 13.21 Touchline shouts (v1.7, approved by the user 22 Nov)
Short instructions shouted from the touchline during a match. They use the §13.17.1 modifier vocabulary and last **10 match minutes**.
- **Command:** `{ kind: 'shout'; side; shout: ShoutId; issuedAtT }` takes effect at the first step at or after `issuedAtT + 10`. It is faster than other commands (30 s, §13.12) because it's a shout, not a tactics change.
- **One shout active at a time;** a new shout replaces the old one. The same shout again within 15 minutes of its last end has **half the effect** ("They've heard it").
- **In the HUD:** a Shout button and key `Y` open a wheel of the 7 shouts, each with its gain and cost line. The active shout shows as a chip with a 10-minute ring.
- **Presentation:** a touchline cut (§14.11.5) with `Shout` and a voiced line (`club.json`, ≥ 3 per shout, `nameSlot` none).

| Shout | Wording | Gain | Cost |
|---|---|---|---|
| `pushForward` | "Push forward!" | mentality one step up (§13.18.1) | fatigue drain ×1.1; their Counter phases +20% |
| `keepTight` | "Keep it tight!" | mentality one step down; their shot ctx −0.04 | our shot utility −0.2 |
| `getStuckIn` | "Get stuck in!" | as D tackle ctx +0.1 for all | fouls ×1.4; Temperamental players' card chance ×1.3 |
| `calmDown` | "Calm down!" | fouls ×0.7; Temperamental card chance ×0.7 | as D tackle ctx −0.05 |
| `concentrate` | "Concentrate!" | their shot ctx −0.03 and our pass ctx +0.02 | only after 75' or within 5' of conceding; once per half |
| `encourage` | "Well done, keep going!" | `focusBoost` +0.02 for the 10' (§12.8); morale +1 for anyone rated ≥ 7 | when winning by 2+: complacency, so `focusBoost` −0.01 instead |
| `demandMore` | "That's not good enough!" | `focusBoost` +0.03 when drawing or losing; Ambitious and Leader ×1.3 | Relaxed ×0.5; Temperamental: 40% chance it flips to −0.02; when winning: morale −1 for all |

- **AI managers:** `pushForward` when losing at 75'+, `keepTight` when winning by 1 at 80'+, `calmDown` when a player is on a yellow card and the foul rate is high. These are only for clubs rated reputation ≥ 3.
- **Assistant (§15.4):** suggests a shout when its rule fits, for example "Two of ours on yellows, calm them down?". Apply sends the shout.
- **Calibration:** no shout moves the equal-team win rate by more than ±3 points over a match. `pushForward` from 75' when losing raises our late goals ≥ +15% and their late goals ≥ +15%.

### 13.22 Match plans (v1.7, approved by the user 22 Nov)
Automatic changes set before the match, so your plans still work in Instant result and fast-forward.
- **Rules:** up to **4** per match, each `{ when, after, then }`:
  - `when`: Losing · Drawing · Winning by 1 · Winning by 2+ · We go down to 10 · They go down to 10
  - `after`: 0' · 45' · 60' · 70' · 75' · 80' · 85'
  - `then`: switch to Plan A, B or C (§13.18.10), or a shout (§13.21)
- **How they fire:** the engine checks the rules at every step. A rule fires the first time its condition holds after its minute, and then issues the command itself (`issuedAtT` = now), so it is deterministic. Each rule fires at most once per match. If two rules match at the same step, the higher one in the list wins. The others wait until their condition holds again.
- **"Ask me first" (on or off, default on):** in live playback, a firing rule pauses the match with a card: "Losing after 70'. Switch to Plan B?" (Apply or Skip, 6 s, then it applies). In Instant result, or when off, it applies silently and shows in the commentary and HUD feed ("Plan B on, as planned").
- **UI:** a **Match plan** sheet on the Tactics clipboard, with rows like "If [we're losing] after [70'], [switch to Plan B]". Theo proposes a default set (losing at 70' → the most attacking plan; winning by 1 at 80' → the most defensive plan) with Apply.
- **Cost:** no extra cost. The switched-to plan still pays its own familiarity (§13.18.11), so a rule that switches to a plan you never use is weaker than it looks.
- **AI managers** keep their own §13.13 rules.
- **Tests:** firing order, fire-once, determinism (the same seed and rules give the same events), the Instant result path, and the 10-men conditions.

### 13.23 Player traits (v1.7, approved by the user 22 Nov)
Habits that make players play differently. **0–3 per player**, as `Player.traits: TraitId[]`, using the §13.17.1 modifier vocabulary. Traits apply in full (not scaled by role fit). They stack with role and instructions, and don't count toward the 2-instruction cap.

| Trait | Wording | Who can have it (needs) | Effect | Cost |
|---|---|---|---|---|
| `cutsInside` | "Cuts inside from the wing" | wide players (dribbling ≥ 60) | inv ATT `lane→C` 20%; use shot +0.2 from ATT wide | his crosses −40% |
| `shootsFromDistance` | "Shoots from distance" | longShots ≥ 60 | use shot +0.3 outside the box | low-xG shots; possession lost on misses |
| `getsForward` | "Gets forward whenever possible" | DEF and MID (stamina ≥ 60) | inv DEF→ATT 10% | their Counter shot ctx +0.05 down his side |
| `staysBack` | "Stays back at all times" | DEF and DM | inv ATT→DEF 15%; their Counter ctx −0.04 | fewer attacking touches |
| `playsOneTwos` | "Plays one-twos" | passing ≥ 60 | after his short pass, the receiver's return pass to him recv ×1.4, pass ctx +0.05 | dribble use −0.2 |
| `killerBalls` | "Tries killer balls often" | passing ≥ 65 | use through +0.3 | interceptions +15% on his passes |
| `runsWithBall` | "Runs with the ball often" | dribbling ≥ 60 | use dribble +0.25 in MID | ball lost in MID +10% |
| `arrivesLate` | "Arrives late in the box" | CM and AM (offTheBall ≥ 60) | recv ×1.3 on cutbacks and `BOX_CENTRAL` | his DEF cover −10% |
| `holdsUp` | "Holds up the ball" | ST (strength ≥ 65) | as R firstTouch +0.15 on long balls; next step recycle +0.2 | through-ball receptions −20% |
| `comesDeep` | "Comes deep to get the ball" | ST and AM | inv ATT→MID 15% | box receptions −15% |
| `attacksAir` | "Attacks the ball in the air" | heading ≥ 65 | `S_air` +0.1 at corners and crosses | fouls in aerial duels ×1.2 |
| `divesIn` | "Dives into tackles" | any outfield | as D `S_tkl` +0.15 | fouls ×1.4 |

- **World generation (§9):** each eligible trait is rolled once, with chance `0.08 + 0.25 × clamp((keyAttr − needs) / 20, 0, 1)` (cap 3, the best-matching kept). About 55–65% of players get at least one. AI players' traits apply too; they're cheap to simulate.
- **Clashes:**
  - With an instruction that opposes a trait (`shootsFromDistance` + `shootLess`, `getsForward` + `holdPosition`, `divesIn` + `stayOnFeet`), the **instruction wins** and the trait's effect is off.
  - Each week he plays against his trait, morale −1 ("Doesn't like being told"), and a memo after 3 weeks.
  - A trait that matches his role (`cutsInside` on an inside forward) gives +0.05 to that role's gain modifiers.
- **Learning and unlearning (training):** a fourth individual focus type, **Trait** (§12.17.4, §12.18.5). You pick a trait to learn (he must meet its needs) or one to unlearn.
  - Progress per week: `8 + (age ≤ 23 ? 4 : age ≥ 30 ? −3 : 0) + (decisions ≥ 70 ? 2 : 0)`, times the coach factor (§12.17.1). It completes at 100.
  - **Cost:** his development that week × 0.8, the same as position training.
  - An inbox memo on completion: "Mensah now plays one-twos."
- **Where you see them:**
  - trait chips in the player's file (they also explain clashes)
  - in Squad, as a filter
  - in the opponent report ("Their 7 cuts inside, show him outside?")
  - in scouting, only once knowledge ≥ 50 (§12.12)
- **Calibration:** with world-gen traits on, every §13.16 target still holds. No single trait moves an equal-team win rate by more than ±2 points.


---

## 14. Match presentation

### 14.1 Playback
`MatchPlayback` (in `src/ui/screens/Match/playback.ts`, not in core) consumes the event stream and drives a **presentation clock** `pt` (match seconds). Each frame: `pt += realDelta × speedFactor`; events whose `t ≤ pt` are "started"; the choreographer interpolates within the current event using `(pt − event.t)/event.duration`.

Speed modes:
- **Key highlights** (default): only highlight windows (§14.6) play at 1.25×; between windows a time-lapse at 60× (max 3.5 s real time per gap) with the 2D radar overlay.
- **Extended**: highlight windows + every possession that reaches the ATT third, at 1.5×; gaps at 40×.
- **Full**: everything, user picks 2× / 4× / 8× (keys `+`/`−`).
- **Instant result** (key `I`): confirm, then jump to full time (worker `finishInstant`).
Pausing stops `pt`; the HUD and camera orbit still work while paused.

Target: a typical match at Key highlights = **50–80 seconds** real time.

### 14.2 Scene (three.js, `MatchScene.ts`)
- Renderer: `WebGLRenderer({ antialias: quality !== 'Low', powerPreference: 'high-performance' })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, exposure 1.0. Pixel ratio per §21.
- Scale: 1 unit = 1 metre. Pitch centre at origin, x along length, z across width (absolute frame `x` → `x − 52.5`, `y` → `y − 34` on the z axis), y up.
- **Pitch** (`pitch.ts`): plane 115 × 78 (with run-off). Grass from `textures/grass_albedo.webp` (tiled) + mowing stripes drawn in a shader (12 stripes along x, 6% brightness difference) — fallback: canvas-generated texture with noise and stripes. Line markings drawn into a separate 4096×2560 canvas texture (Medium/High) or 2048×1280 (Low) with correct FIFA dimensions (penalty area 16.5 m, six-yard 5.5 m, centre circle r 9.15 m, penalty spot 11 m, corner arcs r 1 m, penalty arc). Polygon offset to avoid z-fighting.
- **Goals**: `models/goal.glb` (fallback: white cylinders posts r 0.06, width 7.32, height 2.44, depth 2.0 net made of a `LineSegments` grid with slight sag). Net ripple on goal: animate vertices of the back net for 1.2 s.
- **Stadium** (`stadium.ts`): four stands from `models/stand_side.glb` and `models/stand_end.glb` (fallback: stepped boxes with seat-colour material in the home club's primary colour, roof plane), four `models/floodlight.glb` corner towers (fallback: cylinder + emissive box), advertising boards ring 1 m high at 4 m from the touchline with a scrolling canvas texture showing fictional sponsors (`content/sponsors` list of 12 invented brand names, e.g. "Halcyon Air", "Brightline Telecom") — never real brands.
- **Crowd** (`crowd.ts`): `InstancedMesh` of low-poly billboard quads (crossed quads) with a 4×4 sprite atlas `textures/crowd_atlas.webp` (fallback: coloured quads), counts per quality (§21). Colours biased to the home club's colours (65%) and the away club's (15% in one corner block). Idle bobbing in the vertex shader; on goals the scoring side's sections jump for 3 s.
- **Lighting**: Night/Evening: a hemisphere light (low), 4 spot/directional lights from the floodlight positions (only one casts shadows), skybox dark gradient with a faint star field. Afternoon: one directional "sun" (casts shadows), hemisphere light, sky gradient. Rain: particle system (instanced lines, 3k Medium / 8k High, none on Low), wet-grass darker tint, ground specular up. Exact colours, intensities and the post-processing chain: §14.10.
- **Players** (`players.ts`): `models/player.glb` (contract §18.3) cloned 22 times with `SkeletonUtils.clone`; kit applied by recolouring materials `Shirt`, `Shorts`, `Socks` (and a generated canvas texture for stripes/hoops/halves/sash/chevron on the `Shirt` material, numbers on the back drawn on the same canvas). Skin tones: 6 presets assigned deterministically per player. Fallback when the GLB is missing: capsule body (shirt colour) + sphere head (skin) + short cylinders for shorts/socks, with procedural leg swing.
- **Ball**: `models/ball.glb` (fallback: sphere r 0.11 with a canvas texture pattern), with a blob shadow decal under it.
- **Name labels**: above-head sprites (number + surname) on hover or for the ball holder only; toggleable.
- **Referee**: one figure in black (`player.glb` recoloured) following the ball at 15–20 m distance. Assistant referees (2) on the touchlines tracking the second-last defender x.
- **Dugouts and managers**: `models/dugout.glb` (fallback: box + bench). `models/manager.glb` (or player model in a coat colour) standing in the technical area; on goals: celebrate/dejected animations.

### 14.3 Choreographer (`choreographer.ts`)
Computes each player's target position every frame from the current event and team shapes; the player then **steers** toward it.
- **Formation anchors** in `formations.ts` (team's own frame, own goal at x = 0, y = 0 = team's left touchline; slots in the order used by `lineup`):
  - 4-4-2: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) LM(48,9) LCM(44,28) RCM(44,40) RM(48,59) LST(70,28) RST(70,40)
  - 4-3-3: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) DM(36,34) LCM(48,22) RCM(48,46) LW(72,10) ST(78,34) RW(72,58)
  - 4-2-3-1: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) LDM(38,27) RDM(38,41) LW(64,10) AM(62,34) RW(64,58) ST(80,34)
  - 3-5-2: GK(5,34) LCB(19,18) CB(17,34) RCB(19,50) LWB(46,6) DM(36,34) LCM(50,24) RCM(50,44) RWB(46,62) LST(72,28) RST(72,40)
  - 5-3-2: GK(5,34) LWB(30,6) LCB(19,20) CB(17,34) RCB(19,48) RWB(30,62) LCM(44,22) CM(42,34) RCM(44,46) LST(70,28) RST(70,40)
  - 4-1-4-1: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) DM(34,34) LM(54,9) LCM(50,26) RCM(50,42) RM(54,59) ST(78,34)
  - 3-4-3: GK(5,34) LCB(19,18) CB(17,34) RCB(19,50) LM(48,8) LCM(44,27) RCM(44,41) RM(48,60) LW(72,12) ST(78,34) RW(72,56)
  Each slot also stores its `Position` (for ratings and involvement rows) — e.g. 4-4-2 slot 1 = LB.
- **Team shape transform** each frame (in the team's own frame, ball at `(bx, by)`):
  - In possession: `x = anchor.x × 0.85 + bx × 0.35 + 6 × (mentality Attacking ? 1 : mentality Defensive ? −0.5 : 0)`; width scale 1.1 (Wide 1.2, Narrow 0.95) around y = 34.
  - Out of possession: `x = anchor.x × 0.7 + bx × 0.3`, clamped so the back line x ≥ lineBase (Deep 12, Normal 18, High 28) − 6 and ≤ lineBase + 18; width scale 0.8 (Narrow 0.7); shift y toward `by` by 25%.
  - GK: x = clamp(bx × 0.12, 2, 16) in possession; on the goal line ±0.5 for shots; y follows ball y at 30%.
- **Event roles**: the actor is placed at the ball; the receiver runs to `event.to` arriving at `t + duration × 0.85`; the primary defender (`opponentId`) moves toward the actor/receiver line; for crosses, 3–4 attackers make runs into the box (near post, far post, penalty spot, edge) and 4 defenders mark them; for corners, the full set-piece setup (all CBs and STs up; defenders zonal on the six-yard line; one player on the near post); for free kicks, a wall of 3–5 defenders at 9.15 m; for penalties, everyone outside the box arc; for goal kicks, GK places the ball at the six-yard line; for kick-offs, both teams in their halves.
- **Steering**: max speed `5.5 + 3.5 × pace/99` m/s (sprinting only when > 70% of max), acceleration 6 m/s², arrival radius 0.6 m, separation force between players within 1.2 m. Facing: velocity direction, or toward the ball when slow.
- **Animation state** from speed: idle < 0.4, jog < 3.0, run < 6.0, sprint above; one-shot clips at event moments (Pass, Shoot, Header, Tackle, GK dive left/right by target.y sign, GK catch, Throw for throw-ins, Celebrate for the scorer and 3 nearest teammates, Dejected for the conceding GK). Cross-fade 0.15 s.
- **Ball flight**: ground passes linear with ease-out over `duration × 0.5`; lofted (long, cross, switch, clearance) parabolic with apex 4–12 m scaled by distance; shots: fast straight/curved path to `target` over 0.4–0.8 s; dribble: ball at the carrier's feet offset 0.7 m forward, small bounces. After a goal the ball rests in the net.

### 14.4 Cameras (`cameras.ts`)
- **Broadcast** (default): positioned at (x = ball.x × 0.85, y = 22, z = −62) looking at the ball with damping (0.08), FOV 32–40 zooming in when the ball is in a box.
- **Tactical**: high, top-down-ish (y = 75, pitched 65°), whole pitch visible.
- **Behind goal**: for set pieces and shots, behind the attacking goal at y = 6.
- **Player cam**: follows the ball holder at 12 m behind, 5 m up.
- **Free orbit**: mouse drag (left drag orbit, right drag pan, wheel zoom; limits: min distance 8, max 140, polar angle ≤ 85° so the camera never goes under the pitch). Use `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` (it ships inside the `three` package, so it is allowed).
- `C` cycles Broadcast → Tactical → Player → Free. Goal replays use their own cameras (§14.7).

### 14.5 HUD and overlays
See §11.16. The scoreboard bug animates the score digit on goals (scale 1 → 1.4 → 1 over 600 ms). A "GOAL" banner in the scoring club's colours slides in for 2.5 s (disabled with reduce motion → simple fade).

### 14.6 Highlight selection (`core/match/highlights.ts`)
Highlight windows (computed on the event stream as it arrives):
- Every `GOAL`: from 25 sim-seconds before the shot to 6 seconds after.
- Every `SHOT` with xG_ref ≥ 0.08 or on target: from 15 s before to 3 s after.
- `PENALTY_AWARDED`, `RED`, `INJURY`, the first `YELLOW` of each player, `POST`: from 8 s before to 4 s after.
- `KICKOFF` of each half: 6 s. `HALF_TIME`/`FULL_TIME`: whistle moment.
Merge overlapping windows. Extended adds every possession that enters the ATT third (from entry − 6 s until it ends).

### 14.7 Goal replays
After each goal (Key/Extended: always; Full: if the setting is on): replay the last 10 sim seconds before the goal from a different camera (behind-goal low or side close), at 0.6× speed for the final 3 s, with a "REPLAY" corner badge and a letterbox. `R` replays the last goal on demand. Skippable with Space/click.

### 14.8 Performance rules for the scene
- One `requestAnimationFrame` loop. No allocation per frame in hot paths (reuse vectors).
- Only one shadow-casting light; shadow map sizes per quality; static objects `matrixAutoUpdate = false`.
- Dispose all geometries, materials, textures and the renderer when leaving the match (verify no memory growth across 5 consecutive matches).
- Pause rendering when the tab is hidden.
- Load models with `GLTFLoader` + `MeshoptDecoder` (from the three package: `three/examples/jsm/libs/meshopt_decoder.module.js`). Load once, cache, clone per match.

### 14.9 2D fallback (`topdown2d.ts`)
If WebGL2 is not available or quality is "2D" (hidden option), render the same choreography on a `<canvas>` 2D top-down pitch: circles with shirt colours and numbers, the ball, simple trails. All HUD features still work.

### 14.10 Realism pass (`src/render3d/post.ts`, `environment.ts`, `beams.ts`)
Goal: a floodlit stadium that reads as real on a broadcast shot and up close, inside the §21.1 frame budget. Most of the realism comes from light and materials, not polygon counts. Every item below is switched by the quality preset (§21.2) in `quality.ts`, and every number goes in `src/config/balance.ts` under `render.*` (values in `docs/design/ART-DIRECTION.md` §3).
Post-processing and the environment pieces come from the `three` package (`three/examples/jsm/postprocessing/*`, `three/examples/jsm/objects/*`), like `OrbitControls`, so they are allowed. No other post-processing library.

**Post-processing chain** (Medium and High only; Low renders straight to the canvas with the renderer's own tone mapping):
1. `EffectComposer` with a `HalfFloatType` render target, MSAA `samples: 4` (WebGL2). Renderer `antialias: false` when the composer is on (the target does the antialiasing).
2. `RenderPass`.
3. High only: `GTAOPass` at half resolution (soft contact shadows where boots meet grass, under the stands' roofs, inside the goal frame).
4. `UnrealBloomPass` at half resolution: threshold 1.0 (only floodlight lamps, the scoreboard and the brightest highlights bloom), strength 0.55, radius 0.35. Never bloom the UI or whole kits; if kits glow, the threshold is too low.
5. `GradePass`: one small custom `ShaderPass` with lift/gamma/gain, saturation, contrast and a vignette (values in ART-DIRECTION §3.4). Runs in linear space before output.
6. `OutputPass` (ACES Filmic tone mapping + sRGB). When the composer is on, set `renderer.toneMapping = NoToneMapping` so tone mapping happens once.
Resize the composer and every pass on window resize. Dispose all render targets on leaving the match.

**Environment lighting** (`environment.ts`, all presets): build one environment map per match with `PMREMGenerator.fromScene` from a tiny scene: a gradient sky sphere (ART-DIRECTION colours for the match's time slot) plus four emissive quads where the floodlight banks are, and a dark ground disc. Assign it as `scene.environment` (never as the visible background). Dispose it on leaving the match. This is what makes kits, boots, the ball and metal look lit by the stadium instead of flat.

**Haze**: `FogExp2` in the sky's horizon colour, density per time slot (ART-DIRECTION §3.2). Exclude the HUD. The far stands should be slightly softer than the near ones.

**Floodlight beams** (`beams.ts`, Medium and High, night/evening only): one open cone mesh per tower from the lamp bank toward the pitch, length 85 m, end radius 16 m. Custom `ShaderMaterial`: additive blending, `depthWrite: false`, opacity fades along the cone's length and toward its silhouette edges (view-angle fresnel), base opacity 0.05 dry, 0.09 in rain. Plus one camera-facing glare sprite per lamp bank that bloom picks up. The beams must be subtle: on the broadcast camera you should only just see them.

**Pitch material**: `MeshStandardMaterial` with `grass_albedo.webp` + `grass_normal.webp` (normal scale 0.6), roughness 0.92 dry, texture anisotropy `min(8, renderer.capabilities.getMaxAnisotropy())` so the grass stays sharp at the broadcast angle. Mowing stripes stay in the shader (§14.2). Rain: multiply albedo by 0.82, roughness to 0.55, `envMapIntensity` from 0.5 to 1.1, so the floodlights streak across the wet grass.

**Model materials**: keep the GLB's PBR materials. Kit cloth roughness 0.7, skin 0.55, boots 0.35, ball 0.4, metalness 0 except goal posts' fittings and floodlight frames (0.8). If a GLB material has an `aoMap` or `lightMap` (baked by Claude for stands and props), use it; these are static objects, so baked light is free at runtime.

**Contact shadows**: every player and the ball keep a soft blob decal under them on all presets (on Medium/High it sits under the real shadow and grounds the feet).

**Budget guard**: if Medium misses the §21.1 frame budget on the target laptop, drop items in this order and record it in `DECISIONS.md`: bloom to quarter resolution → beams off → MSAA samples 2 → composer off. Never drop the environment map or the haze; they cost almost nothing.

### 14.11 People and painted faces (v1.7, `src/club3d/people.ts`, `behaviours.ts`, `faces.ts`, `mouth.ts`)

#### 14.11.1 One rig for everyone
The coach (`manager.glb`), players (`player.glb`), and reporters, directors, the owner and Theo (`person.glb`) share one skeleton and one clip name list (§18.3), so any clip plays on anyone. Crossfade 0.25 s between clips. Each person gets a random clip time offset and a 0.95–1.05 playback rate so that groups never move in sync. In-place locomotion; paths move the root.

#### 14.11.2 Team-talk reactions (dressing room)
Players sit on the benches around the room (`SitIdle`), facing the middle. The scene follows §11.25.5. After a talk, each player reacts according to **his real §12.8 result**, starting 0.1–0.6 s after the line ends (random per player):

| His morale change | Clip | Face mood |
|---|---|---|
| ≥ +4 | `FistPump` (standing up) or `SitClap` | happy |
| +1 to +3 | `SitNod` | happy |
| 0 | `Listen` | neutral |
| −1 to −3 | `SitHeadDown` | worried |
| ≤ −4, or a Temperamental sign flip | `ArmsFolded`, eyes on the coach | angry |

The briefing: players `Listen`, the 2–3 players named in key battles `SitNod` when named, and the coach `Point`s at the board. Reactions are presentation only; they never change a number.

#### 14.11.3 Players at the door (conversations, §12.9)
- When a §12.9 conversation triggers, there is a knock (`sfx/door_knock.mp3`) on the coach's next office visit. The player walks in and sits across the desk, and the conversation screen opens on the desk. His opening uses the type's mood: `playing_time` worried or angry, `contract` neutral, `unhappy` angry, `praise` happy.
- After the reply, his face follows the reply's morale effect (+ happy, 0 neutral, − angry). If the effect is negative he leaves with `ArmsFolded`, otherwise with a `Nod`.
- "Talk to player" from Squad or Profile plays the same scene by his locker in the dressing room.
- The inbox item stays, as the record and for players who turn walks off.

#### 14.11.4 Other rooms
- **Theo** (`person.glb`, tracksuit tint, clipboard, his own face atlas): walks into the office with the week tips (§15.3). Sits with the coach at the whiteboard on Tactics and gives the opponent report (§15.2); he `Point`s at the board when an Apply suggestion is shown. Stands beside the coach for team talks and gives the §15.5 half-time analysis.
- **Training ground:** 10–12 players do a drill matching the week's team focus (§12.3): a rondo for passing, a shooting drill, fitness runs, a set-piece walk-through. Movement reuses the §14.3 steering and the match clips. At most 12 animated people.
- **Press room:** 6–8 seated reporters `Write` or idle. The journalist asking the question leans in or `RaiseHand`s and speaks (`vo/press/`). Camera flashes (white point lights, 80 ms) fire with `sfx/camera_shutter.mp3` after the coach answers.
- **Boardroom:** the owner speaks, and the directors `Listen` and `Nod`. Faces follow board confidence: ≥ 60 happy, 30–59 neutral, < 30 worried, sacking angry.

#### 14.11.5 The coach on the touchline (match, `render3d/touchline.ts`)
- The M4 dugout area gets the coach, Theo, and at most 5 substitutes on view.
- **Touchline cuts (about 2 s, broadcast-style, from a fixed touchline camera):**
  - our goal: coach `Celebrate`, bench jumps up
  - goal against: coach `HeadInHands`, bench still
  - our red card and big misses: coach `Shout`
  - our substitution: coach `Point`, the sub jogs to the line
  - an assistant tip firing (§15.4): Theo leans in to whisper; the HUD card still appears with Apply
- Cuts follow playback: Key highlights shows all of them, Full shows only goal cuts, Instant shows none. A cut plays after the goal replay, never instead of it, and never during live play near either box.
- Bench people animate only while a cut is on screen; otherwise they are frozen at the low LOD.

#### 14.11.6 Painted face layers (`faces.ts`)
- Each speaking character's head carries a separate mesh `Face` (§18.6): a thin patch over the face, parented to the `Head` bone, with its own UVs. Its material samples a **face atlas** (§18.6) and draws three cells: eyes, brows and mouth. A small shader crossfades the old cell into the new one: mouth 60 ms, brows and expressions 150 ms. The features are dark and multiplied by the skin tone, so they sit on the skin rather than on top of it.
- **Moods:** neutral, happy, angry, worried, shocked. Each mood is a preset of brows and the resting mouth.
- **Always running:** a blink every 2–6 s (random), a 3–5° head tilt while listening, and eyes turning towards whoever is speaking (head bone yaw, ±25° max).
- **Who gets faces:** the person speaking and the person being spoken to animate their face. Everyone else shows a static neutral face and uses body language only.

#### 14.11.7 The mouth (`mouth.ts`)
- **With audio:** an `AnalyserNode` on the voice's source reads its RMS loudness every frame and maps it to closed / small / open / wide. Use hysteresis (thresholds in `balance.ts → faces.*`) and a 70 ms minimum hold so it never flickers. This is not lip-sync and must not try to be.
- **Without audio** (a missing file, or voice off in settings): the mouth opens and closes to the caption's rhythm, at about 5 syllables per second with pauses at commas (150 ms) and full stops (300 ms).
- `TalkGesture` plays on the speaker every 3–5 s of speech.

#### 14.11.8 Cameras for people
Mid-distance shots only: waist-up at the closest, and faces never fill the screen. This is the main defence against uncanny faces (ART-DIRECTION §1).

---

## 15. The assistant coach

Name: **Theo Vance**, assistant manager (fictional). Portrait `images/people/assistant.webp`; voice lines in `audio/vo/assistant/` (§17).

### 15.1 Advice engine (`core/people/assistant.ts`)
Pure function `advise(context): Advice[]` where `Advice = { id, priority: 1–3, text, reason, apply?: AdviceAction }` and `AdviceAction` is one of: set instructions (partial), change formation, substitute (out, in), set training, rest player. Text and reasons come from `content/assistant.json` templates with `{player}`, `{lane}`, `{opponent}` tokens.

### 15.2 Pre-match rules (opponent report)
Compute from the opponent's sheet and our squad:
- Opponent pressing High and our back line pace avg ≥ 65 → "Play out quickly: Passing Mixed, Tempo Fast."
- Opponent line High and our best forward pace ≥ 75 → "Go in behind: Passing Direct, Focus toward that forward's lane."
- Opponent's weakest defender (lowest OVR among their back line) on side X → "Attack their {side}: Focus {lane}."
- Opponent avg OVR ≥ ours + 4 → "Stay compact: Mentality Defensive, Line Deep, Pressing Mid."
- Opponent avg OVR ≤ ours − 4 → "Take the game to them: Mentality Attacking."
- Our CBs heading avg ≥ 72 and their crosses-heavy (Width Wide) → reassurance line, no change.
Pick at most 3, highest priority first; "Apply all" applies them together.

### 15.3 Week tips (Hub and inbox)
One tip per week, first matching rule: a player with fatigue > 80 ("Rest {player}"), formation familiarity < 50 for the current formation ("Train Tactical"), ≥ 3 players condition < 70 before a match ("Light training this week"), an unhappy Star ("Talk to {player}"), a prospect with potential ≥ 78 and < 2 apps in the last 6 ("Give {player} minutes"), else a positive note.

### 15.4 In-match rules (evaluated every 5 match minutes from the last 15 minutes of events)
| Trigger | Advice (with Apply) |
|---|---|
| ≥ 50% of opponent's ATT-third entries come through one of our flanks and they had ≥ 3 shots from it | "They're getting joy down our {lane}. Tell {fullback} to stay back." → that FB role `fb_defensive`; if already, Width Narrow |
| Our pressing High and our avg condition < 62 | "The lads are running out of legs. Drop the press." → Pressing Mid |
| Our crosses ≥ 6 with success < 20% and their CB heading avg > our ST heading avg + 5 | "We're losing every header. Keep it on the floor." → Width Narrow, Passing Short |
| Opponent line High and we had ≥ 2 offsides | "Their line is high; time the runs, go direct." → Passing Direct |
| A player with condition < 58 and subs left | "{player} is out on his feet." → sub with best like-for-like bench player |
| A player on a yellow committed ≥ 2 more fouls | "{player} is one tackle from a red." → sub |
| Losing at 70'+ | "We need a goal. Go for it." → Mentality Attacking, Tempo Fast |
| Winning by 1 at 80'+ | "See it out." → Mentality Defensive, Tempo Slow |
| Our possession < 35% over the window and Passing Direct | "We keep giving it away. Calm it down." → Passing Short, Tempo Slow |
At most one new advice per 5 minutes; max 6 per match; do not repeat an advice id within 20 minutes. Each advice plays a short voiced stinger (§17.4) and shows in the assistant drawer with Apply / Dismiss.

### 15.5 Half-time and post-match analysis
- Half-time: 2–3 bullets from: shots/xG comparison ("We've created 0.4 xG to their 1.3"), the most dangerous opposing player (most involvement in shots), our worst-rated starter (suggest a sub), and one rule from §15.4 if it applies.
- Post-match: one paragraph from templates: result vs expectation, best player, a stat that decided the match (biggest gap among shots on target, xG, possession, cards), what to work on (maps to a training focus with an Apply button for next week).

---

## 16. Content files

All content is JSON in `src/content/`, with stable string ids (`snake_case`). Text uses tokens in `{curly}` braces: `{player}`, `{player2}`, `{team}`, `{opponent}`, `{score}`, `{minute}`, `{manager}`, `{stadium}`, `{lane}`. A validation test checks every file: ids unique, tokens from the allowed list, no empty strings, minimum counts met.

### 16.1 Commentary (`commentary.json`)
Two voices: **PBP** (play-by-play, "Callum") and **COL** (colour/co-commentator, "Nadia"). Structure:
```json
{ "lines": [ { "id": "goal_generic_01", "key": "GOAL", "voice": "PBP", "text": "{player}... and it's in! What a finish!", "nameSlot": "start", "intensity": 3 } ] }
```
- `nameSlot`: `"start"` (the name is spoken first, then the line audio), `"none"`. Lines with a name token anywhere other than the start are not allowed (audio is chained: `names/{playerId}.mp3` + `commentary/{id}.mp3`). Captions always show the full text.
- Keys and minimum line counts: KICKOFF 6, PASS_RUN (general flow) 20, LONG_BALL 6, DRIBBLE 8, TACKLE 8, INTERCEPTION 6, CROSS 8, HEADER 6, THROUGH_BALL 6, OFFSIDE 6, SHOT_SAVE 10, SHOT_MISS 10, SHOT_BLOCK 6, POST 5, BIG_CHANCE_MISS 6, GOAL 14, GOAL_HEADER 5, GOAL_LONG_RANGE 5, GOAL_PENALTY 4, PENALTY_AWARDED 5, PENALTY_SAVED 4, FREE_KICK 5, CORNER 6, FOUL 6, YELLOW 6, RED 5, INJURY 4, SUB 5, HALF_TIME 6, FULL_TIME_WIN_HOME 4, FULL_TIME_WIN_AWAY 4, FULL_TIME_DRAW 4, ADDED_TIME 4, COLOUR_ANALYSIS (COL generic insight lines: "That's the third time they've gone down that flank") 20, DERBY_INTRO 4, LATE_DRAMA 5. Total ≥ 250 lines.
- Selection: per event type pick a line not used in the last 30 lines; at most 1 PBP line per 6 sim seconds outside importance ≥ 2; COL lines follow 25% of importance ≥ 2 events after a 1.2 s gap.

### 16.2 Press (`press.json`)
```json
{ "questions": [ { "id": "pre_derby_01", "context": ["PRE_DERBY"], "text": "Big one against {opponent}. What does this derby mean to you?", "voText": "Big one this week. What does this derby mean to you?",
  "answers": [ { "id": "a", "tone": "Confident", "text": "We're going there to win. Simple.", "effects": { "fans": 3, "board": 0, "squadMorale": 2, "risk": "If we lose, fans −3 extra" } }, ... ] } ] }
```
Contexts: PRE_DERBY, POST_WIN, POST_BIG_WIN, POST_DRAW, POST_LOSS, POST_BIG_LOSS, POST_UPSET_WIN (beat a team with rep ≥ ours + 2), STREAK_WIN, STREAK_LOSS, PLAYER_PRAISE (MOTM rating ≥ 8.5), PLAYER_CRITICISM (a starter rated ≤ 5.5), TRANSFER_RUMOUR, OPENING_DAY. At least 4 questions per context (≥ 52 total), 3 answers each with effects on fans (−5..+5), board (−3..+3), squad morale (−4..+4) or one player's morale (−8..+8), plus optional conditional effects resolved on the next match (e.g. Confident → if lost next match, fans −3). `voText` has no tokens (voice audio uses it). **v1.7:** each answer also gets a `voText` (no tokens) for the coach's voice; its audio is `vo/coach/press_{questionId}_{answerId}.mp3`.
The journalist: 3 fictional journalists with names, outlets and portraits (`images/people/journalist_{1..3}.webp`), e.g. "Priya Natarajan, Meridian Sport", "Joe Kettering, The Saltmere Echo", "Femi Adebayo-Clarke, Coastline Radio".

### 16.3 Team talks (`talks.json`)
For each context × tone: 3 alternative manager lines (what the manager says, shown in a speech bubble) and 4 player reaction lines (positive, neutral, negative, mixed). 9 contexts × 6 tones × 3 = 162 manager lines minimum.
**v1.7 (voiced coach):** every manager line has an `id` and a `voText` with no tokens, as in §16.2 (`{ "id": "ht_lose_demand_02", "text": "...", "voText": "..." }`). If `text` has no tokens, `voText` may be left out and `text` is used. The half-time Demand and Disappointment lines are written to be shouted.
**The coach calls players by name (v1.7):** a coach line may have `"nameSlot": "start"` or `"end"` with exactly one `{player}` token at the very start or very end of `text` (`"{player}, I need more from you."`, `"That's the standard. Well done, {player}."`). The audio is chained like commentary (§16.1): `vo/coach_names/{playerId}.mp3` + the line, or the line + the name, with a 120 ms gap. The `voText` leaves the name out. The same rule applies to coach lines in §16.4 and §16.9. Lines that name a player are spoken to one player: the reaction (§14.11.2) and the face gaze go to him. In team talks, at least 1 of the 3 alternatives per context × tone names a player (the player is the context's natural pick: the MOTM, the worst rated, the captain, or the scorer).

### 16.4 Conversations (`conversations.json`)
Per §12.9: types `playing_time`, `contract`, `unhappy`, `praise`, each with ≥ 3 openings and 3 reply options with effects and follow-up lines. **v1.7:** the coach's reply options and the players' lines each get an `id` and a token-free `voText` (players are voiced if credits allow, §17.4).

### 16.5 Assistant (`assistant.json`)
Templates for §15.2–15.5: each rule id with ≥ 2 text variants and a reason line. Plus 30 generic remarks for idle moments in the Hub ("The squad looked sharp in training today").

### 16.6 News and back pages (`news.json`)
- **Match headlines** by result type (big win, win, late winner, draw, comeback, loss, heavy loss, derby win/loss, upset, hat-trick, clean sheet streak, red card story): ≥ 4 headlines each, punchy tabloid style with tokens ("{team} BLOW {opponent} AWAY", "LATE {player} STRIKE SINKS {opponent}"). Sub-headline and 2-sentence body templates.
- **Back page image**: `images/news/{clubId}_{scenario}.webp` with scenarios `celebration`, `dejection`, `manager`, `crowd` (40 images); fallback: a styled card with the crest and a halftone pattern.
- **Transfer news**, **injury news**, **board news**, **fan reactions** (short quotes with fictional fan names and towns), **inbox templates** (§12.11). ≥ 120 templates total.

### 16.7 Injuries (`injuries.json`)
≥ 20 kinds: `{ "id": "hamstring_strain", "name": "Hamstring strain", "severity": ["Minor","Moderate"] }`.

### 16.8 Writing guidelines (all content)
Tone: British/international football broadcast English, energetic but not cringe; no profanity; no real people, clubs or brands; vary sentence length; avoid repeated phrases; each line ≤ 120 characters (commentary ≤ 90).

### 16.9 Club life (`club.json`, v1.7)
Lines for §11.25 and §14.11, each with `id`, `speaker` (`coach`, `owner`, `director`, `assistant`), `text`, an optional `voText` (no tokens), and `mood`:
- **owner**: welcome (Board Meeting) ≥ 3, board review by band (happy, neutral, worried) ≥ 3 each, budget request granted or refused ≥ 2 each, sacking ≥ 3.
- **coach**: briefing lines by plan feature (mentality, press, key battle, set pieces, width) ≥ 3 each; short walk-in lines ("Right, lads.", "Sit down, son.") ≥ 8.
- **assistant**: knock-and-enter lines ≥ 4, whiteboard lines while showing an Apply suggestion ≥ 6, touchline whispers ≥ 6.

---

## 17. Audio (`src/audio/`)

### 17.1 Engine
Web Audio API. One `AudioContext` created on the first user gesture. Buses: master → [music, crowd, commentary, sfx], each a GainNode wired to settings. Decode buffers once and cache. Missing files (not in the manifest) are skipped silently.

### 17.2 Music
`music/title_theme.mp3` (title), `music/menu_loop.mp3` (all management screens, −6 dB), stop during matches; `music/season_end.mp3` on the season-end sequence. Crossfades 1.5 s.

### 17.3 Crowd and SFX (match)
- Loops: `crowd/ambience_calm.mp3`, `crowd/ambience_tense.mp3` crossfaded by `danger` = 0 (ball in own DEF third) → 1 (ball in the opponent box), smoothed over 1.5 s. Home-side bias: the crowd swells (+3 dB) on home attacks.
- One-shots: `crowd/goal_roar.mp3` (home goals full, away goals at −8 dB plus `crowd/away_cheer.mp3`), `crowd/groan_miss.mp3`, `crowd/ooh_save.mp3`, `crowd/boo_foul.mp3`, `crowd/chant_{1..4}.mp3` (random every 60–120 s), `sfx/whistle_short.mp3`, `sfx/whistle_long.mp3` (HT/FT ×3 pattern for FT), `sfx/kick_{1..4}.mp3` (pass/shot, shot louder), `sfx/net.mp3`, `sfx/post.mp3`, `sfx/header.mp3`, `sfx/ui_click.mp3`, `sfx/ui_confirm.mp3`, `sfx/ui_error.mp3`, `sfx/notification.mp3`, `sfx/camera_shutter.mp3` (press conference). UI motion sounds (§19.7): `sfx/ui_whoosh.mp3`, `sfx/ui_cut.mp3`, `sfx/ui_tick.mp3`, `sfx/ui_clack.mp3`, `sfx/ui_paper.mp3`, `sfx/ui_stamp.mp3`.
- Spatial: kicks panned by ball x relative to the camera (StereoPannerNode, ±0.6).

### 17.4 Voice
- Commentary queue with priorities (importance). If a line is still playing and a higher-importance event arrives, fade the current line out over 150 ms. Drop lines older than 3 sim seconds at the moment they would start. During time-lapse gaps, no PBP except goals in other games ("Meanwhile, at Furnace Park…" lines `OTHER_GOAL`, 6 lines, nameSlot none, club names spoken via `vo/clubs/{clubId}.mp3` appended after).
- Duck crowd by −6 dB and music by −10 dB while voice plays.
- Assistant stingers: `vo/assistant/stinger_{1..6}.mp3` ("Gaffer!", "Boss, a word.", …), and voiced fixed lines for greetings, half-time openers, post-match openers (ids in `assistant.json` with `"voiced": true`).
- Press: `vo/press/{questionId}.mp3` from `voText`.
- **v1.7, the coach is voiced:** `vo/coach/{lineId}.mp3` for team talks (§16.3), press answers (`press_{questionId}_{answerId}`), conversation replies (§16.4) and `club.json` coach lines. `vo/owner/{lineId}.mp3` covers the owner and directors, and `vo/assistant/{lineId}.mp3` covers Theo's `club.json` lines. `vo/players/{lineId}.mp3` (conversation lines, optional) uses 3 player voices, chosen by player id. `vo/coach_names/{playerId}.mp3` is each player's shirt name in the coach's voice (all 280, so it still works after transfers), chained before or after a line by `nameSlot` (§16.3). If a name file is missing, play the line alone; the caption still shows the name. Captions always show. A missing file falls back to the caption-rhythm mouth (§14.11.7), so every voice set is optional for the build.
- Each voice file passes through an `AnalyserNode` that feeds the speaker's mouth (§14.11.7). Voice ducking as above.

### 17.5 Room ambience (`ambience.ts`, v1.7)
One loop per room on the effects bus, crossfaded over 0.6 s as the coach walks. One-shots play on events. Loops sit at −18 dB against UI sounds (§19.7), so the UI still reads clearly.

| Room | Loop `ambience/{room}.mp3` | One-shots `sfx/` |
|---|---|---|
| exterior | Wind, distant traffic, a far-off gull | `car_door.mp3` |
| corridor | Building hum | `footstep_{1..4}.mp3` (synced to `Walk`), `door_open.mp3`, `door_close.mp3` |
| office | Clock tick; rain on the window in wet weeks (`ambience/office_rain.mp3`) | `phone_ring.mp3` (board messages), `door_knock.mp3`, `ui_paper.mp3` |
| boardroom | Quiet room tone, a ticking clock | `chair_creak.mp3` |
| dressing | Low chatter, a dripping shower | `studs_tile_{1..3}.mp3`, `locker_bang.mp3` |
| tunnel | Crowd heard through concrete, rising | `studs_concrete_{1..3}.mp3` |
| training | Wind, distant shouts, ball strikes | `whistle_short.mp3` (existing), `cone_hit.mp3` |
| press | Murmur, chairs | `camera_shutter.mp3` (existing), `mic_tap.mp3` |

---

## 18. Asset contract

Claude produces assets in parallel with your work and drops them into `public/assets/`, then regenerates `public/asset-manifest.json`. You MUST build against this contract and the fallbacks so the game is always complete without any asset.

### 18.1 Registry (`src/assets/registry.ts`)
- On boot, fetch `./asset-manifest.json` (local file, part of the build): `{ "version": 1, "files": { "models/player.glb": { "bytes": 1234567 }, ... } }`.
- `assetUrl(path): string | null` returns `./assets/<path>` if listed, else `null`. Every consumer handles `null` with its fallback. Never request an unlisted file (no 404s in the console).
- M0 creates `public/asset-manifest.json` as `{ "version": 1, "files": {} }`.

### 18.2 Paths and formats
| Path | Format | Notes |
|---|---|---|
| `models/player.glb` | glTF binary, meshopt-compressed | contract §18.3 |
| `models/goal.glb`, `models/ball.glb`, `models/stand_side.glb`, `models/stand_end.glb`, `models/floodlight.glb`, `models/dugout.glb`, `models/manager.glb`, `models/corner_flag.glb` | GLB | origin at ground centre, metres, +Z forward |
| `models/stand_side_brick.glb`, `models/stand_end_brick.glb`, `models/stand_side_timber.glb`, `models/stand_end_timber.glb` | GLB, optional | stand style by home club reputation: 5–4 modern (`stand_side/end.glb`), 3 brick, 2 timber. If a style's file is not in the manifest, use the modern one; if that is missing too, the boxes fallback (§14.2) |
| `textures/grass_albedo.webp` (1024²), `textures/grass_normal.webp` (1024², OpenGL convention, linear), `textures/crowd_atlas.webp` (2048², 4×4 cells), `textures/ad_boards.webp` (2048×128) | WebP | |
| `images/portraits/{playerId}.webp` | 256×256 WebP, greyscale halftone | 280 files; tinted per club at runtime (§18.5) |
| `images/crests/{clubId}.webp` | 512×512 WebP, transparent | 10 files |
| `images/people/{assistant,chairman_{clubId},journalist_{1..3},manager_{clubId}}.webp` | 512×512 WebP, greyscale halftone | tinted at runtime (§18.5): assistant in the user's club, chairman/manager in their club, journalists in their outlet's ink (ART-DIRECTION §5) |
| `images/news/{clubId}_{scenario}.webp` | 1024×576 WebP | 40 files |
| `images/stadium/{clubId}.webp` | 1280×720 WebP | 10 files |
| `images/ui/title_bg.webp`, `images/ui/board_room.webp`, `images/ui/press_room.webp` | 1920×1080 WebP | |
| `images/ui/logo.webp` | transparent WebP | game logo when the name is final |
| `audio/music/*.mp3`, `audio/crowd/*.mp3`, `audio/sfx/*.mp3` | MP3 128–192 kbps | names in §17 |
| `audio/vo/commentary/{lineId}.mp3`, `audio/vo/names/{playerId}.mp3`, `audio/vo/clubs/{clubId}.mp3`, `audio/vo/assistant/{lineId}.mp3`, `audio/vo/press/{questionId}.mp3` | MP3 64–96 kbps mono | generated from your content files; ids MUST match |
| `audio/vo/coach/{lineId}.mp3`, `audio/vo/coach_names/{playerId}.mp3`, `audio/vo/owner/{lineId}.mp3`, `audio/vo/players/{lineId}.mp3` (v1.7) | MP3 64–96 kbps mono | §17.4; every one optional |
| `audio/ambience/{room}.mp3` (v1.7) | MP3 128 kbps, seamless loop, 30–60 s | §17.5 |
| `models/person.glb` (v1.7) | GLB | contract §18.6 |
| `models/club/{prop}.glb` (v1.7) | GLB, origin at floor centre, metres, +Z forward | desk, desk_chair, lamp, phone, tv, whiteboard, locker, bench, board_table, board_chair, frame, mic_table, press_chair, tripod, cone, mannequin, dugout_bench. Baked `aoMap` allowed (§14.10). Missing → coloured boxes |
| `textures/faces/{coach,player,person,assistant,owner}.webp` (v1.7) | 1024² WebP, transparent | face atlases, §18.6 |
| `images/club/{exterior,window_office,window_boardroom,training_bg,press_backdrop}.webp` (v1.7) | 1920×1080 WebP | backdrops seen through windows or behind sets; no readable text (ART-DIRECTION §2) |

### 18.3 Player model contract (`models/player.glb`)
- Humanoid, 1.80 m tall, origin at the feet, facing +Z, ≤ 12,000 triangles, one skinned mesh (or a few sharing one skeleton), ≤ 60 bones.
- Materials named exactly: `Shirt`, `Shorts`, `Socks`, `Skin`, `Hair`, `Boots`. Base colours white/neutral so tinting works (shirt texture slot used for patterns/numbers).
- Animation clips named exactly: `Idle`, `Jog`, `Run`, `Sprint`, `Pass`, `Shoot`, `Header`, `Tackle`, `Throw`, `Celebrate`, `Dejected`, `GK_Idle`, `GK_DiveLeft`, `GK_DiveRight`, `GK_Catch`. Missing clips fall back in this order: Sprint→Run→Jog→Idle; Shoot→Pass; Header→Idle; Tackle→Run; Throw→Idle; Celebrate→Idle; GK_*→Idle.
- In-place locomotion (no root motion).
- `models/manager.glb` follows the same rules (origin at the feet, +Z, ≤ 12,000 triangles, in place), 1.78 m tall, materials `Coat`, `Shirt`, `Tie`, `Trousers`, `Shoes`, `Skin`, `Hair` (`Tie` is tinted the club's primary colour, `Coat` stays as delivered), clips `Idle`, `Point`, `Clap`, `Celebrate`, `Dejected` (missing clips → `Idle`).
- **v1.7: one shared skeleton.** `player.glb`, `manager.glb` and `person.glb` use the same bone names and rest pose, so any clip plays on any of them.
  - **Clips added to all three:** `Walk`, `DoorOpen`, `Sit`, `SitIdle`, `SitNod`, `SitHeadDown`, `SitClap`, `Listen`, `Nod`, `TalkGesture`, `ArmsFolded`, `FistPump`, `HeadInHands`, `Shout`, `Write`, `RaiseHand`, plus `Point`, `Clap`, `Celebrate` and `Dejected` on everyone.
  - **Fallbacks:** `Sit*` → `SitIdle` → `Idle`; `Walk` → `Jog` → `Idle`; `FistPump` → `Celebrate` → `Idle`; `HeadInHands` → `Dejected` → `Idle`; everything else → `Idle`.
  - A bone named `Head` is required.
  - Speaking characters carry a `Face` mesh (§18.6).

### 18.4 What you build vs what Claude builds
| You (Gemini) | Claude |
|---|---|
| All code, content JSON text, procedural fallbacks (crest, avatar, kit, flags, pitch, stadium boxes, capsule players, box rooms), registry, audio engine | Meshy models, fal images, ElevenLabs voices/SFX/music, `tools/` scripts, `asset-manifest.json` updates, art direction and UI design references |

### 18.5 Portrait tint (programme print)
Portraits and people images arrive as greyscale halftone prints (black dots on white). The `Portrait` component prints them in two club colours at runtime, so a player who transfers is printed in his new club's colours and the assistant always wears yours:
- Ink colour = the darker of the club's primary and secondary colours (relative luminance). Paper colour = `#F1ECE2` (warm off-white) mixed 12% toward the lighter club colour. If ink-on-paper contrast is below 4.5:1, ink = `#141414`.
- Implement as one inline SVG filter per club (`feColorMatrix` to luminance, then `feComponentTransfer` with `table` values mapping 0 → ink and 1 → paper per channel), referenced by `filter: url(#print-<clubId>)`. No canvas work per frame; filters are defined once in a hidden `<svg>` at app start.
- Free agents and players with no club use ink `#141414`.
- The procedural avatar fallback uses the same ink and paper colours, so missing images look like part of the same set.

### 18.6 People and face atlases (v1.7)
- **`models/person.glb`:** the shared rig and clips (§18.3), 1.78 m tall, ≤ 12,000 triangles, materials `Jacket`, `Shirt`, `Trousers`, `Shoes`, `Skin`, `Hair`. Tint per person for variety: reporters vary jacket, shirt and hair from seeds; Theo has a tracksuit tint in the user's club colours; the owner and directors wear dark suits. Skin tones come from the 6 presets.
- **`Face` mesh:** a thin patch over the face (≤ 200 triangles), skinned only to `Head`, with its own 0–1 UVs and material `Face`. Claude fits it in `tools/`. Without a `Face` mesh, the character has no face animation; the body still works.
- **Face atlas layout** (1024², 4×4 cells of 256², transparent background, dark features):

| Row | Cells (left → right) |
|---|---|
| 0 | eyes open, eyes half, eyes closed, (spare) |
| 1 | brows neutral, brows raised, brows angry, brows worried |
| 2 | mouth closed, mouth small, mouth open, mouth wide |
| 3 | mouth smile, mouth frown, mouth "O", (spare) |

- **Moods** (`balance.ts → faces.moods`): neutral = brows neutral + mouth closed; happy = brows raised + smile; angry = brows angry + frown; worried = brows worried + mouth small; shocked = brows raised + "O". While speaking, the mouth row-2 cells override the mood's mouth.
- Atlases: `coach`, `player` (shared by all players), `person` (reporters and directors), `assistant` (Theo), `owner`.

Procedural fallbacks MUST look intentional: crest = shield SVG with the club's colours, a simple emblem from a set of 8 shapes (anchor, hammer, bird, wave, gate, flame, tree, crow) chosen per club, and the club code; avatar = head-and-shoulders silhouette in kit colours with initials.

---

## 19. UI design system

### 19.1 Direction: two worlds, one show
The game is a television broadcast about your club, plus the rooms behind it. This idea drives every screen, colour and animation.

- **On air (the broadcast).** Everything the public sees: Title, Hub, League, Fixtures, Pre-Match, the match and its HUD, Half-Time, Full-Time, Week Summary, Press Conference, Season End, Sacked. It looks like a sports broadcast graphics package: near-black cool surfaces, hard edges and angled cuts, bold condensed type, your club's colours as the brand, graphics that build in and wipe off, a live ticker.
- **Behind the scenes (the office).** The manager's private work: Squad, Player Profile, Tactics, Training, Transfers/Scouting, Club (finances, board), Inbox, Board Meeting, player conversations. It looks like a manager's office at night under a desk lamp: a warm dark desk, and physical objects on it (paper files and memos, a tactics whiteboard with magnetic counters, a training clipboard, a ledger). Things are placed, slid, pinned and stamped, not just faded in.
- Both worlds share fonts, spacing and data colours, so it reads as one product. Moving between them is a camera cut (§19.7).
- **Your club is the brand.** Once a club is chosen, the accent everywhere is that club's theme colour (§19.2 table), not a fixed UI colour. Every club looks different. Before a club is chosen (Title, New Game), the Meridian League's own brand colour is used.
- Never copy the look of an existing game's UI or a real broadcaster's graphics package.

### 19.2 Tokens (`tokens.css`) and club themes (`src/config/clubThemes.ts`)
```css
:root {
  /* on air: cool near-black */
  --bg: #07090D; --surface: #0E1218; --surface-2: #151A22; --surface-3: #1C222C; --border: #2A313D;
  /* the office: warm dark desk, paper, whiteboard */
  --desk: #100E0C; --desk-2: #191613; --desk-border: #2E2924;
  --paper: #EFEBE3; --paper-2: #E4DED2; --paper-ink: #1B1A17; --paper-dim: #5E574E; --paper-rule: #CFC6B6;
  --board: #E9ECEA; --board-ink: #1E2A38; --marker-red: #C42B2B; --marker-blue: #1F4FBF; --marker-green: #1E7B3C;
  /* text on dark */
  --text: #F2F4F7; --text-dim: #A3ACBA; --text-faint: #7D8696;
  /* brand: set at runtime from the club theme table; these defaults are the league brand */
  --accent: #FF5B35; --accent-ink: #1A0600; --accent-text: #FF6E4D;
  --band-1: #FF5B35; --band-2: #F2F4F7;
  --club-primary: #FF5B35; --club-secondary: #F2F4F7;
  /* fixed meanings (never themed) */
  --gold: #FFC83D; --info: #3DA5FF;
  --win: #18C77A; --draw: #A3ACBA; --loss: #FF4D5E; --warning: #FFB020; --danger: #FF4D5E;
  /* shape */
  --radius-s: 2px; --radius-m: 4px; --radius-l: 6px; --cut: 10px;
  --shadow-1: 0 1px 2px rgb(0 0 0 / .4);
  --shadow-paper: 0 1px 0 rgb(0 0 0 / .25), 0 10px 24px rgb(0 0 0 / .5);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-7: 48px;
  --font-head: 'Barlow Condensed', system-ui, sans-serif; --font-body: 'Inter', system-ui, sans-serif;
  /* motion (§19.7) */
  --dur-micro: 120ms; --dur-fast: 180ms; --dur-med: 260ms; --dur-wipe: 440ms; --dur-count: 650ms; --dur-reorder: 700ms;
  --ease-snap: cubic-bezier(.2,.9,.1,1); --ease-out: cubic-bezier(.2,.8,.2,1); --ease-in: cubic-bezier(.5,0,.8,.2);
}
```
- `--accent` fills (Continue button, active tab block in the top bar, selected states); `--accent-ink` is text on it; `--accent-text` is accent-coloured text, icons and the focus ring on dark surfaces. `--band-1`/`--band-2` are the two stripe colours used in wipes and header stripes.
- On paper and whiteboard surfaces, text is always `--paper-ink`/`--board-ink`; club colours appear there only as stripes, stamps and magnets.
- Dark only. `body { background: var(--bg); color: var(--text); }`. Office screens set their content area to `--desk`.

**Club themes** (`clubThemes.ts`, applied by setting the CSS variables on `:root` when a club is chosen or a save is loaded; opponents' rows are used for versus graphics). Every pair below was checked: ink on fill and text on `--bg`/`--surface`/`--desk` are all ≥ 4.5:1.

| Club | accent (fill) | accent-ink | accent-text | band-1 | band-2 |
|---|---|---|---|---|---|
| league (no club) | `#FF5B35` | `#1A0600` | `#FF6E4D` | `#FF5B35` | `#F2F4F7` |
| c01 Port Calloway | `#F2B705` | `#0B1F3A` | `#F2B705` | `#F2B705` | `#0B1F3A` |
| c02 Ironvale | `#FF6A13` | `#1A0A00` | `#FF7A2E` | `#FF6A13` | `#2B2B2B` |
| c03 Kestrel Bay | `#17A9A9` | `#03201F` | `#2BC2C2` | `#0E8C8C` | `#FFFFFF` |
| c04 Saltmere | `#8FC5E8` | `#0D2233` | `#8FC5E8` | `#6D1A36` | `#8FC5E8` |
| c05 Brightwater | `#4FA3E0` | `#04182A` | `#5DB0EA` | `#4FA3E0` | `#FFFFFF` |
| c06 Northgate | `#2FA457` | `#03200D` | `#3DBA67` | `#1E7B3C` | `#FFFFFF` |
| c07 Ashcombe | `#C8102E` | `#FFFFFF` | `#F0455D` | `#C8102E` | `#111111` |
| c08 Veldmoor | `#6A44A8` | `#FFFFFF` | `#B396E8` | `#4B2A7B` | `#FFFFFF` |
| c09 Lindenfield | `#FFD100` | `#111111` | `#FFD100` | `#FFD100` | `#111111` |
| c10 Corvallen | `#F3F6FB` | `#07090D` | `#F3F6FB` | `#F3F6FB` | `#111111` |

`--club-primary`/`--club-secondary` keep the club's real colours from §9.2 (crests, kits, stripes).

### 19.3 Typography
Headings: Barlow Condensed 700 uppercase, letter-spacing 0.02em; sizes H1 48, H2 32, H3 24, H4 20. Broadcast labels (panel headers, ticker, slates): Barlow Condensed 600 uppercase, letter-spacing 0.06em. Body: Inter 400/500/600; sizes 16 (default), 14 (tables), 12 (captions). Office paper text: Inter on `--paper-ink`, with ruled lines (`--paper-rule`) under rows. **Stamps** (office labels such as INJURED, NOT FOR SALE, SCOUTED, SIGNED): Barlow Condensed 700 uppercase in a 2 px bordered box, rotated −2°, `--marker-red` or `--paper-ink`, like a rubber stamp. All numbers in tables and stats: `font-variant-numeric: tabular-nums`. Big stat numbers: Barlow Condensed 600. No more than 2 weights on one panel or sheet.

### 19.4 Data colours
Attribute/OVR scale: 1–39 `#FF4D5E`, 40–54 `#FF8A3D`, 55–64 `#FFC83D`, 65–74 `#9BE15D`, 75–84 `#18C77A`, 85–99 `#00E5D1`. Colour-blind mode: `#D55E00`, `#E69F00`, `#F0E442`, `#56B4E9`, `#0072B2`, `#CC79A7`. Ratings (match): < 6.0 loss colour, 6.0–6.9 text, 7.0–7.9 win colour, ≥ 8.0 gold. Form dots: W win, D draw, L loss. Data colours are never replaced by the club theme.

### 19.5 Components (behaviour)
- **Button** variants: primary (`--accent` fill, `--accent-ink` text), secondary (surface-3 on dark, paper-ink outline on paper), ghost, danger; sizes S/M/L; radius `--radius-m`; on broadcast screens the primary L button has one angled corner (`--cut`, bottom-right, via `clip-path`); loading state; disabled with tooltip-on-focus reason; pressed state moves down 2 px.
- **ContinueButton**: primary L with KeyHint "Space", subtle pulse every 6 s when idle > 10 s (off with reduce motion). When its label changes ("Continue" → "Kick off"), the new label slides up into place (`--dur-fast`).
- **Panel** (on air): `--surface`, `--radius-s`, a 3 px top stripe in `--band-1` (with a 1/3-width segment of `--band-2` at its right end), header row in broadcast labels. Panels on one screen are deliberately different sizes: one dominant graphic, the rest supporting.
- **Sheet** (office): `--paper`, radius 3 px, `--shadow-paper`, resting rotation between −0.6° and +0.6° (deterministic from its id), paper text with ruled rows. Variants: memo (inbox, board notes), file (player profile: a manila tab `#D9C9A3` with the name), clipboard (training: a dark clip at the top), ledger (finances: two ruled money columns).
- **Table**: sticky header, rows separated by 1 px rules (no zebra on paper; zebra `--surface`/`--surface-2` on air), row hover surface-3 (on air) or `--paper-2` (office), sortable headers with arrow, keyboard navigation.
- **Modal**: centred, max 960 px, Esc closes, focus trap. On air it is a full graphic panel; in the office it is a file opened on the desk (§19.7). No backdrop blur (performance); dim the screen behind with `rgb(0 0 0 / .6)`.
- **ScreenTransition**, **CountUp**, **FlipList**: §19.7.
- **Ticker** (on-air screens only): a 36 px bar along the bottom of the content area. A label block in `--accent` ("AROUND THE LEAGUE", or "LIVE" during matchday) followed by items scrolling at 60 px/s: other results, injuries, rumours, news headlines, each separated by a small two-colour band mark. Pauses on hover and focus. Items come from the week's news and results; never repeat an item within one loop.
- **Stamp**: §19.3. Lands with the stamp animation in §19.7.
- **Magnet** (Tactics, §11.8): a 44 px circle in the player's shirt colour with his number, surname under it in Barlow Condensed 600 `--board-ink`; drag lifts it (scale 1.08, shadow), it follows the pointer through the spring (§19.7), and on drop it settles into the slot.
- **Toast**: bottom-right stack, 4 s, types info/success/warning/error; office screens show toasts as small memos.
- **Tooltip**: on hover and focus, 300 ms delay, max 280 px.
- **Meter**: 0–100 bar with coloured thresholds and trend arrow.
- **PitchBoard**: SVG, responsive, drag with pointer events (mouse), keyboard: select token with Enter, arrows move selection between slots, Enter on a second slot swaps. Drawn as a whiteboard in Tactics (§11.8).
- **StatCompare**: two-sided bars for match stats, each side in that club's accent.
- **Sparkline**: inline SVG.
- **RadarChart** (v1.6; part of the player's file everywhere): inline SVG, 6 axes, scale 0–100, faint rings at 25/50/75 in pencil grey, drawn on the file's paper.
  - Outfield axes (weighted means of attributes): **Pace** = pace; **Shooting** = 0.7 finishing + 0.3 longShots; **Passing** = 0.6 passing + 0.2 crossing + 0.2 firstTouch; **Dribbling** = 0.6 dribbling + 0.2 firstTouch + 0.2 composure; **Defending** = 0.5 tackling + 0.35 positioning + 0.15 heading; **Physical** = 0.4 strength + 0.4 stamina + 0.2 workRate. Goalkeepers: Reflexes, Handling, One-on-ones, Aerial (aerialCommand), Distribution (passing), Positioning.
  - **His shape:** blue marker stroke (2 px) with a 15% fill of the same ink. Each axis label shows its number; hover or focus on a label lists the attributes behind it.
  - **What the role needs:** a red dashed shape for the selected role at his slot (his attacking role on With ball, his defensive role on Without ball). Its values are the mean axis values of the 20 players in the world with the highest fit for that role, computed at load and again at season start (`src/core/player/roleShapes.ts`, pure, cached). Where his value is more than 5 under the dashed one, that axis label turns `--warn`.
  - **Comparison:** while a magnet is dragged over another, the other player's shape is drawn in pencil grey on the same chart.
  - **Motion:** a new shape draws on with `stroke-dashoffset` (320 ms, the marker exception). When the role changes, the old dashed shape fades out and the new one fades in (opacity, 180 ms). Vertices are never tweened. Reduce motion: shapes appear at once.
  - Unscouted players (other clubs, §12.12): the range is a band between the low and high shapes, no fill.

### 19.6 Layout and the top bar (v1.6: no sidebar)
Shell: top bar 56 px across the full width, content below it, Ticker 36 px at the bottom of on-air screens. There is no sidebar. Padding 24 px (16 px under 1280). 12-column grid, gap 16 px. On-air screens: content max width 1600 px, and the page may scroll. **Office work screens** (Squad, Tactics, Training, Transfers/Scouting): full width up to 2400 px (centred beyond that), and they MUST fit the window with **no page scroll** at 1280×720 and up. A column whose content is longer scrolls inside itself; the main object (board, table, clipboard) never scrolls away. Every screen MUST be checked at 1280×720, 1920×1080 and 2560×1440 (§22.4).

**The top bar (the rundown, now horizontal)**:
- Left: crest (32 px) and club name in Barlow Condensed 700 18 px (name hidden under 1440 wide).
- Navigation tabs in two groups, **On air** (Hub, League, Fixtures) and **The office** (Squad, Tactics, Training, Transfers/Scouting, Club, Inbox), split by a 1 px rule; each group has a 10 px broadcast label above it (hidden under 1440). Keys `1`–`9` follow this order. Each tab: 14 px label in Barlow Condensed 600, `--text-dim`, 12 px side padding; hover or focus lifts it to `--text` (`--dur-fast`). Inbox carries its unread count as a small badge.
- **The current tab** sits in a block filled with `--accent`, label in `--accent-ink`. Changing page: the block slides from the old tab to the new one (shared-element FLIP, `--dur-med`, `--ease-snap`). Its context line ("Matchday 7 · v Port Calloway", "4-4-2 · 2 changes", "5 unread") shows as a flag hanging under the block for 1.2 s after the page change, then tucks up.
- Right: the status chip ("MD 7/18 · 3rd · 14 pts"), balance (hidden under 1440; it is on Club), settings gear, Continue. Continue keeps its idle hop (Hub README).
- Width at 1280: crest 40 + 9 tabs (about 640) + chip 150 + gear 40 + Continue 150 + gaps fits. If it ever doesn't, tabs drop to icons with the label only on the current tab.
- The bar uses broadcast surfaces on on-air pages and desk surfaces on office pages (crossfade `--dur-med`).

**Composition**: on-air screens have one dominant graphic and supporting panels of different sizes, never a uniform grid of equal cards. Office screens are a desk with objects of different sizes; slight overlap is allowed (a memo partly over a file) but data is never hidden under another object.

### 19.7 Motion: the feel
Motion explains change and gives the game weight. On-air motion is fast, precise and graphic: snap in, hold, wipe off. Office motion is physical: objects have mass, slide, settle and stack. Data never bounces.

**Screen transitions** (`ScreenTransition`, one at a time; never blocks input for more than 150 ms; Space or a click during a transition finishes it at once):
1. **On air → on air: stinger wipe.** Two parallel bands skewed −12° (`--band-2` leading by 40 ms, then `--band-1`) sweep across the content area left to right in `--dur-wipe`. They never cover the top bar. The new screen swaps in while the bands fully cover the content; then its panels build: each panel enters from `translateX(-16px)` and opacity 0, 40 ms apart, up to 8 panels, `--dur-med`, `--ease-snap`.
2. **On air ↔ office: camera cut.** The content dips to black (opacity to 0 in 90 ms); a slate label ("THE OFFICE" or "ON AIR", broadcast label 14 px in `--accent-text`) shows in the content's top-left for 300 ms; the new world appears and its objects settle.
3. **Office → office: across the desk.** The old screen slides 32 px out and fades (`--dur-fast`), the new one slides in from the other side; its sheets settle from `translateY(10px)` and ±1.2° extra rotation to their resting rotation through the spring.
4. **Modals.** On air: the graphic panel wipes in from the left edge (`--dur-med`). Office: the file opens from the row that was clicked (scale from that row's rectangle, `--dur-med`), then its sheets fan out one by one (50 ms apart).

**Spring** (`src/ui/motion/spring.ts`, no libraries, §4): stiffness 420, damping 34, mass 1; stops when velocity < 0.01 and distance < 0.5 px. Used by Magnets, sheets and the top-bar tab block.

**CountUp**: when a number changes (points, balance, a meter), it counts from the old to the new value in `--dur-count` with `--ease-out`, tabular numerals. It runs on the first view after the change, never on every revisit.

**FlipList**: rows that change order (league table after a matchday, squad sort) slide to their new places (measure, invert, play), `--dur-reorder`, 30 ms stagger. A row that moved up flashes `--win` at 12% opacity for 600 ms; down, `--loss`.

**Signature moments (MUST):**
- After every matchday: the table reorders with FlipList, points count up, the new form dot pops in (scale 0.6 → 1, `--dur-fast`).
- A new inbox item drops onto the pile (from `translateY(-12px)` with a small rotation) with `ui_paper`.
- Transfer complete or contract signed: a SIGNED stamp lands (scale 1.4 → 1 in 160 ms) with `ui_stamp`.
- Tactics: magnets slide with the spring; swapping two players moves both to each other's slot at once; a dropped magnet plays `ui_clack`.
- Kick-off from Pre-Match: the Continue press triggers a full-height stinger into the match loading screen.

**Sound hooks** (effects channel, §17.3; a missing file is simply silent): wipe `sfx/ui_whoosh.mp3`; camera cut `sfx/ui_cut.mp3`; CountUp `sfx/ui_tick.mp3` (at most 12 ticks per second, quiet); magnet drop `sfx/ui_clack.mp3`; sheet or memo `sfx/ui_paper.mp3`; stamp `sfx/ui_stamp.mp3`.

**Performance (MUST):** animate only `transform` and `opacity`; never animate `box-shadow`, `filter`, `backdrop-filter`, width/height/top/left or other layout properties (the wipe bands are skewed divs moved with `transform`, the top-bar tab block uses FLIP). Set `will-change` only while an animation runs. FlipList measures in one read pass, then writes in one pass. The ticker is one translated strip, not a timer per item. Every screen transition finishes in under 500 ms. Menus hold 60 fps on the target laptop, and the browser profiler shows no task over 50 ms during a transition.

**Reduce motion** (setting or system preference): wipes, cuts and slides become a 150 ms crossfade; no springs (objects appear at rest); CountUp jumps straight to the value; FlipList highlights the rows without moving them; the ticker shows one item at a time, changing every 6 s with a fade; stamps appear without scaling.

**Never:** bouncy overshoot on numbers or panels, parallax, tilting 3D cards, animated gradients, pulsing glows, confetti, text typed out letter by letter.

### 19.8 The craft bar (MUST, applies to every screen, line of copy and match moment)
The judges score depth, fun and visual fidelity. Anything that looks or reads like generic AI output loses on all three. Treat this section as a hard requirement, not a style tip.

**Visual: never do these**
- No purple/blue "AI gradient" backgrounds, gradient text, glassmorphism stacks, glowing borders on everything, floating blobs, sparkle icons or emoji used as icons.
- No card grids where every card has the same size and weight. The Hub has one dominant card (Next match) and supporting cards.
- No centred walls of text, no all-caps body copy, no more than 2 font weights on one card.
- No icons without meaning. Each icon is from lucide-react, 16 or 20 px, and sits next to a label unless the meaning is universal (close, settings, search).
- No default browser controls left unstyled (select, range, number input, scrollbars on dark surfaces).

**Visual: always do these**
- One clear primary action per screen (the Continue button or the screen's own primary button), everything else visually quieter.
- Hierarchy you can read in 2 seconds: one H1 per screen, then section titles, then data.
- Every element sits on the 4 px grid and the 12-column layout. Equal gaps inside a group, larger gaps between groups.
- Tables: numbers right-aligned with tabular numerals, text left-aligned, long names truncated with an ellipsis and shown in full on hover and focus.
- Every interactive element has hover, `:focus-visible` (2 px `--accent-text` ring, 2 px offset; `--paper-ink` ring on paper and whiteboard), active, disabled and loading states.
- Every list has a designed empty state (an icon, one sentence that says what goes here and how to fill it, and an action if one exists).
- Club identity everywhere it belongs: crest, colours stripe, kit icons, stadium name. The game must feel like it is about *your* club.

**Copy: never do these**
- Never use marketing or AI filler: "unleash", "elevate", "dive in", "seamless", "embark", "journey", "game-changer", "level up", "Let's get started!", exclamation marks in UI labels.
- Never write vague labels ("Manage", "Info", "Details"). Say what the thing is ("Contract", "Last 5 matches").

**Copy: always do these**
- Write like football people talk: "XI", "clean sheet", "matchday", "the gaffer", "deadline day", "sat deep", "went direct". British/international English spelling.
- Button labels are verbs with objects: "Pick best XI", "Make offer", "Kick off".
- Numbers carry units and context: "Condition 68% (tired)", "€4.2M (fair price)".

**Game feel: details that MUST exist in the match**
Players walk back to their halves after a goal; the scorer runs to the corner flag and teammates join; the keeper picks the ball out of the net; the losing side's heads drop (Dejected); the substitution board is held up by the fourth official at the halfway line before a sub; an injured player limps off or is helped off; players argue with the referee after a red (two players walk toward him); the wall shuffles before a free kick; the taker places the ball and steps back before corners and penalties; the crowd groans on a miss and "ooh"s on a save; the scoreboard pulses on a goal; added time is shown on a board.

**Football sense: things that MUST never happen**
A goal the camera does not show; the ball teleporting; two players on top of each other; a player running through the goal frame; a scorer who did not touch the ball; a GK playing as a striker; implausible score lines more than rarely (calibration §13.16 guards this); the same commentary line twice in one half; a press question repeated in the same season.

**Design references and review gates**
Claude will put reference mock-ups for the key screens in `docs/design/` (Hub, Squad, Player Profile, Tactics, Pre-Match, Match HUD, Full-Time, Season End). Match them closely; where a reference and this spec disagree, the spec's data and behaviour win and the reference's look wins.
At the end of M3, M4 and M7, save screenshots of every screen at 1280×720, 1920×1080 and 2560×1440 into `docs/screens/<milestone>/` (named `<screen>-<width>.png`) and stop for a design review. Claude reviews them and writes fixes into `docs/design/REVIEW-<milestone>.md`. Fix every item before starting the next milestone.

---

## 20. Saving, loading, settings

### 20.1 Storage
IndexedDB via idb-keyval, database `touchline`, store `saves`. Keys: `slot-1`, `slot-2`, `slot-3`, `autosave`. Value: `{ meta: { club, matchday, managerName, savedAt, version }, state: GameState }` (meta lets the Load screen list saves without parsing the whole state). Settings live in `localStorage` key `touchline.settings` (small; wrapped in try/catch; defaults if unavailable).
On the first successful save, call `navigator.storage.persist()` once (if it exists; ignore the result and any error). It asks the browser not to evict our saves when the disk gets full. If IndexedDB is unavailable (some private windows), the game still runs, Continue and Load are hidden, and the title shows one line: "Saving is off in this browser window. Use Export to keep your progress."

### 20.2 Versioning
`SAVE_VERSION = 1`. `core/game/migrations.ts` exports `migrate(raw): GameState` with a switch per version (only v1 for now) and a test. Unknown future versions → friendly error "This save is from a newer version."

### 20.3 Autosave
After WeekSummary is generated, after each transfer window round, and at SeasonEnd. Also **after any user decision outside a match**: lineup, tactics, roles, instructions or orders, training, a transfer bid or answer, a contract, a player conversation, a board or press answer. Debounce these to 1 s after the last change, so a burst of edits on the tactics board is one write. Saves are single writes to `autosave` and must not cause a visible hitch (no task over 50 ms; serialise off the input path, e.g. in `requestIdleCallback` with a 1 s timeout). Also save on `visibilitychange` to hidden and on `pagehide`, if anything changed since the last save. Never during a match (a match in progress that is interrupted resumes from PreMatch: the fixture is replayed from the start with the same seed — deterministic, so the outcome is only different if the user changes decisions).

### 20.4 Export/import
Export: download `touchline-save-<club>-md<matchday>.json`. Import: file picker → validate shape (`version`, required keys) → write to a chosen slot.

### 20.5 Settings defaults
master 80, music 50, crowd 70, commentary 85, effects 70, voice on, speed Key highlights, auto-continue off, confirm instant on, coach walks on, quality Auto, FPS off, reduce motion = system preference, larger text off, colour-blind off.

---

## 21. Performance budgets and quality presets

### 21.1 Budgets (MUST)
| Item | Budget |
|---|---|
| First paint (HTML splash) | < 300 ms |
| Title interactive | < 2.0 s from a cold local load (dist served by `vite preview`) on a mid laptop |
| Main JS chunk (gzip) | ≤ 350 KB (three.js chunk separate, lazy) |
| Initial asset download before the title is interactive | ≤ 5 MB |
| Match scene ready after Kick Off | < 2.5 s (models cached after the first match: < 1 s) |
| Frame rate in match, Medium, 1920×1080, Intel Iris Xe class | ≥ 55 fps average, never < 30 for > 1 s |
| Instant sim of one match | < 30 ms; full round of 4 other matches < 150 ms in the worker |
| Memory after 5 matches | no growth > 50 MB versus after the first |
| Club rooms (v1.7), Medium, 1920×1080, same laptop | ≥ 55 fps during walks; 30 fps cap while a screen is open and nothing big moves |
| Each room (v1.7) | ≤ 120k triangles, ≤ 120 draw calls, ≤ 40 MB GPU textures, ≤ 12 animated people |
| Club spaces download (v1.7) | ≤ 12 MB, loaded lazily after the Title is interactive; never delays first paint or the Title |
| Next room ready (v1.7) | before the walk ends (≤ 2.5 s); first-ever visit ≤ 1.0 s extra with a fade |
| Total build size | < 150 MB |

### 21.2 Presets
| Setting | Low | Medium | High |
|---|---|---|---|
| Pixel ratio | 1.0 | min(1.5, devicePixelRatio) | min(2, devicePixelRatio) |
| Antialias | off | on | on |
| Shadows | off | 1024 map, 1 light | 2048 map, 1 light |
| Crowd instances | 2,000 | 6,000 | 12,000 |
| Rain particles | 0 | 3,000 | 8,000 |
| Line texture | 2048×1280 | 4096×2560 | 4096×2560 |
| Net ripple, ball shadow | blob only | yes | yes |
| Post-processing composer (§14.10) | off | on, MSAA 4 | on, MSAA 4 |
| Bloom | off | half resolution | half resolution |
| Ambient occlusion (GTAO) | off | off | half resolution |
| Floodlight beams and glare | glare sprites only | yes | yes |
| Colour grade and vignette | off | yes | yes |
| Environment map, haze, grass normal map | yes | yes | yes |
| Club rooms: people (v1.7) | still frame after the camera settles; walks become cuts | animated, ≤ 12 | animated, ≤ 12 |
| Club rooms: shadows (v1.7) | off | 1024 map, 1 light | 2048 map, 1 light |
| Touchline cuts (v1.7) | coach only | coach, Theo, bench | coach, Theo, bench |
**Auto**: start Medium; measure the average frame time over the first 3 s of each match; if > 22 ms drop one level (toast "Graphics set to Low for smoother play"); if < 10 ms on Medium for 10 s, offer High (toast with a button), never switch up automatically.

---

## 22. Testing, calibration and QA

### 22.1 Unit tests (vitest, MUST exist and pass)
- `rng`: same seed same sequence; `deriveSeed` stable; state save/restore.
- `frames`: round trips, both halves, both sides; zone classification at boundaries.
- `world`: 280 players, squad composition per §9.3, unique names, blocklist, OVR within ±1 of target before flavour, snapshot loads and validates.
- `fixtures`: 18 matchdays, each club plays each other twice (once home, once away), no 3 consecutive home or away games, no derby on matchday 1.
- `table`: sorting with every tiebreaker (construct cases).
- `engine`: determinism (same input+seed → identical events JSON); command rewind keeps earlier events identical; 11-v-11 legal at all times (never more than 11, ≥ 7, exactly one GK or an outfielder in goal after a GK red with no subs); scores equal GOAL events; possession seconds sum ≈ match duration; no NaN anywhere (scan all numbers).
- `engine calibration (fast)`: 400 equal matches: goals/match 2.2–3.2, draws 18–34% (wider than the full calibration to avoid flakiness).
- `ratings`, `value` (monotonic in OVR, decreasing with age past 28), `transfers` (accept/counter/reject thresholds; player refusal rules; budget/wage/squad caps), `talks` (table values and personality multipliers), `board` (sacking rule), `development` (no growth beyond potential), `saves` (round-trip and migration), `content` validation (§16).

### 22.2 Calibration script
`npm run calibrate` runs §13.16 suites and prints a table: metric, value, target, PASS/FAIL. It also benchmarks `simulateInstant` (median and p95 ms). Paste the output into PROGRESS.md at the end of M2 and after any engine change.

### 22.3 Season soak test
`tests/season.soak.test.ts` (tagged, run with `npm test -- season.soak`): simulate 20 full seasons with the user's club on "Assistant manages everything": no crashes, every season completes, the table's total points equal `3 × (matches with a winner) + 2 × (drawn matches)`, finances never NaN, squads always ≥ 16 and ≤ 26 with ≥ 2 GKs, no duplicate players across clubs.

### 22.4 Manual QA checklist (run at the end of M7 and M8; record results)
1. Fresh profile (clear site data) → title → new game with each reputation tier once.
2. Full season at default settings: time it (target 25–40 min). Note any screen that felt slow or confusing.
3. Every screen at 1280×720, 1920×1080, 2560×1440; resize live during a match.
4. Keyboard-only run of a matchday (no mouse).
5. Offline: DevTools Network "Offline", hard reload `vite preview` build: everything works; Network panel shows only local requests; console has no errors or 404s.
6. Delete `public/assets` contents (in a copy) → the game is fully playable with fallbacks.
7. Low quality on an integrated GPU: FPS overlay ≥ 55.
8. Save in a slot, reload the page, load: identical state. Export/import.
9. Chrome, Edge, Firefox.
10. A sacking run (lose on purpose) reaches the Sacked screen.

---

## 23. Milestones, tasks and acceptance criteria

### 23.0 PROGRESS.md entry format
```
## 2026-11-20 · M1.3 World generation
- Changed: src/core/world/generateWorld.ts, names.data.ts, tests/core/world/generateWorld.test.ts
- Ran: npm test -- world → 6 passed, 0 failed
- Notes: …
- Open issues: …
```

### M0 — Foundation (19–20 Nov)
1. Scaffold Vite + React + TS with the exact versions (§4), scripts, configs, prettier, `.gitignore` (node_modules, dist, .env*, *.local, coverage).
2. `index.html` splash (§11.1), fonts via @fontsource imports, `tokens.css`, `global.css`.
3. Shell: Sidebar, TopBar, ContinueButton, routing by `phase`/screen in the store (no router library needed; a `screen` state with typed names).
4. Asset registry + empty manifest; procedural crest/avatar/kit/flag generators with a dev-only gallery screen (`?dev=gallery`, excluded from production UI).
5. Title screen + Settings modal (audio sliders saved; quality stored).
**Accept:** `npm run check` passes; title renders at 1280×720 and 2560×1440; splash paints < 300 ms; no console errors.

### M1 — Core data and world (20–23 Nov)
1. `types.ts`, `rng.ts`, `math.ts`, `ids.ts` with tests.
2. `clubs.data.ts` exactly per §9.2; formations (§14.3 anchors + slot positions).
3. Names + blocklist; `generateWorld.ts`; `scripts/gen-world.ts` writes the snapshot; generate and **commit** `world.snapshot.json` (freeze).
4. Ratings (§9.5), value/wage (§12.10), fixtures (§10.3, in the snapshot), table (§9.1).
5. `newGame.ts` (creates GameState from snapshot + seed + club + manager name), saves (§20) with tests.
**Accept:** all M1 tests pass; snapshot has 280 players, 90 fixtures; a dev page lists every club squad with OVRs and looks plausible (key players visible).

### M2 — Match engine (23–27 Nov)
1. Frames and zones (§13.1) with tests.
2. Engine state, involvement (§13.5), action selection (§13.6).
3. Action resolution (§13.7), shots/fouls/set pieces (§13.8), transitions (§13.9), clock/stoppage (§13.11).
4. Stats, ratings (§13.14), result.
5. AI manager (§13.13).
6. Commands + snapshots + rewind (§13.12); `match.worker.ts` protocol (§7.4); `season.worker.ts` (instant round).
7. Calibration script; tune to targets (§13.16).
**Accept:** determinism and legality tests pass; calibration report all PASS (record in PROGRESS); `simulateInstant` median < 30 ms.

### M3 — Playable season loop, text-first (27 Nov – 1 Dec)
0. **Tactical depth engine pass (§13.17), before anything else in M3**: new types (§8.4), `src/config/roles.ts`, role/instruction/order/transition/set-piece hooks in involvement, utilities and resolution, the new commands, AI defaults (§13.17.8), assistant rules (§13.17.9), save migration (duties → neutral roles, new fields → Mixed), unit tests per modifier kind, then re-run `npm run calibrate`: all §13.16 targets plus every §13.17.10 check MUST pass. Paste the report into PROGRESS.md.
1. Store actions for every phase (§10) and `advance.ts`.
2. **Wait gate:** do not start this task until Claude's animated references for the Hub and Tactics exist in `docs/design/` (check for `docs/design/hub/` and `docs/design/tactics/`). If they are missing when you reach it, write `BLOCKED: waiting for design references` in PROGRESS.md and continue with task 1 and any non-visual work in task 3 (store wiring, data selectors), then stop. Then rework the M0 shell to the §19 design system (v1.2): new `tokens.css`, `clubThemes.ts` applied at runtime, the top bar with navigation tabs (§19.6, v1.6; there is no sidebar), Ticker, ScreenTransition, CountUp, FlipList, Panel, Sheet, Stamp, Magnet, `src/ui/motion/spring.ts`, reduce-motion handling. Every screen below is built in its world (on air or office, §19.1).
3. Screens: New Game (§11.3), Board Meeting, Hub, Squad, Player Profile, Tactics (PitchBoard with drag/swap and keyboard), League, Fixtures, Club (finances/board basic), Inbox, Week Summary, Season End (basic), Sacked.
4. A temporary **text match view**: event feed with clock and score, speed control, subs/tactics overlays working through the worker with commands.
5. Autosave and Continue from title.
**Accept:** every screen change uses the §19.7 transitions and holds 60 fps; reduce motion turns them into crossfades; a complete 18-matchday season can be played start to finish via the text match view; save/reload mid-season works; season end shows table and grade; screenshots saved and the M3 design review (§19.8) is passed.

### M3b — Depth pass 2 (SPEC 1.4; starts when M3 is accepted, about 3 days; Gemini is ahead of schedule)
1. Engine: §13.18.1–13.18.11 and §13.19 (attacking and defensive roles, instructions by role, instruction fit; types §8.4, `K.d2.*`, the new `plan` command, AI and assistant additions, save migration with neutral defaults: Mixed / false / Never / 2 / None, plans copied from the current tactics, familiarity from §13.18.11 starting values).
2. Unit tests per new option, then `npm run calibrate`: all §13.16 targets, every §13.17.10 check, every §13.18.13 check and every §13.19.7 check MUST pass. Paste the report into PROGRESS.md.
3. Tactics screen rebuilt to the **v4 layout** in `docs/design/tactics/README.md` (top bar shell, three columns around a vertical board, no page scroll, RadarChart §19.5), with every object looking as it does in the v3 reference: the With ball / Without ball switch, the player's file with stats, role attribute bars and instruction fit, the swap comparison while dragging. Other office screens follow the same pattern (see that README).
**Accept:** calibration all pass; every new option changes the match in the direction its wording says (checked by the tests); old saves load.

### M4 — 3D match day (1–5 Dec)
1. Scene skeleton with fallbacks: pitch, lines, goals, boxes stadium, capsule players, ball, lights, quality presets, resize, disposal.
2. Choreographer (§14.3) and steering; ball flight.
3. Playback modes and highlight selection (§14.1, §14.6); time-lapse overlay with 2D radar.
4. Cameras (§14.4) incl. free orbit; goal replays (§14.7).
5. HUD (§11.16), half-time and full-time screens (§11.17–11.18), shot map, momentum chart, and the Analysis panel (§13.18.12).
6. Swap in real models automatically when present (registry), animations per §18.3.
7. Realism pass (§14.10): environment map, haze, grass material, post-processing chain, beams, wet pitch, wired to the quality presets (§21.2).
**Accept:** the realism pass is on at Medium and the frame budget (§21.1) still holds; a match at Key highlights takes 50–80 s real time; goals visibly match the events (the scorer is the one shooting, the ball ends in the net); 60 fps Medium on the dev laptop; 5 matches in a row without memory growth; every "game feel" detail in §19.8 is present; M4 design review passed.

### M5 — Systems depth (5–8 Dec)
1. Training (§12.3), development (§12.4), condition/fatigue (§12.1–12.2), injuries (§12.5), discipline (§12.6).
2. Morale and team talks (§12.8) in Pre-Match, Half-Time, Full-Time.
3. Press conferences (§12.6 triggers, §16.2).
4. Conversations (§12.9).
5. Board and fans (§12.7, §12.14), finances (§12.10).
6. Transfer windows complete (§12.13) with scouting (§12.12) and AI activity; news (§16.6).
7. Club depth (§12.17): staff and replacing them, match preparation, rest days, role and position training, dressing room (leaders, cohesion), injury risk column.
8. **Training in detail (§12.18, v1.7):** the planned week and session library, templates, Theo's week, personal plans (workload, extra sessions, mentoring), one-to-one sessions (screen flow now, the 3D scene in M6b), training ratings and the new conversation trigger, progress arrows and the OVR line, overload memos, `training.json`, the Training screen (§11.9 v1.7) as a 2D screen until M6b frames it. Run the §12.18.12 checks. §12.18.11 (coaches per area) only after M7 is on track.
9. **Set pieces in detail (§13.20, v1.7):** corner jobs and routines (Rotate, predictability, sharpness from training), takers and swing from the foot, free kicks by area, defending corners and free kicks, set-piece mode on the whiteboard, 3D placement, analysis, AI and assistant rules. Run the §13.20.10 checks.
10. **Touchline shouts, match plans and player traits (§13.21–13.23, v1.7):** the shout command and HUD wheel, the match-plan sheet and engine rules with "Ask me first", traits in the data, world gen, engine, clashes, learning in training, and UI. The touchline cut for shouts comes in M6b. Re-run the §13.16 and §13.18.13 calibration with traits on.
11. **Injury and discipline decisions (§12.19–12.20, v1.7):** knocks with the KNOCK event and command, rushing players back, warm-up scares, the Knocks setting, the injury log; discipline incidents, choices, the consistency rule, records; `club.json` physio and incident lines. Build them as choice cards on the current screens now; M6b turns them into talk scenes (§11.25.5).
**Accept:** every system visibly changes something the player can see within a season; transfer window rounds behave per the tests; content files meet minimum counts.

### M6 — Assistant and audio (8–10 Dec)
1. Advice engine (§15) with Apply actions in Pre-Match, Hub, match drawer, Half-Time, post-match.
2. Audio engine, buses, settings wiring, crowd danger mix, SFX hooks, music.
3. Commentary selection and caption strip; voice chaining (names + lines) with ducking.
**Accept:** in a test match, at least 3 assistant advices fire and Apply changes the engine (visible in the next events); audio works with and without asset files; commentary captions never overlap or lag more than 1 s.

### M6b — Club spaces (SPEC 1.7; starts when M6 is accepted, about 6–7 days; Gemini is ahead of schedule)
Build everything with fallbacks first (box rooms, capsule people, no faces, caption-rhythm mouths), then switch to real assets as they appear in the manifest.
1. `ClubScene` and scene manager, corridor, camera rails, the coach's walk with skip, tab and Continue routing through rooms, the walks setting, and look-around in every room (§11.25.1–11.25.2, §11.25.4).
2. Room shells in code, and every screen re-framed in its room (§11.25.3). Frame cap and the Low-preset still frame (§21).
3. People: shared rig loader, clip mixer with fallbacks, marks and paths, sitting (§14.11.1).
4. Faces and mouths: `Face` shader, moods, blink, head tilt and gaze, audio-driven and caption-rhythm mouths (§14.11.6–14.11.7).
5. **Talk scenes (§11.25.5), used by every scene where people talk: speaking beats with Skip only, choice beats with the choice card.** Dressing room (the U of lockers, §11.25.1): Squad lockers, the pre-match briefing, team-talk reactions from real §12.8 results; Pre-Match, Half-Time and Full-Time here (§14.11.2). Boardroom: Board Meeting, reviews, Sacked.
6. Players at the door: §12.9 conversations as office scenes, and "Talk to player" at the locker (§14.11.3).
7. Theo in the office, at the whiteboard and in the dressing room (§14.11.4).
8. Press room: reporters, the voiced question, raised hands, flashes (§14.11.4).
9. Tunnel walk-out into the M4 match intro.
10. Touchline cuts in the match with Theo and the bench (§14.11.5).
11. Training ground drills by focus (§14.11.4).
12. Room ambience and one-shots (§17.5), and the coach, owner and Theo voices wired (§17.4).
13. Capture `docs/screens/M6b/` (every room, at 1280×720 and 1920×1080, with assets and without) and a performance run. `REVIEW REQUESTED: M6b`: this is a Claude design gate.

**Accept:**
- Every screen is reachable by mouse and keyboard, and plays offline with no assets.
- Budgets in §21.1 are met.
- Walks add ≤ 3 min to a full season at default settings, measured in a scripted season.
- A test shows each player's team-talk reaction matches the sign and size of his morale change.
- No room ever delays the Title.

**If time runs short, cut in this order** (record each in `DECISIONS.md`):
1. training drills (players hold a still drill pose)
2. press-room reporter animation (they stay seated; the question is still voiced)
3. Theo in the match (his tips stay as HUD cards)
4. the bench in touchline cuts
5. the coach's walk (becomes a camera glide)
6. faces on everyone but the coach

Team-talk reactions, players at the door and room sound stay.

### M7 — Onboarding, polish, season end (10–12 Dec)
1. Tutorial (§11.24). 2. Season End sequence complete with awards and share card (§11.20, §12.15–12.16). 3. Save slots, export/import, Load screen. 4. Credits. 5. Visual polish pass on every screen against §19 (spacing, empty states, loading states). 6. Run QA checklist §22.4 and fix.
**Accept:** QA checklist all pass except items blocked by missing final assets; a new player can finish a season without reading any docs; M7 design review passed.

### M8 — Asset integration and performance (12–15 Dec)
1. Integrate Claude's delivered assets (they appear in the manifest; verify every path is consumed), including the portrait tint (§18.5) if not already done. 2. Performance pass against §21 (profile, fix). 3. Offline test, no 404s. 4. Final content proofreading. 5. Feature freeze on 15 Dec.
**Accept:** budgets §21.1 met and recorded; QA checklist all pass.

### M9 — Ship (15–17 Dec)
1. `npm run check` clean; `npm run build`; `vite preview` smoke test.
2. Hand over to Claude Code for `opengame check --build` and deploy (Gemini is not a supported OpenGame agent). Fix any findings it reports.
3. Optional: OpenGame SDK leaderboard for the season score (only if the SDK docs from `opengame setup` describe it; must not require sign-in and must work offline by failing silently).
**Accept:** the published entry plays from a fresh browser; submitted before 17 Dec 23:59 PT (one day of margin).

---

## 24. Out of scope (do not build) and stretch goals

Out of scope for the jam build: online multiplayer, accounts, real-time "day/week" persistent modes, loans, youth academy intake, cups, staff hiring beyond §12.17.1, stadium upgrades, editor, mobile/touch, and the SPEC-1.4 Tier C items (a free-draw set-piece designer; the job-based one is §13.20; contract clauses, social groups).

**Real-life extras (v1.7, approved by the user 22 Nov; only if time allows, after M6b is accepted and M7 is on track, in this order; write each as a short SPEC addition before starting):**
1. **Referees with a personality:** a named referee per match, with strictness (lenient / normal / strict: yellow chance per foul ×0.8 / ×1 / ×1.25, penalty-for-box-foul chance ±10%) and an advantage habit. Shown in the Pre-Match report ("Strict: 4.6 yellows a game"), and the assistant factors it in ("Strict ref. Easy on the tackles.").
2. **Real contract talks:** renewals and signings become a negotiation scene (§11.25.5) with the player's agent. Wage, years, a role promise and a signing bonus are proposed and countered over up to 3 rounds, with a walk-away point from the player's personality, ambition and the club's reputation. It replaces the single-line renewal in §12.9 and the Contract dialog in §11.10.
3. **Matchday atmosphere:** crowd density follows the real attendance (§12.10), with away fans in their colours in one corner. A full-time handshake with the other manager (a touchline cut), and before derbies, the rival manager's jibes in the pre-match press (`press.json` context `RIVAL_QUOTE`).

**Separate shape without the ball (v1.7, approved by the user 22 Nov as one of the last items):** start only when M5, M6, M6b and the club life extras below are done and M7 is on track. A plan can have a second formation for defending (for example, attack in 4-3-3 and defend in 4-4-2). The engine uses the defending formation's anchors and involvement when out of possession (§13.5, §14.3 out-of-possession shape), with defensive roles per its slots (§13.19.2). Familiarity is tracked for each formation pair. The switch costs a transition-shape penalty for the first 6 s after a turnover (their Counter ctx +0.05). Write the full rules as a SPEC addition before starting; a Claude design review is needed for the board's two-shape view.

**Club life extras (v1.7; only if time and credits allow, after M6b is accepted and M7 is on track, in this order):**
1. **A club that changes over the season:** the trophy cabinet fills, the weather turns wintry by December, the office gets messier during a losing run, and fans outside cheer or boo by form as the coach arrives.
2. **Signing day:** a new signing shakes the coach's hand and holds up the club scarf for the photographers in the press room.
3. **The physio room:** injured players on a treatment table, and you can visit them (§12.5).
4. **Big endings:** a trophy lift on the pitch if you win the league; packing a box after the boardroom sacking.

Stretch (only after M8 passes, in this order):
1. **Career mode**: continue to Season 2+ with ageing, retirements, contract expiries, regens (new fictional players generated with a separate seed and generic commentary lines), and the board's new expectation.
2. **League Cup**: 8-team knockout (top 8 by reputation), single matches on matchdays 5, 11, 15.
3. **Weather and pitch wear visuals** (worn goalmouths over the season).
4. **"Create your own club"** (name, colours, crest emblem; takes the place of Veldmoor Town).
5. A lean optional server for live AI press conferences (would need the jam's "keys stay on your server" rule and an offline fallback).
6. **Challenge a friend (no server):** the engine is deterministic, so a "challenge code" (your club, XI and Plan A, compressed into a short string) lets a friend play a match against your side on their own machine. Optional later: a small server for friend leagues and a results board. Online play must never be needed to play the game (the review runs offline).

---

## 25. Glossary
- **OVR**: overall rating at a position (§9.5). **Potential**: hidden OVR ceiling.
- **Step**: one possession action in the engine. **Highlight window**: a time span of events shown in Key/Extended playback.
- **z-units**: normalised attribute units `(a − 50)/25` used in contest formulas.
- **xG_ref**: public reference expected-goals value of a shot context.
- **Snapshot**: serialised engine state used for resume and command rewinds.
- **Manifest**: `public/asset-manifest.json`, the list of delivered asset files.
