<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 1. Jam rules that bind the build

Source: opengame.io/jam and opengame.io/create, read 19 Nov 2026.

| Rule | What it means for us |
|---|---|
| Entries close 18 Dec 2026 23:59 PT; only the latest published build counts | Feature-freeze 15 Dec. Submit by 17 Dec. |
| The game must be made during the jam; no reuse of earlier game-specific code | Fresh repo (this one), fresh code, git history from 19 Nov. |
| Static files, `index.html` at the root of the build folder | Vite build to `dist/` with `base: './'`. |
| Must run with nothing to install and draw its first frame without its own server; review runs offline | No runtime network. All assets local. |
| Desktop only; fully playable with mouse and keyboard; must respond to window resizing | §19.6 layout, §11.0 keyboard map, resize handling everywhere including the 3D canvas. |
| No API keys in the build; no sign-in, email walls, ads, payments | AI voice/images/models are generated before build by Claude's tools and shipped as files. |
| Judging, equally weighted: creativity/originality, depth, fun, performance (load speed, smoothness on an ordinary laptop), visual fidelity | §2 pillars map to these. Performance budgets in §21 are MUSTs. |
| Sponsor tracks: ElevenLabs (voice/sound), fal (images/video/audio/3D), Meshy (3D models that hold up under a player-controlled camera) | Commentary/assistant/press voices (ElevenLabs); portraits, crests, newspaper images (fal); players, stadium, goals (Meshy); free-orbit match camera (§14.5). |
| Size cap 4 GB zipped / 25,000 files | Our target is under 120 MB and under 2,000 files. |
| Tracks | Enter "Simulation & management". |
| Supported submission agents: Claude Code, Codex, Cursor, OpenCode | The final OpenGame check/deploy (M9) is run by Claude Code, not Gemini. Gemini prepares the build. |

---

