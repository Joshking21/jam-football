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
- 2026-11-19: repo created; SPEC v1.0, GEMINI.md and the log files written; first commit made and pushed to a public GitHub repo. Next: Gemini starts M0; Claude starts design mock-ups and the asset pipeline (waiting on the user's ElevenLabs/fal/Meshy accounts).
