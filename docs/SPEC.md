# TOUCHLINE (working title) — Complete Build Specification

Version 1.0 · 19 November 2026 · Target: OpenGame Game Jam #1 (entries close **18 December 2026, 23:59 PT**)

This is the single source of truth for building the game. It is written for an AI coding agent (Gemini) doing most of the implementation, with Claude producing art, models, audio and asset tools in parallel. Every number, file path, screen and rule needed to build the game is here. If something you need is missing, follow §0.4. Do not invent it silently.

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
│  ├─ content/  commentary.json  press.json  talks.json  conversations.json  news.json  assistant.json  injuries.json
│  ├─ workers/  match.worker.ts  season.worker.ts
│  ├─ state/    store.ts  saves.ts  selectors.ts  settings.ts
│  ├─ assets/   registry.ts  procedural/crest.ts  procedural/avatar.ts  procedural/kit.ts
│  ├─ audio/    AudioEngine.ts  commentary.ts  crowd.ts  music.ts
│  ├─ render3d/ MatchScene.ts  pitch.ts  stadium.ts  crowd.ts  players.ts  ball.ts  cameras.ts
│  │            choreographer.ts  replay.ts  quality.ts  weather.ts  topdown2d.ts
│  └─ ui/
│     ├─ styles/ tokens.css  global.css
│     ├─ components/  (Button, Card, Tabs, Table, Modal, Toast, Tooltip, Badge, AttrBar, OvrBadge,
│     │               Crest, Portrait, KitIcon, PitchBoard, Sparkline, StatCompare, Meter,
│     │               ProgressSteps, KeyHint, ContinueButton, Sidebar, TopBar, EmptyState, ConfirmDialog)
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
export type Duty = 'Defend'|'Support'|'Attack';
export interface TeamInstructions {
  mentality: Mentality; passing: PassingStyle; tempo: Tempo; pressing: Pressing;
  line: DefLine; width: Width; focus: Focus;
}
export interface Tactics {
  formation: Formation;
  lineup: (PlayerId | null)[];      // length 11, index = slot index in formations.ts
  duties: Duty[];                   // length 11
  bench: PlayerId[];                // 0–9
  captain: PlayerId | null;
  takers: { penalty: PlayerId|null; freeKick: PlayerId|null; corner: PlayerId|null };
  instructions: TeamInstructions;
}
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
- **Top bar** (64 px): crest + club name (left); centre: "Matchday 7 of 18 · 3rd place · 14 pts"; right: balance, inbox icon with unread count, settings gear, **Continue** button (accent, always visible, label changes: "Continue", "Go to Match", "Kick Off", "Next Round", "Finish Window").
- **Sidebar** (232 px, collapsible to 72 px icons below 1440 wide): Hub, Squad, Tactics, Training, Transfers (only enabled during windows; otherwise shows "Scouting" list read-only), League, Fixtures, Club (Finances + Board), Inbox.
- **Keyboard:** `Space` Continue / confirm primary; `Esc` close modal / back / pause match; `1`–`9` sidebar items in order (outside the match); in match: `P` pause, `1` `2` `3` speed (Key highlights, Extended, Full), `T` tactics panel, `S` substitutions, `C` cycle camera, `R` replay last goal, `H` hide HUD, `F` fullscreen, `I` instant result (with confirm). Show key hints (KeyHint component) next to every primary button.
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
- Header: portrait (256²), name, number, positions with familiarity chips, age, nationality flag (simple CSS flag or emoji-free SVG; no flag assets needed: draw horizontal/vertical tri-bands per nation in `procedural/flags.ts`), height, foot, personality, OVR badge, potential stars, value, wage, contract, squad role.
- Tabs: **Attributes** (three columns Technical/Physical/Mental, plus Goalkeeping for GKs; each AttrBar coloured per §19.4; for unscouted other-club players show ranges e.g. "60–72", §12.12), **Stats** (season table + last 5 matches ratings sparkline), **Status** (condition, fatigue, morale with reasons list "Won last match +6", injury details, suspension), **History**.
- Actions (own players): Set as captain, Set as taker (penalty/free kick/corner), Transfer list / Remove, Not for sale, Individual training focus (dropdown of attributes, §12.3), Talk to player (opens conversation if allowed: max 1 per player per matchday).
- Actions (other players): Scout (in windows), Make offer (in windows), Shortlist toggle.

