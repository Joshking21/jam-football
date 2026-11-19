# Progress log

Newest entries at the bottom. Format: SPEC §23.0.

## 2026-11-19 · Setup
- Changed: created the repository, GEMINI.md, docs/SPEC.md, docs/PROGRESS.md, docs/DECISIONS.md, .gitignore
- Ran: nothing yet
- Notes: next task is M0.1 (scaffold).

## 2026-11-19 · M0 Foundation complete
- Changed: package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .prettierrc, .prettierignore, index.html, public/asset-manifest.json, src/config/constants.ts, src/config/balance.ts, src/core/types.ts, src/core/math.ts, src/assets/registry.ts, src/assets/procedural/crest.ts, src/assets/procedural/avatar.ts, src/assets/procedural/kit.ts, src/assets/procedural/flags.ts, src/state/settings.ts, src/state/saves.ts, src/state/store.ts, src/ui/components/Button.tsx, src/ui/components/Card.tsx, src/ui/components/ContinueButton.tsx, src/ui/components/Crest.tsx, src/ui/components/KeyHint.tsx, src/ui/components/KitIcon.tsx, src/ui/components/Modal.tsx, src/ui/components/Portrait.tsx, src/ui/components/Sidebar.tsx, src/ui/components/Toast.tsx, src/ui/components/TopBar.tsx, src/ui/screens/CreditsModal.tsx, src/ui/screens/DevGalleryScreen.tsx, src/ui/screens/SettingsModal.tsx, src/ui/screens/TitleScreen.tsx, src/ui/styles/tokens.css, src/ui/styles/global.css, src/App.tsx, src/main.tsx, tests/core/math.test.ts, tests/assets/registry.test.ts, tests/assets/procedural.test.ts, tests/state/settings.test.ts
- Ran: npm run check → format:check PASS, typecheck (tsc --noEmit) PASS, vitest run (4 test files, 11 tests passed in 2.80s), vite build (main chunk 203.84 kB / gzip 62.31 kB, built in 8.13s) PASS
- Notes: M0 acceptance criteria all verified. Next task is M1.1 (core math, types, rng, ids).
- Open issues: none

## 2026-11-19 · SPEC 1.1 (Claude, not a Gemini task)
- Changed: docs/SPEC.md (v1.1: new §14.10 realism pass, §18.3 manager.glb contract, §18.5 portrait tint, new §21.2 preset rows, M4 task 7, M8 task 1), docs/design/ART-DIRECTION.md (new)
- Ran: nothing (docs only)
- Notes: no change to M1–M3. The new work lands in M4 (task 7) and M8 (portrait tint). Use ART-DIRECTION.md §3 for render values and fallback colours.
