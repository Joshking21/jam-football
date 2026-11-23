<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
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

