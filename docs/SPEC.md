# TOUCHLINE (working title) — Complete Build Specification

Version 1.7 · 22 November 2026 · Target: OpenGame Game Jam #1 (entries close **18 December 2026, 23:59 PT**)

This is the single source of truth for building the game. It is written for an AI coding agent (Gemini) doing most of the implementation, with Claude producing art, models, audio and asset tools in parallel. Every number, file path, screen and rule needed to build the game is here. If something you need is missing, follow §0.4. Do not invent it silently.

**Changes in 1.7 (22 Nov):** the game becomes a club you live in. Every screen sits in a room of one 3D club building (office, boardroom, dressing room, tunnel, training ground, press room). The coach walks between rooms, and the player can look around each room with the mouse (§11.25). People share one rig and have painted face layers whose mouths move with their voices (§14.11). Players knock on the office door for conversations, Theo the assistant is a visible person, and the match gets touchline cuts of the coach and bench (§14.11). The coach is voiced (§17.4), and every room has its own sound (§17.5). New content file `club.json` (§16.9), asset contracts (§18.2, §18.3, §18.6), budgets (§21), and milestone **M6b** (§23). Depth still comes first: rooms frame the screens and never replace them. **Training in detail** (§12.18, M5 task 8): a planned week of sessions, personal plans, one-to-ones, training ratings and progress. **Set pieces in detail** (§13.20, M5 task 9): player jobs, routines, takers by foot, free kicks by area, defending corners and free kicks. **Touchline shouts, match plans and player traits** (§13.21–13.23, M5 task 10). **Injury and discipline decisions** (§12.19–12.20, M5 task 11): knocks, rushing players back, warm-up scares, and incidents (late, sent off, press, bust-ups) with fines, drops and warnings. Referees, contract talks and matchday atmosphere are in §24 as real-life extras, if time allows. **Free walking** (WASD coach, E to interact) is the top-priority extra in §24; M6b is built so it can be added without rework. A separate shape without the ball is listed in §24 as one of the last items. **Tactics returns to the sideways board** (v3 look, "v5 layout", §11.8); the v1.6 vertical three-column layout is withdrawn. Proposal record: `docs/design/SPEC-1.7-PROPOSAL.md`.

**Changes in 1.6 (20 Nov):** the sidebar is gone: navigation moves into the top bar as tabs (§11.0, §19.6) on **every** screen, on air and office alike, like Football Manager. Office work screens fit the window with no page scroll. Tactics becomes three columns around a vertical board: the player's file (who he is) on the left, his orders (what he's told) on the right (§11.8, layout in `docs/design/tactics/README.md` "v4 layout"). New component RadarChart: the player's shape against what his role needs (§19.5).

**Changes in 1.3 (19 Nov):** new §13.17 Tactical depth: player roles with fit (replace duties), opposition orders, transition and goalkeeper-distribution settings, corner routines, player instructions, key battles, AI and assistant rules, extra calibration checks including "no dominant choice". Tactical depth now outranks visual polish when time is short. Related edits: §8.4 types, §11.8, §13.5, §13.8, §13.12, §15.4, M3 task 0.

**Changes in 1.2 (19 Nov):** the UI design system is rewritten (§19.1–19.7): the game is a broadcast ("on air") plus the manager's office ("behind the scenes"); the accent is now the user's club colour (club theme table, §19.2), the neon green is gone; new base palette, sharper shapes, the sidebar rundown, a ticker, and a full motion system (screen transitions, springs, count-ups, table reorders, stamps, magnets) with performance and reduce-motion rules. Related edits: §11.0 sidebar order and keys, §11.7 player file, §11.8 tactics whiteboard, §17.3 UI sounds, §19.8 focus ring, M3 task 2 (rework the M0 shell).

**Changes in 1.1 (19 Nov):** new §14.10 Realism pass (post-processing, environment lighting, light beams, haze, grass, wet pitch); new rows in the §21.2 presets table; portraits are delivered greyscale and tinted per club at runtime (§18.2, §18.5); `textures/grass_normal.webp` and optional brick/timber stand models added (§18.2); `manager.glb` contract (§18.3); M4 task 7 and M8 task 1 updated. The look of every model and image is defined in `docs/design/ART-DIRECTION.md`; fallbacks SHOULD follow its colours and lighting values.

---

---

## How to read this spec (v1.7, 22 Nov: the spec is split into parts)

The spec used to be one 290 KB file. Reading all of it on every step was slow and very expensive, so it's now split into the parts below. **The rules and numbers are unchanged:** the split only moved text between files.

