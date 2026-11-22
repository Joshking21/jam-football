# Project context for Claude

## What this is
A browser football management game (working title **Touchline**, real name not chosen yet) for **OpenGame Game Jam #1** (opengame.io/jam). Entries close **18 Dec 2026, 23:59 PT**. We aim to submit by 17 Dec. Track: Simulation & management.

The user and a friend are making 4 games for the jam: each of them enters 2 (the jam has no teams; collaborators are credited on the game page). This football game is game #1 and the user's entry.

## Who does what
- **Gemini** (Gemini CLI, the user's tokens) writes most of the code by following `docs/SPEC.md`, task by task (§23 milestones), logging in `docs/PROGRESS.md` and `docs/DECISIONS.md`. Its own rules are in `GEMINI.md`.
- **Claude** (you):
  - design mock-ups of the key screens in `docs/design/`
  - design reviews at the M3, M4 and M7 gates: read the screenshots in `docs/screens/<milestone>/`, write fixes to `docs/design/REVIEW-<milestone>.md`
  - assets: Meshy 3D models, fal images, ElevenLabs voices/SFX/music, delivered to `public/assets/` with `public/asset-manifest.json` regenerated (contract: SPEC §18)
  - asset tools in `tools/`
  - the final `opengame check --build` and deploy (Gemini is not a supported OpenGame agent)
- **The user** reviews and decides, and holds the sponsor accounts. API keys go in `.env.local` (gitignored). Never print keys or put them in the build.

## Key jam rules (full summary in SPEC §1)
- The game must be made during the jam. **Never copy code from `C:\Users\Joshking\Desktop\FOOTBALL-MANAGER`** (the user's older "JFG" project); its ideas are already in the spec.
- Static web build, `index.html` at the root; first frame without our own server; review runs offline.
- Desktop, mouse and keyboard, must respond to window resizing. No API keys in the build, no sign-in, ads or payments.
- Judged on creativity, depth, fun, performance on an ordinary laptop, and visual fidelity. Sponsor tracks: ElevenLabs, fal, Meshy (3D models seen through a camera the player controls).

## Quality bar
The user explicitly wants nothing that looks or reads like generic AI output: thoughtful, crafted, flawless design. SPEC §19.8 is the enforced craft bar. Hold every review and every asset to it.

## Working preferences
- Ask before pushing to GitHub; batch pushes. (The repo is public on GitHub.)
- Images made for the user also go to `C:\Users\Joshking\Downloads`.
- Keep explanations short and plain.

## Status
- 2026-11-22 (later): more depth went into SPEC 1.7, all as new M5 tasks:
  - task 8: training in detail (§12.18)
  - task 9: set pieces in detail (§13.20)
  - task 10: touchline shouts, match plans and player traits (§13.21–13.23)

  Also: Tactics went back to the v3 sideways board ("v5 layout"), and a look-around camera was added to the rooms (§11.25.4). The separate out-of-possession shape is in §24 as one of the last items. **Gemini's schedule lead is now used up; I told the user to stop adding features.** The agbero game idea and the jam account rules are in memory. Commits up to b9ca4a7 are not pushed.
- 2026-11-22: new direction: an immersive 3D "living the coach's life" game. It is in **SPEC 1.7** (§11.25 club rooms, §14.11 people and painted faces, §17.4–17.5 voiced coach and room sound, §18.6 person.glb and face atlases, milestone M6b after M6; extras in §24), with the proposal record in `docs/design/SPEC-1.7-PROPOSAL.md`. The user's decisions: the coach always walks (skippable); the coach is voiced; a separate boardroom; tactics are planned in the office with Theo; Squad, briefings and talks are in the dressing room. **Credit risk:** voicing every coach line is about 350 lines, and with commentary it likely exceeds the ElevenLabs Starter plan; count it before generating. The user has fal credits, but `.env.local` doesn't exist yet. Gemini is on M5 (M5.1 committed); the M4 review is still owed. Nothing committed this session.
- 2026-11-20 (evening): SPEC 1.6 written: no sidebar anywhere, nav tabs in the top bar on every screen; office work screens fit with no page scroll; Tactics v4 layout = player file + RadarChart left, vertical board middle, orders right (docs/design/tactics/README.md "v4 layout"; no new mock-up, v3 is the look). Calibration checks are now bands with ceilings (§13.18.13). Gemini (uncommitted, still working): §13.19 defensive roles in roles.ts + engine, retuning K.d2.* (my quick run at 17:53: 13/14 in band, Familiarity drop 26 pts vs 6–14 FAILS), and started M3 fixes B1/B3/B4. Told the user to tell Gemini: capture states must play real matches (not fake results/awards). Next: check Gemini's full calibration report incl. §13.19.7, then the M3 second-pass review. Commits 6bc88f5..cdfabf4 not pushed. Still waiting on the user's Meshy/ElevenLabs payment and keys.
- 2026-11-20: **Read `docs/HANDOFF.md` first.** The user loves the Hub/Tactics design and now wants Football-Manager-level detail across the whole club. Next is a depth audit and a SPEC 1.4 proposal. Don't re-render the references until asked.
- 2026-11-19 (night): Hub and Tactics references done in `docs/design/hub/` and `docs/design/tactics/` (each index.html + README listing the SPEC differences that win). The Hub now has captains walking in (stand-ins for fal clips), telestrator marks and the Continue idle hop. Tactics has a sideways whiteboard with magnets and marker. All AI tests across fal/Meshy/ElevenLabs are listed in `docs/design/AI-TESTS.md` (outputs go to gitignored `tests-ai/`). Gemini had rebuilt the shell before the references existed (it skipped the M3 task 2 wait gate), so its UI needs reworking against them. Next: the user adds the sponsor keys; then run AI-TESTS in its stated order.
- 2026-11-19 (evening): first static Hub mock-ups rejected as generic. UI redesigned in SPEC 1.2 §19: broadcast ("on air") + manager's office ("behind the scenes"), club-colour theming, full motion system. Owed by Claude: an animated, clickable Hub reference in `docs/design/` when the user asks (they're saving tokens). Gemini picks the redesign up at M3 task 2.
- 2026-11-19 (later): art direction agreed and written to `docs/design/ART-DIRECTION.md` (realistic stadium and light, near-real players with simplified faces, programme-print portraits tinted per club). SPEC bumped to 1.1 (realism pass §14.10, portrait tint §18.5, manager.glb contract, brick/timber stand styles). Stand styles stay in scope but are made last. Next: the user sets up the sponsor keys; Claude then builds `tools/` and the test batch (ART-DIRECTION §7).
- 2026-11-19: repo created; SPEC v1.0, GEMINI.md and the log files written; first commit made and pushed to a public GitHub repo. Next: Gemini starts M0; Claude starts design mock-ups and the asset pipeline (waiting on the user's ElevenLabs/fal/Meshy accounts).