### 11.8 Tactics
- Left: **PitchBoard** (2D SVG pitch, vertical orientation, own goal at bottom) with 11 draggable player tokens (shirt colour, number, surname, OVR at slot coloured by fit: green ≥ natural, amber 0.8–0.95, red < 0.8). Drag a token onto another to swap; drag from the bench list onto a token to replace.
- Right: formation dropdown (7), familiarity meter for the selected formation, the seven instructions as three-way segmented controls with a one-line description each (§13.10), duties per slot (click token → Defend/Support/Attack), captain, takers.
- Bench: up to 9 players, list with drag handles.
- Buttons: **Assistant picks best XI** (§13.13 algorithm), **Reset to club style**, Presets: "Park the bus" (Defensive, Direct, Slow, Low, Deep, Narrow, Centre), "Control" (Balanced, Short, Slow, Mid, Normal, Normal, Mixed), "Gegenpress" (Attacking, Short, Fast, High, High, Normal, Mixed), "Counter" (Defensive, Direct, Fast, Low, Deep, Wide, Mixed), "All-out attack" (Attacking, Mixed, Fast, High, High, Wide, Mixed).
- Validation (blocks Kick Off with a clear message): exactly 1 GK in the GK slot, 11 starters, no injured/suspended player in XI or bench, no duplicates.

### 11.9 Training
- Team focus (6 cards with icons and effect descriptions from §12.3), intensity (Light/Normal/Hard with injury-risk and recovery indicators).
- Individual focus table: players with a dropdown of attributes (or "None").
- "Last week" panel: growth summary (players who improved, with +OVR), training injuries.

### 11.10 Transfers (only in windows)
- Header: window name, "Day 1 of 3 / Day 2 of 3 / Deadline Day" stepper, transfer budget remaining, wage budget used/total, squad size N/26 (min 16, 2 GK).
- Tabs: **Search** (all non-own players + free agents; filters: position group, age range, OVR range (estimated for unscouted), max value, club; columns: name, club, pos, age, OVR (or range), value, wage, contract), **Shortlist**, **Offers** (my bids with status; incoming bids for my players with Accept/Reject/Counter), **Scouting** (queue up to 2 per day; results next day).
- Make Offer dialog: fee input with +/− steps (5% of value), shows "Asking price estimate: high/fair/low" only after scouting the player OR if the club's response was a counter; then on acceptance → Contract dialog: wage, years (1–4), role promise (Star/Starter/Rotation/Backup), signing on.
- "Advance day" button (Continue) resolves AI responses and AI activity (§12.13). After Deadline Day the window closes.

### 11.11 League
Tabs: **Table** (full table with form, positions coloured: 1st gold edge, 2–3 accent edge, bottom 2 red edge), **Results by matchday** (selector 1–18), **Stats** (top scorers, assists, average ratings (min 5 apps), clean sheets (GK), yellow/red cards), **Clubs** (club cards: click → club page with squad (estimated OVRs), stadium, manager, form).

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

### 11.22 Settings (modal)
Audio: master, music, crowd, commentary, effects (sliders 0–100), commentary voice on/off (captions stay). Gameplay: default match speed, auto-continue after highlights (on/off), confirm before Instant Result. Graphics: Quality Auto/Low/Medium/High, show FPS. Accessibility: reduce motion, larger UI text (+12.5%), colour-blind-friendly attribute colours (blue→orange scale). Data: export save (JSON download), import save, delete saves.

