<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
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
│  ├─ physics/  world.ts  ball.ts  aim.ts  bodies.ts  contact.ts  ragdoll.ts  ik.ts  reach.ts
│  │            grass.ts  trample.ts  replayBuffer.ts   (§14.12, presentation only)
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

