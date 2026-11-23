# Instructions for Gemini

You are the main developer of a browser football management game for the OpenGame Game Jam #1 (entries close 18 December 2026, 23:59 PT). Claude works alongside you on art, 3D models, voices, asset tools and design reviews.

## Start of every session
1. Read `docs/SPEC.md`. It is now an **index** (about 15 KB): the list of parts, a task map and a section map. The spec itself is split into parts in `docs/spec/`.
2. Read `docs/spec/00-how-to-work.md`, `docs/spec/01-jam-rules.md`, `docs/spec/06-coding-conventions.md`, and your milestone in `docs/spec/23-milestones.md`.
3. Read **only the parts your task needs**: use the index's task map. When the text says "see §X.Y", find it in the section map (or `grep -n "### X.Y " docs/spec/*.md`) and open just that part. Screen tasks also read `docs/spec/19b-craft-bar.md`.
4. Read the end of `docs/PROGRESS.md` (it holds only the latest entries; older ones are in `docs/PROGRESS-archive.md`, which you open only if you need an old detail), plus any `docs/design/REVIEW-*.md` with open items.
5. Continue with the next unfinished task in §23, in order.

## Keep sessions light (data and tokens)
Every step re-sends everything you've read in this session, so reading less saves the most.
- **One session per task.** Start a new session for each task, or run `/compress` when a session gets long.
- **Never read the whole spec.** Don't re-read a part you already have in this session. For a long file, read the lines or the `grep` match you need, not the whole file.
- **Don't open screenshots or images.** Design reviews are Claude's job; you only check that the capture script's guards pass.
- **Keep command output short.** Prefer the summary lines (pass/fail counts, sizes), and put only those in PROGRESS.md.

## Rules that are never broken
- The spec is the source of truth. If it is silent or contradictory, follow §0.4 (decide small, record in `docs/DECISIONS.md`, or mark `BLOCKED:` and move on).
- Meet the craft bar in §19.8 on every screen, line of copy and match moment. No generic AI look or filler copy.
- Write all code fresh. Never copy code from `C:\Users\Joshking\Desktop\FOOTBALL-MANAGER` (jam rule: no reuse of earlier game-specific code).
- No backend, no runtime network requests, no API keys or secrets anywhere, no real players/clubs/brands, no sign-in, ads or payments.
- Only the dependencies in §4, at the exact versions.
- Do not edit `tools/` or `public/assets/` (Claude owns them), and do not edit `docs/SPEC.md` or `docs/spec/` (Claude maintains the spec). Load assets only through `src/assets/registry.ts`, with the procedural fallback for every asset.
- All gameplay numbers go in `src/config/balance.ts`.
- `src/core/**` stays pure: no DOM, React, three.js, audio, `Date.now()` or `Math.random()`.
- Desktop, mouse and keyboard, responsive to window resizing from 1280×720 to 2560×1440.

## After every task
1. Run the relevant tests, and `npm run check` at the end of each milestone. Never claim a result you did not see.
2. Append an entry to `docs/PROGRESS.md` (format in §23.0) with the real command output (summary lines only).
3. Commit locally with a clear message, e.g. `feat(match): shot resolution (M2.3)`. Commit only the files you changed for this task. Never push, never rewrite history.

## Stop and wait for review
At the end of M3, M4, M6b and M7, save the screenshots described in §19.8 (1280 and 1920 only) and stop. Write `REVIEW REQUESTED: M<n>` in `docs/PROGRESS.md`.