### 11.23 Credits
Game by [entrant name] — leave a placeholder constant `CREDITS` in `constants.ts` that the user fills in. Lists collaborators, "Voices: ElevenLabs", "Images: fal", "3D models: Meshy", fonts (Barlow Condensed, Inter — SIL OFL), three.js (MIT), React (MIT). Show license notices.

### 11.24 Tutorial (first season, can be turned off)
Seven coach-marks shown by the assistant in a speech-bubble component, each once: (1) Hub overview, (2) Continue button, (3) Tactics: drag a player, (4) Assistant Apply button in Pre-Match, (5) Team talk, (6) Match HUD controls (speed, subs, camera), (7) Week summary and board meter. "Skip tutorial" always visible.

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
- Duty Attack: move 10% of MID → ATT; Defend: 10% of MID → DEF (and ATT → MID for forwards).
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
**Goal kicks** → defenders' possession in DEF Centre (Passing Direct: 60% long instead).
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
  | { kind: 'formation'; side: Side; formation: Formation; lineup: (PlayerId|null)[]; duties: Duty[]; issuedAtT: number }
  | { kind: 'sub'; side: Side; outId: PlayerId; inId: PlayerId; slot: number; issuedAtT: number };
```
- Instructions/formation take effect at the first step starting at or after `issuedAtT + 30` (a touchline shout).
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
- **Lighting**: Night/Evening: a hemisphere light (low), 4 spot/directional lights from the floodlight positions (only one casts shadows), skybox dark gradient with a faint star field. Afternoon: one directional "sun" (casts shadows), hemisphere light, sky gradient. Rain: particle system (instanced lines, 3k Medium / 8k High, none on Low), wet-grass darker tint, ground specular up.
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
| ≥ 50% of opponent's ATT-third entries come through one of our flanks and they had ≥ 3 shots from it | "They're getting joy down our {lane}. Tell {fullback} to stay back." → that FB duty Defend; if already, Width Narrow |
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
Contexts: PRE_DERBY, POST_WIN, POST_BIG_WIN, POST_DRAW, POST_LOSS, POST_BIG_LOSS, POST_UPSET_WIN (beat a team with rep ≥ ours + 2), STREAK_WIN, STREAK_LOSS, PLAYER_PRAISE (MOTM rating ≥ 8.5), PLAYER_CRITICISM (a starter rated ≤ 5.5), TRANSFER_RUMOUR, OPENING_DAY. At least 4 questions per context (≥ 52 total), 3 answers each with effects on fans (−5..+5), board (−3..+3), squad morale (−4..+4) or one player's morale (−8..+8), plus optional conditional effects resolved on the next match (e.g. Confident → if lost next match, fans −3). `voText` has no tokens (voice audio uses it).
The journalist: 3 fictional journalists with names, outlets and portraits (`images/people/journalist_{1..3}.webp`), e.g. "Priya Natarajan, Meridian Sport", "Joe Kettering, The Saltmere Echo", "Femi Adebayo-Clarke, Coastline Radio".

### 16.3 Team talks (`talks.json`)
For each context × tone: 3 alternative manager lines (what the manager says, shown in a speech bubble) and 4 player reaction lines (positive, neutral, negative, mixed). 9 contexts × 6 tones × 3 = 162 manager lines minimum.

### 16.4 Conversations (`conversations.json`)
Per §12.9: types `playing_time`, `contract`, `unhappy`, `praise`, each with ≥ 3 openings and 3 reply options with effects and follow-up lines.

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

---

## 17. Audio (`src/audio/`)

### 17.1 Engine
Web Audio API. One `AudioContext` created on the first user gesture. Buses: master → [music, crowd, commentary, sfx], each a GainNode wired to settings. Decode buffers once and cache. Missing files (not in the manifest) are skipped silently.

### 17.2 Music
`music/title_theme.mp3` (title), `music/menu_loop.mp3` (all management screens, −6 dB), stop during matches; `music/season_end.mp3` on the season-end sequence. Crossfades 1.5 s.

### 17.3 Crowd and SFX (match)
- Loops: `crowd/ambience_calm.mp3`, `crowd/ambience_tense.mp3` crossfaded by `danger` = 0 (ball in own DEF third) → 1 (ball in the opponent box), smoothed over 1.5 s. Home-side bias: the crowd swells (+3 dB) on home attacks.
- One-shots: `crowd/goal_roar.mp3` (home goals full, away goals at −8 dB plus `crowd/away_cheer.mp3`), `crowd/groan_miss.mp3`, `crowd/ooh_save.mp3`, `crowd/boo_foul.mp3`, `crowd/chant_{1..4}.mp3` (random every 60–120 s), `sfx/whistle_short.mp3`, `sfx/whistle_long.mp3` (HT/FT ×3 pattern for FT), `sfx/kick_{1..4}.mp3` (pass/shot, shot louder), `sfx/net.mp3`, `sfx/post.mp3`, `sfx/header.mp3`, `sfx/ui_click.mp3`, `sfx/ui_confirm.mp3`, `sfx/ui_error.mp3`, `sfx/notification.mp3`, `sfx/camera_shutter.mp3` (press conference).
- Spatial: kicks panned by ball x relative to the camera (StereoPannerNode, ±0.6).

### 17.4 Voice
- Commentary queue with priorities (importance). If a line is still playing and a higher-importance event arrives, fade the current line out over 150 ms. Drop lines older than 3 sim seconds at the moment they would start. During time-lapse gaps, no PBP except goals in other games ("Meanwhile, at Furnace Park…" lines `OTHER_GOAL`, 6 lines, nameSlot none, club names spoken via `vo/clubs/{clubId}.mp3` appended after).
- Duck crowd by −6 dB and music by −10 dB while voice plays.
- Assistant stingers: `vo/assistant/stinger_{1..6}.mp3` ("Gaffer!", "Boss, a word.", …), and voiced fixed lines for greetings, half-time openers, post-match openers (ids in `assistant.json` with `"voiced": true`).
- Press: `vo/press/{questionId}.mp3` from `voText`.

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
| `textures/grass_albedo.webp` (1024²), `textures/crowd_atlas.webp` (2048², 4×4 cells), `textures/ad_boards.webp` (2048×128) | WebP | |
| `images/portraits/{playerId}.webp` | 256×256 WebP | 280 files |
| `images/crests/{clubId}.webp` | 512×512 WebP, transparent | 10 files |
| `images/people/{assistant,chairman_{clubId},journalist_{1..3},manager_{clubId}}.webp` | 512×512 WebP | |
| `images/news/{clubId}_{scenario}.webp` | 1024×576 WebP | 40 files |
| `images/stadium/{clubId}.webp` | 1280×720 WebP | 10 files |
| `images/ui/title_bg.webp`, `images/ui/board_room.webp`, `images/ui/press_room.webp` | 1920×1080 WebP | |
| `images/ui/logo.webp` | transparent WebP | game logo when the name is final |
| `audio/music/*.mp3`, `audio/crowd/*.mp3`, `audio/sfx/*.mp3` | MP3 128–192 kbps | names in §17 |
| `audio/vo/commentary/{lineId}.mp3`, `audio/vo/names/{playerId}.mp3`, `audio/vo/clubs/{clubId}.mp3`, `audio/vo/assistant/{lineId}.mp3`, `audio/vo/press/{questionId}.mp3` | MP3 64–96 kbps mono | generated from your content files; ids MUST match |

### 18.3 Player model contract (`models/player.glb`)
- Humanoid, 1.80 m tall, origin at the feet, facing +Z, ≤ 12,000 triangles, one skinned mesh (or a few sharing one skeleton), ≤ 60 bones.
- Materials named exactly: `Shirt`, `Shorts`, `Socks`, `Skin`, `Hair`, `Boots`. Base colours white/neutral so tinting works (shirt texture slot used for patterns/numbers).
- Animation clips named exactly: `Idle`, `Jog`, `Run`, `Sprint`, `Pass`, `Shoot`, `Header`, `Tackle`, `Throw`, `Celebrate`, `Dejected`, `GK_Idle`, `GK_DiveLeft`, `GK_DiveRight`, `GK_Catch`. Missing clips fall back in this order: Sprint→Run→Jog→Idle; Shoot→Pass; Header→Idle; Tackle→Run; Throw→Idle; Celebrate→Idle; GK_*→Idle.
- In-place locomotion (no root motion).

### 18.4 What you build vs what Claude builds
| You (Gemini) | Claude |
|---|---|
| All code, content JSON text, procedural fallbacks (crest, avatar, kit, flags, pitch, stadium boxes, capsule players), registry, audio engine | Meshy models, fal images, ElevenLabs voices/SFX/music, `tools/` scripts, `asset-manifest.json` updates, art direction and UI design references |

Procedural fallbacks MUST look intentional: crest = shield SVG with the club's colours, a simple emblem from a set of 8 shapes (anchor, hammer, bird, wave, gate, flame, tree, crow) chosen per club, and the club code; avatar = head-and-shoulders silhouette in kit colours with initials.

---

## 19. UI design system

### 19.1 Direction
Broadcast sports TV meets premium dark dashboard: deep navy surfaces, crisp condensed uppercase headings, one neon pitch-green accent, gold for honours, generous spacing, bold numbers. Club colours appear as accents (crest backgrounds, header stripes) on top of the neutral system. Never copy the look of an existing game's UI.

### 19.2 Tokens (`tokens.css`)
```css
:root {
  --bg: #070C18; --surface: #0F1729; --surface-2: #16213A; --surface-3: #1D2B4A; --border: #263557;
  --text: #F3F6FB; --text-dim: #9CA9C4; --text-faint: #66748F;
  --accent: #00E58F; --accent-ink: #032B1C; --gold: #FFC83D; --info: #3DA5FF;
  --win: #18C77A; --draw: #9CA9C4; --loss: #FF4D5E; --warning: #FFB020; --danger: #FF4D5E;
  --club-primary: #0B1F3A; --club-secondary: #F2B705;   /* set from the user's club at runtime */
  --radius-s: 6px; --radius-m: 10px; --radius-l: 16px;
  --shadow-1: 0 1px 2px rgb(0 0 0 / .35); --shadow-2: 0 8px 24px rgb(0 0 0 / .45);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-7: 48px;
  --font-head: 'Barlow Condensed', system-ui, sans-serif; --font-body: 'Inter', system-ui, sans-serif;
  --dur-fast: 150ms; --dur-med: 250ms; --dur-slow: 400ms; --ease: cubic-bezier(.2,.8,.2,1);
}
```
Dark only. `body { background: var(--bg); color: var(--text); }`.

### 19.3 Typography
Headings: Barlow Condensed 700 uppercase, letter-spacing 0.02em; sizes H1 48, H2 32, H3 24, H4 20. Body: Inter 400/500/600; sizes 16 (default), 14 (tables), 12 (captions). All numbers in tables and stats: `font-variant-numeric: tabular-nums`. Big stat numbers: Barlow Condensed 600.

### 19.4 Data colours
Attribute/OVR scale: 1–39 `#FF4D5E`, 40–54 `#FF8A3D`, 55–64 `#FFC83D`, 65–74 `#9BE15D`, 75–84 `#18C77A`, 85–99 `#00E5D1`. Colour-blind mode: `#D55E00`, `#E69F00`, `#F0E442`, `#56B4E9`, `#0072B2`, `#CC79A7`. Ratings (match): < 6.0 loss colour, 6.0–6.9 text, 7.0–7.9 win colour, ≥ 8.0 gold. Form dots: W win, D draw, L loss.

