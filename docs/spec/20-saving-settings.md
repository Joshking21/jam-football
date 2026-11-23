<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
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