1. **Every session:** read this index, `spec/00-how-to-work.md`, `spec/01-jam-rules.md`, `spec/06-coding-conventions.md`, and your milestone in `spec/23-milestones.md`.
2. **Then read only the parts your task needs.** Use the task map below. When a part says "see §X.Y", look up §X.Y in the section map and open only that file (or `grep -n "### X.Y " docs/spec/*.md`).
3. **Don't read the whole spec.** Don't re-read a part you already have in this session.
4. **Screen tasks** also read `spec/19b-craft-bar.md` and the design README the task names.
5. Section numbers (§) are unchanged, so every cross-reference still works.

## Parts

| File | Covers | Size | Read when |
|---|---|---|---|
| `spec/00-how-to-work.md` | §0 How to work with this document | 3 KB | every session, once |
| `spec/01-jam-rules.md` | §1 Jam rules | 2 KB | every session, once |
| `spec/02-game-in-one-page.md` | §2 The game in one page | 2 KB | new session context |
| `spec/03-tech-constraints.md` | §3 Hard technical constraints | 1 KB | when touching build or loading |
| `spec/04-tech-stack.md` | §4 Tech stack | 2 KB | when adding a dependency |
| `spec/05-repo-layout.md` | §5 Repository layout | 4 KB | when creating files or folders |
| `spec/06-coding-conventions.md` | §6 Coding conventions | 1 KB | every coding task |
| `spec/07-architecture.md` | §7 Architecture and data flow | 3 KB | when touching store, workers or data flow |
| `spec/08-data-model.md` | §8 Data model (types) | 11 KB | when changing types |
| `spec/09-world.md` | §9 The fixed world | 11 KB | world generation, clubs, players |
| `spec/10-game-flow.md` | §10 Game flow and calendar | 2 KB | phases, advance, fixtures |
| `spec/11a-screens.md` | §11.0–11.24 Screens | 16 KB | any screen work |
| `spec/11b-club-spaces.md` | §11.25 Club spaces (3D rooms, walks, look around, talk scenes) | 8 KB | M6b, any talk scene |
| `spec/12a-management-core.md` | §12.1–12.16 Condition, training basics, injuries, discipline, board, talks, conversations, finances, inbox, scouting, transfers, fans, awards, grade | 14 KB | management systems |
| `spec/12b-club-depth.md` | §12.17–12.20 Club depth, training in detail, injury and discipline decisions | 22 KB | M5 tasks 7, 8, 11 |
| `spec/13a-engine-core.md` | §13.1–13.16 Match engine core and calibration | 25 KB | engine work |
| `spec/13b-tactical-depth.md` | §13.17–13.19 Roles, orders, depth pass 2, attacking/defensive roles | 44 KB | tactics engine and UI |
| `spec/13c-set-pieces-shouts-plans-traits.md` | §13.20–13.23 Set pieces, shouts, match plans, traits | 17 KB | M5 tasks 9, 10 |
| `spec/14a-match-presentation.md` | §14.1–14.10 Match presentation, cameras, HUD, realism pass | 15 KB | 3D match and HUD |
| `spec/14b-people-and-faces.md` | §14.11 People and painted faces | 6 KB | M6b |
| `spec/15-assistant.md` | §15 The assistant coach | 4 KB | assistant rules |
| `spec/16-content.md` | §16 Content files | 7 KB | writing content JSON |
| `spec/17-audio.md` | §17 Audio | 4 KB | audio and voice |
| `spec/18-assets.md` | §18 Asset contract | 8 KB | loading models, images, audio |
| `spec/19a-ui-design-system.md` | §19.1–19.7 UI design system and motion | 17 KB | any UI work |
| `spec/19b-craft-bar.md` | §19.8 The craft bar | 4 KB | every screen task (read it) |
| `spec/20-saving-settings.md` | §20 Saving, loading, settings | 2 KB | saves and settings |
| `spec/21-performance.md` | §21 Performance budgets and presets | 3 KB | perf, quality presets |
| `spec/22-testing-qa.md` | §22 Testing, calibration and QA | 3 KB | tests and calibration |
| `spec/23-milestones.md` | §23 Milestones, tasks, acceptance | 14 KB | every session: find your task |
| `spec/24-out-of-scope-and-extras.md` | §24 Out of scope, stretch, extras | 5 KB | before starting anything not in §23 |
| `spec/25-glossary.md` | §25 Glossary | 1 KB | when a term is unclear |

## Task map (what to read for the work ahead)