### 19.5 Components (behaviour)
- **Button** variants: primary (accent bg, accent-ink text), secondary (surface-3), ghost, danger; sizes S/M/L; loading state; disabled with tooltip-on-focus reason.
- **ContinueButton**: primary L with KeyHint "Space", subtle pulse every 6 s when idle > 10 s (off with reduce motion).
- **Card**: surface, radius-l, 1 px border, optional club-colour top stripe 4 px.
- **Table**: sticky header, zebra rows (surface/surface-2), row hover surface-3, sortable headers with arrow, keyboard navigation.
- **Modal**: centred, max 960 px, Esc closes, focus trap, backdrop blur 6 px.
- **Toast**: bottom-right stack, 4 s, types info/success/warning/error.
- **Tooltip**: on hover and focus, 300 ms delay, max 280 px.
- **Meter**: 0–100 bar with coloured thresholds and trend arrow.
- **PitchBoard**: SVG, responsive, drag with pointer events (mouse), keyboard: select token with Enter, arrows move selection between slots, Enter on a second slot swaps.
- **StatCompare**: two-sided bars for match stats.
- **Sparkline**: inline SVG.

### 19.6 Layout
Shell: grid `232px | 1fr` (sidebar collapses to 72 px under 1440 wide), top bar 64 px. Content max width 1600 px, padding 24 px (16 px under 1280). Cards grid: 12 columns, gap 16 px. Every screen MUST be checked at 1280×720, 1920×1080 and 2560×1440 (§22.4).

