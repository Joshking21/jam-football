<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
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

