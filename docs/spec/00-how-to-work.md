<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
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