### 19.7 Motion
Screen transitions 250 ms fade + 8 px rise. List items stagger 20 ms (max 10 items). Respect `prefers-reduced-motion` and the reduce-motion setting (no transforms; fades ≤ 150 ms).

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
- Every interactive element has hover, `:focus-visible` (2 px accent ring, 2 px offset), active, disabled and loading states.
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

### 20.2 Versioning
`SAVE_VERSION = 1`. `core/game/migrations.ts` exports `migrate(raw): GameState` with a switch per version (only v1 for now) and a test. Unknown future versions → friendly error "This save is from a newer version."

### 20.3 Autosave
After WeekSummary is generated, after each transfer window round, and at SeasonEnd. Never during a match (a match in progress that is interrupted resumes from PreMatch: the fixture is replayed from the start with the same seed — deterministic, so the outcome is only different if the user changes decisions).

### 20.4 Export/import
Export: download `touchline-save-<club>-md<matchday>.json`. Import: file picker → validate shape (`version`, required keys) → write to a chosen slot.

### 20.5 Settings defaults
master 80, music 50, crowd 70, commentary 85, effects 70, voice on, speed Key highlights, auto-continue off, confirm instant on, quality Auto, FPS off, reduce motion = system preference, larger text off, colour-blind off.

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
1. Store actions for every phase (§10) and `advance.ts`.
2. Screens: New Game (§11.3), Board Meeting, Hub, Squad, Player Profile, Tactics (PitchBoard with drag/swap and keyboard), League, Fixtures, Club (finances/board basic), Inbox, Week Summary, Season End (basic), Sacked.
3. A temporary **text match view**: event feed with clock and score, speed control, subs/tactics overlays working through the worker with commands.
4. Autosave and Continue from title.
**Accept:** a complete 18-matchday season can be played start to finish via the text match view; save/reload mid-season works; season end shows table and grade; screenshots saved and the M3 design review (§19.8) is passed.