| Task | Parts |
|---|---|
| M4 review fixes (`docs/design/REVIEW-M4.md`) | 14a, 21, 19b, and the review |
| M5.6 transfers, scouting, news | 12a (§12.10–12.13), 16 (§16.6), 11a (§11.10) |
| M5.7 club depth | 12b (§12.17), 11a (§11.13) |
| M5 task 8: training in detail | 12b (§12.18), 11a (§11.9), 12a (§12.1–12.4) |
| M5 task 9: set pieces | 13c (§13.20), 13b (§13.17.5, §13.18.8), 13a (§13.8), 11a (§11.8) |
| M5 task 10: shouts, plans, traits | 13c (§13.21–13.23), 13a (§13.12, §13.13), 09 (world gen for traits) |
| M5 task 11: injury and discipline decisions | 12b (§12.19–12.20), 12a (§12.5–12.6, §12.9), 13a (§13.12) |
| M6 assistant and audio | 15, 17, 16 |
| M6b club spaces | 11b, 14b, 17 (§17.4–17.5), 18 (§18.6), 21 |
| M7 polish | 19a, 19b, 11a, 22 |
| M8 assets and performance | 18, 21 |
| M9 ship | 01, 03, 23 |

## Section map (§ → file)

| § | File |
|---|---|
| 0.1 | `spec/00-how-to-work.md` |
| 0.2 | `spec/00-how-to-work.md` |
| 0.3 | `spec/00-how-to-work.md` |
| 0.4 | `spec/00-how-to-work.md` |
| 0.5 | `spec/00-how-to-work.md` |
| 7.1 | `spec/07-architecture.md` |
| 7.2 | `spec/07-architecture.md` |
| 7.3 | `spec/07-architecture.md` |
| 7.4 | `spec/07-architecture.md` |
| 8.1 | `spec/08-data-model.md` |
| 8.2 | `spec/08-data-model.md` |
| 8.3 | `spec/08-data-model.md` |
| 8.4 | `spec/08-data-model.md` |
| 8.5 | `spec/08-data-model.md` |
| 8.6 | `spec/08-data-model.md` |
| 8.7 | `spec/08-data-model.md` |
| 8.8 | `spec/08-data-model.md` |
| 8.9 | `spec/08-data-model.md` |
| 9.1 | `spec/09-world.md` |
| 9.2 | `spec/09-world.md` |
| 9.3 | `spec/09-world.md` |
| 9.4 | `spec/09-world.md` |
| 9.5 | `spec/09-world.md` |
| 9.6 | `spec/09-world.md` |
| 9.7 | `spec/09-world.md` |
| 10.1 | `spec/10-game-flow.md` |
| 10.2 | `spec/10-game-flow.md` |
| 10.3 | `spec/10-game-flow.md` |
| 11.0 | `spec/11a-screens.md` |
| 11.1 | `spec/11a-screens.md` |
| 11.2 | `spec/11a-screens.md` |
| 11.3 | `spec/11a-screens.md` |
| 11.4 | `spec/11a-screens.md` |
| 11.5 | `spec/11a-screens.md` |
| 11.6 | `spec/11a-screens.md` |
| 11.7 | `spec/11a-screens.md` |
| 11.8 | `spec/11a-screens.md` |
| 11.9 | `spec/11a-screens.md` |
| 11.10 | `spec/11a-screens.md` |
| 11.11 | `spec/11a-screens.md` |
| 11.12 | `spec/11a-screens.md` |
| 11.13 | `spec/11a-screens.md` |
| 11.14 | `spec/11a-screens.md` |
| 11.15 | `spec/11a-screens.md` |
| 11.16 | `spec/11a-screens.md` |
| 11.17 | `spec/11a-screens.md` |
| 11.18 | `spec/11a-screens.md` |
| 11.19 | `spec/11a-screens.md` |
| 11.20 | `spec/11a-screens.md` |
| 11.21 | `spec/11a-screens.md` |
| 11.22 | `spec/11a-screens.md` |
| 11.23 | `spec/11a-screens.md` |
| 11.24 | `spec/11a-screens.md` |
| 11.25 | `spec/11b-club-spaces.md` |
| 12.1 | `spec/12a-management-core.md` |
| 12.2 | `spec/12a-management-core.md` |
| 12.3 | `spec/12a-management-core.md` |
| 12.4 | `spec/12a-management-core.md` |
| 12.5 | `spec/12a-management-core.md` |
| 12.6 | `spec/12a-management-core.md` |
| 12.7 | `spec/12a-management-core.md` |
| 12.8 | `spec/12a-management-core.md` |
| 12.9 | `spec/12a-management-core.md` |
| 12.10 | `spec/12a-management-core.md` |
| 12.11 | `spec/12a-management-core.md` |
| 12.12 | `spec/12a-management-core.md` |
| 12.13 | `spec/12a-management-core.md` |
| 12.14 | `spec/12a-management-core.md` |
| 12.15 | `spec/12a-management-core.md` |
| 12.16 | `spec/12a-management-core.md` |
| 12.17 | `spec/12b-club-depth.md` |
| 12.18 | `spec/12b-club-depth.md` |
| 12.19 | `spec/12b-club-depth.md` |
| 12.20 | `spec/12b-club-depth.md` |
| 13.1 | `spec/13a-engine-core.md` |
| 13.2 | `spec/13a-engine-core.md` |
| 13.3 | `spec/13a-engine-core.md` |
| 13.4 | `spec/13a-engine-core.md` |
| 13.5 | `spec/13a-engine-core.md` |
| 13.6 | `spec/13a-engine-core.md` |
| 13.7 | `spec/13a-engine-core.md` |
| 13.8 | `spec/13a-engine-core.md` |
| 13.9 | `spec/13a-engine-core.md` |
| 13.10 | `spec/13a-engine-core.md` |
| 13.11 | `spec/13a-engine-core.md` |
| 13.12 | `spec/13a-engine-core.md` |
| 13.13 | `spec/13a-engine-core.md` |
| 13.14 | `spec/13a-engine-core.md` |
| 13.15 | `spec/13a-engine-core.md` |
| 13.16 | `spec/13a-engine-core.md` |
| 13.17 | `spec/13b-tactical-depth.md` |
| 13.18 | `spec/13b-tactical-depth.md` |
| 13.19 | `spec/13b-tactical-depth.md` |
| 13.20 | `spec/13c-set-pieces-shouts-plans-traits.md` |
| 13.21 | `spec/13c-set-pieces-shouts-plans-traits.md` |
| 13.22 | `spec/13c-set-pieces-shouts-plans-traits.md` |
| 13.23 | `spec/13c-set-pieces-shouts-plans-traits.md` |
| 14.1 | `spec/14a-match-presentation.md` |
| 14.2 | `spec/14a-match-presentation.md` |
| 14.3 | `spec/14a-match-presentation.md` |
| 14.4 | `spec/14a-match-presentation.md` |
| 14.5 | `spec/14a-match-presentation.md` |
| 14.6 | `spec/14a-match-presentation.md` |
| 14.7 | `spec/14a-match-presentation.md` |
| 14.8 | `spec/14a-match-presentation.md` |
| 14.9 | `spec/14a-match-presentation.md` |
| 14.10 | `spec/14a-match-presentation.md` |
| 14.11 | `spec/14b-people-and-faces.md` |
| 15.1 | `spec/15-assistant.md` |
| 15.2 | `spec/15-assistant.md` |
| 15.3 | `spec/15-assistant.md` |
| 15.4 | `spec/15-assistant.md` |
| 15.5 | `spec/15-assistant.md` |
| 16.1 | `spec/16-content.md` |
| 16.2 | `spec/16-content.md` |
| 16.3 | `spec/16-content.md` |
| 16.4 | `spec/16-content.md` |
| 16.5 | `spec/16-content.md` |
| 16.6 | `spec/16-content.md` |
| 16.7 | `spec/16-content.md` |
| 16.8 | `spec/16-content.md` |
| 16.9 | `spec/16-content.md` |
| 17.1 | `spec/17-audio.md` |
| 17.2 | `spec/17-audio.md` |
| 17.3 | `spec/17-audio.md` |
| 17.4 | `spec/17-audio.md` |
| 17.5 | `spec/17-audio.md` |
| 18.1 | `spec/18-assets.md` |
| 18.2 | `spec/18-assets.md` |
| 18.3 | `spec/18-assets.md` |
| 18.4 | `spec/18-assets.md` |
| 18.5 | `spec/18-assets.md` |
| 18.6 | `spec/18-assets.md` |
| 19.1 | `spec/19a-ui-design-system.md` |
| 19.2 | `spec/19a-ui-design-system.md` |
| 19.3 | `spec/19a-ui-design-system.md` |
| 19.4 | `spec/19a-ui-design-system.md` |
| 19.5 | `spec/19a-ui-design-system.md` |
| 19.6 | `spec/19a-ui-design-system.md` |
| 19.7 | `spec/19a-ui-design-system.md` |
| 19.8 | `spec/19b-craft-bar.md` |
| 20.1 | `spec/20-saving-settings.md` |
| 20.2 | `spec/20-saving-settings.md` |
| 20.3 | `spec/20-saving-settings.md` |
| 20.4 | `spec/20-saving-settings.md` |
| 20.5 | `spec/20-saving-settings.md` |
| 21.1 | `spec/21-performance.md` |
| 21.2 | `spec/21-performance.md` |
| 22.1 | `spec/22-testing-qa.md` |
| 22.2 | `spec/22-testing-qa.md` |
| 22.3 | `spec/22-testing-qa.md` |
| 22.4 | `spec/22-testing-qa.md` |
| 23.0 | `spec/23-milestones.md` |
