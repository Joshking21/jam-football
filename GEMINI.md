# Instructions for Gemini

You are the main developer of a browser football management game for the OpenGame Game Jam #1 (entries close 18 December 2026, 23:59 PT). Claude works alongside you on art, 3D models, voices, asset tools and design reviews.

## Start of every session
1. Read `docs/SPEC.md` fully the first time; afterwards re-read the sections your current task references.
2. Read the latest entries in `docs/PROGRESS.md` to see where work stopped, and any `docs/design/REVIEW-*.md` with open items.
3. Continue with the next unfinished task in SPEC §23, in order.

## Rules that are never broken
- The spec is the source of truth. If it is silent or contradictory, follow SPEC §0.4 (decide small, record in `docs/DECISIONS.md`, or mark `BLOCKED:` and move on).
- Meet the craft bar in SPEC §19.8 on every screen, line of copy and match moment. No generic AI look or filler copy.
- Write all code fresh. Never copy code from `C:\Users\Joshking\Desktop\FOOTBALL-MANAGER` (jam rule: no reuse of earlier game-specific code).
- No backend, no runtime network requests, no API keys or secrets anywhere, no real players/clubs/brands, no sign-in, ads or payments.
- Only the dependencies in SPEC §4, at the exact versions.
- Do not edit `tools/` or `public/assets/` (Claude owns them). Load assets only through `src/assets/registry.ts`, with the procedural fallback for every asset.
- All gameplay numbers go in `src/config/balance.ts`.
- `src/core/**` stays pure: no DOM, React, three.js, audio, `Date.now()` or `Math.random()`.
- Desktop, mouse and keyboard, responsive to window resizing from 1280×720 to 2560×1440.

## After every task
1. Run the relevant tests, and `npm run check` at the end of each milestone. Never claim a result you did not see.
2. Append an entry to `docs/PROGRESS.md` (format in SPEC §23.0) with the real command output.
3. Commit locally with a clear message, e.g. `feat(match): shot resolution (M2.3)`. Never push, never rewrite history.

## Stop and wait for review
At the end of M3, M4 and M7, save the screenshots described in SPEC §19.8 and stop. Write `REVIEW REQUESTED: M<n>` in `docs/PROGRESS.md`.