### M4 — 3D match day (1–5 Dec)
1. Scene skeleton with fallbacks: pitch, lines, goals, boxes stadium, capsule players, ball, lights, quality presets, resize, disposal.
2. Choreographer (§14.3) and steering; ball flight.
3. Playback modes and highlight selection (§14.1, §14.6); time-lapse overlay with 2D radar.
4. Cameras (§14.4) incl. free orbit; goal replays (§14.7).
5. HUD (§11.16), half-time and full-time screens (§11.17–11.18), shot map, momentum chart.
6. Swap in real models automatically when present (registry), animations per §18.3.
**Accept:** a match at Key highlights takes 50–80 s real time; goals visibly match the events (the scorer is the one shooting, the ball ends in the net); 60 fps Medium on the dev laptop; 5 matches in a row without memory growth; every "game feel" detail in §19.8 is present; M4 design review passed.

### M5 — Systems depth (5–8 Dec)
1. Training (§12.3), development (§12.4), condition/fatigue (§12.1–12.2), injuries (§12.5), discipline (§12.6).
2. Morale and team talks (§12.8) in Pre-Match, Half-Time, Full-Time.
3. Press conferences (§12.6 triggers, §16.2).
4. Conversations (§12.9).
5. Board and fans (§12.7, §12.14), finances (§12.10).
6. Transfer windows complete (§12.13) with scouting (§12.12) and AI activity; news (§16.6).
**Accept:** every system visibly changes something the player can see within a season; transfer window rounds behave per the tests; content files meet minimum counts.

### M6 — Assistant and audio (8–10 Dec)
1. Advice engine (§15) with Apply actions in Pre-Match, Hub, match drawer, Half-Time, post-match.
2. Audio engine, buses, settings wiring, crowd danger mix, SFX hooks, music.
3. Commentary selection and caption strip; voice chaining (names + lines) with ducking.
**Accept:** in a test match, at least 3 assistant advices fire and Apply changes the engine (visible in the next events); audio works with and without asset files; commentary captions never overlap or lag more than 1 s.

### M7 — Onboarding, polish, season end (10–12 Dec)
1. Tutorial (§11.24). 2. Season End sequence complete with awards and share card (§11.20, §12.15–12.16). 3. Save slots, export/import, Load screen. 4. Credits. 5. Visual polish pass on every screen against §19 (spacing, empty states, loading states). 6. Run QA checklist §22.4 and fix.
**Accept:** QA checklist all pass except items blocked by missing final assets; a new player can finish a season without reading any docs; M7 design review passed.

### M8 — Asset integration and performance (12–15 Dec)
1. Integrate Claude's delivered assets (they appear in the manifest; verify every path is consumed). 2. Performance pass against §21 (profile, fix). 3. Offline test, no 404s. 4. Final content proofreading. 5. Feature freeze on 15 Dec.
**Accept:** budgets §21.1 met and recorded; QA checklist all pass.

### M9 — Ship (15–17 Dec)
1. `npm run check` clean; `npm run build`; `vite preview` smoke test.
2. Hand over to Claude Code for `opengame check --build` and deploy (Gemini is not a supported OpenGame agent). Fix any findings it reports.
3. Optional: OpenGame SDK leaderboard for the season score (only if the SDK docs from `opengame setup` describe it; must not require sign-in and must work offline by failing silently).
**Accept:** the published entry plays from a fresh browser; submitted before 17 Dec 23:59 PT (one day of margin).

---

## 24. Out of scope (do not build) and stretch goals

Out of scope for the jam build: online multiplayer, accounts, real-time "day/week" persistent modes, loans, youth academy intake, cups, staff hiring, stadium upgrades, editor, mobile/touch.

Stretch (only after M8 passes, in this order):
1. **Career mode**: continue to Season 2+ with ageing, retirements, contract expiries, regens (new fictional players generated with a separate seed and generic commentary lines), and the board's new expectation.
2. **League Cup**: 8-team knockout (top 8 by reputation), single matches on matchdays 5, 11, 15.
3. **Weather and pitch wear visuals** (worn goalmouths over the season).
4. **"Create your own club"** (name, colours, crest emblem; takes the place of Veldmoor Town).
5. A lean optional server for live AI press conferences (would need the jam's "keys stay on your server" rule and an offline fallback).

---

## 25. Glossary
- **OVR**: overall rating at a position (§9.5). **Potential**: hidden OVR ceiling.
- **Step**: one possession action in the engine. **Highlight window**: a time span of events shown in Key/Extended playback.
- **z-units**: normalised attribute units `(a − 50)/25` used in contest formulas.
- **xG_ref**: public reference expected-goals value of a shot context.
- **Snapshot**: serialised engine state used for resume and command rewinds.
- **Manifest**: `public/asset-manifest.json`, the list of delivered asset files.
