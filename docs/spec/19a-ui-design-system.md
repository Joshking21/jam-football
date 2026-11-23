<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 19. UI design system

### 19.1 Direction: two worlds, one show
The game is a television broadcast about your club, plus the rooms behind it. This idea drives every screen, colour and animation.

- **On air (the broadcast).** Everything the public sees: Title, Hub, League, Fixtures, Pre-Match, the match and its HUD, Half-Time, Full-Time, Week Summary, Press Conference, Season End, Sacked. It looks like a sports broadcast graphics package: near-black cool surfaces, hard edges and angled cuts, bold condensed type, your club's colours as the brand, graphics that build in and wipe off, a live ticker.
- **Behind the scenes (the office).** The manager's private work: Squad, Player Profile, Tactics, Training, Transfers/Scouting, Club (finances, board), Inbox, Board Meeting, player conversations. It looks like a manager's office at night under a desk lamp: a warm dark desk, and physical objects on it (paper files and memos, a tactics whiteboard with magnetic counters, a training clipboard, a ledger). Things are placed, slid, pinned and stamped, not just faded in.
- Both worlds share fonts, spacing and data colours, so it reads as one product. Moving between them is a camera cut (§19.7).
- **Your club is the brand.** Once a club is chosen, the accent everywhere is that club's theme colour (§19.2 table), not a fixed UI colour. Every club looks different. Before a club is chosen (Title, New Game), the Meridian League's own brand colour is used.
- Never copy the look of an existing game's UI or a real broadcaster's graphics package.

### 19.2 Tokens (`tokens.css`) and club themes (`src/config/clubThemes.ts`)
```css
:root {
  /* on air: cool near-black */
  --bg: #07090D; --surface: #0E1218; --surface-2: #151A22; --surface-3: #1C222C; --border: #2A313D;
  /* the office: warm dark desk, paper, whiteboard */
  --desk: #100E0C; --desk-2: #191613; --desk-border: #2E2924;
  --paper: #EFEBE3; --paper-2: #E4DED2; --paper-ink: #1B1A17; --paper-dim: #5E574E; --paper-rule: #CFC6B6;
  --board: #E9ECEA; --board-ink: #1E2A38; --marker-red: #C42B2B; --marker-blue: #1F4FBF; --marker-green: #1E7B3C;
  /* text on dark */
  --text: #F2F4F7; --text-dim: #A3ACBA; --text-faint: #7D8696;
  /* brand: set at runtime from the club theme table; these defaults are the league brand */
  --accent: #FF5B35; --accent-ink: #1A0600; --accent-text: #FF6E4D;
  --band-1: #FF5B35; --band-2: #F2F4F7;
  --club-primary: #FF5B35; --club-secondary: #F2F4F7;
  /* fixed meanings (never themed) */
  --gold: #FFC83D; --info: #3DA5FF;
  --win: #18C77A; --draw: #A3ACBA; --loss: #FF4D5E; --warning: #FFB020; --danger: #FF4D5E;
  /* shape */
  --radius-s: 2px; --radius-m: 4px; --radius-l: 6px; --cut: 10px;
  --shadow-1: 0 1px 2px rgb(0 0 0 / .4);
  --shadow-paper: 0 1px 0 rgb(0 0 0 / .25), 0 10px 24px rgb(0 0 0 / .5);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-7: 48px;
  --font-head: 'Barlow Condensed', system-ui, sans-serif; --font-body: 'Inter', system-ui, sans-serif;
  /* motion (§19.7) */
  --dur-micro: 120ms; --dur-fast: 180ms; --dur-med: 260ms; --dur-wipe: 440ms; --dur-count: 650ms; --dur-reorder: 700ms;
  --ease-snap: cubic-bezier(.2,.9,.1,1); --ease-out: cubic-bezier(.2,.8,.2,1); --ease-in: cubic-bezier(.5,0,.8,.2);
}
```
- `--accent` fills (Continue button, active tab block in the top bar, selected states); `--accent-ink` is text on it; `--accent-text` is accent-coloured text, icons and the focus ring on dark surfaces. `--band-1`/`--band-2` are the two stripe colours used in wipes and header stripes.
- On paper and whiteboard surfaces, text is always `--paper-ink`/`--board-ink`; club colours appear there only as stripes, stamps and magnets.
- Dark only. `body { background: var(--bg); color: var(--text); }`. Office screens set their content area to `--desk`.

**Club themes** (`clubThemes.ts`, applied by setting the CSS variables on `:root` when a club is chosen or a save is loaded; opponents' rows are used for versus graphics). Every pair below was checked: ink on fill and text on `--bg`/`--surface`/`--desk` are all ≥ 4.5:1.

| Club | accent (fill) | accent-ink | accent-text | band-1 | band-2 |
|---|---|---|---|---|---|
| league (no club) | `#FF5B35` | `#1A0600` | `#FF6E4D` | `#FF5B35` | `#F2F4F7` |
| c01 Port Calloway | `#F2B705` | `#0B1F3A` | `#F2B705` | `#F2B705` | `#0B1F3A` |
| c02 Ironvale | `#FF6A13` | `#1A0A00` | `#FF7A2E` | `#FF6A13` | `#2B2B2B` |
| c03 Kestrel Bay | `#17A9A9` | `#03201F` | `#2BC2C2` | `#0E8C8C` | `#FFFFFF` |
| c04 Saltmere | `#8FC5E8` | `#0D2233` | `#8FC5E8` | `#6D1A36` | `#8FC5E8` |
| c05 Brightwater | `#4FA3E0` | `#04182A` | `#5DB0EA` | `#4FA3E0` | `#FFFFFF` |
| c06 Northgate | `#2FA457` | `#03200D` | `#3DBA67` | `#1E7B3C` | `#FFFFFF` |
| c07 Ashcombe | `#C8102E` | `#FFFFFF` | `#F0455D` | `#C8102E` | `#111111` |
| c08 Veldmoor | `#6A44A8` | `#FFFFFF` | `#B396E8` | `#4B2A7B` | `#FFFFFF` |
| c09 Lindenfield | `#FFD100` | `#111111` | `#FFD100` | `#FFD100` | `#111111` |
| c10 Corvallen | `#F3F6FB` | `#07090D` | `#F3F6FB` | `#F3F6FB` | `#111111` |

`--club-primary`/`--club-secondary` keep the club's real colours from §9.2 (crests, kits, stripes).

### 19.3 Typography
Headings: Barlow Condensed 700 uppercase, letter-spacing 0.02em; sizes H1 48, H2 32, H3 24, H4 20. Broadcast labels (panel headers, ticker, slates): Barlow Condensed 600 uppercase, letter-spacing 0.06em. Body: Inter 400/500/600; sizes 16 (default), 14 (tables), 12 (captions). Office paper text: Inter on `--paper-ink`, with ruled lines (`--paper-rule`) under rows. **Stamps** (office labels such as INJURED, NOT FOR SALE, SCOUTED, SIGNED): Barlow Condensed 700 uppercase in a 2 px bordered box, rotated −2°, `--marker-red` or `--paper-ink`, like a rubber stamp. All numbers in tables and stats: `font-variant-numeric: tabular-nums`. Big stat numbers: Barlow Condensed 600. No more than 2 weights on one panel or sheet.

### 19.4 Data colours
Attribute/OVR scale: 1–39 `#FF4D5E`, 40–54 `#FF8A3D`, 55–64 `#FFC83D`, 65–74 `#9BE15D`, 75–84 `#18C77A`, 85–99 `#00E5D1`. Colour-blind mode: `#D55E00`, `#E69F00`, `#F0E442`, `#56B4E9`, `#0072B2`, `#CC79A7`. Ratings (match): < 6.0 loss colour, 6.0–6.9 text, 7.0–7.9 win colour, ≥ 8.0 gold. Form dots: W win, D draw, L loss. Data colours are never replaced by the club theme.

### 19.5 Components (behaviour)
- **Button** variants: primary (`--accent` fill, `--accent-ink` text), secondary (surface-3 on dark, paper-ink outline on paper), ghost, danger; sizes S/M/L; radius `--radius-m`; on broadcast screens the primary L button has one angled corner (`--cut`, bottom-right, via `clip-path`); loading state; disabled with tooltip-on-focus reason; pressed state moves down 2 px.
- **ContinueButton**: primary L with KeyHint "Space", subtle pulse every 6 s when idle > 10 s (off with reduce motion). When its label changes ("Continue" → "Kick off"), the new label slides up into place (`--dur-fast`).
- **Panel** (on air): `--surface`, `--radius-s`, a 3 px top stripe in `--band-1` (with a 1/3-width segment of `--band-2` at its right end), header row in broadcast labels. Panels on one screen are deliberately different sizes: one dominant graphic, the rest supporting.
- **Sheet** (office): `--paper`, radius 3 px, `--shadow-paper`, resting rotation between −0.6° and +0.6° (deterministic from its id), paper text with ruled rows. Variants: memo (inbox, board notes), file (player profile: a manila tab `#D9C9A3` with the name), clipboard (training: a dark clip at the top), ledger (finances: two ruled money columns).
- **Table**: sticky header, rows separated by 1 px rules (no zebra on paper; zebra `--surface`/`--surface-2` on air), row hover surface-3 (on air) or `--paper-2` (office), sortable headers with arrow, keyboard navigation.
- **Modal**: centred, max 960 px, Esc closes, focus trap. On air it is a full graphic panel; in the office it is a file opened on the desk (§19.7). No backdrop blur (performance); dim the screen behind with `rgb(0 0 0 / .6)`.
- **ScreenTransition**, **CountUp**, **FlipList**: §19.7.
- **Ticker** (on-air screens only): a 36 px bar along the bottom of the content area. A label block in `--accent` ("AROUND THE LEAGUE", or "LIVE" during matchday) followed by items scrolling at 60 px/s: other results, injuries, rumours, news headlines, each separated by a small two-colour band mark. Pauses on hover and focus. Items come from the week's news and results; never repeat an item within one loop.
- **Stamp**: §19.3. Lands with the stamp animation in §19.7.
- **Magnet** (Tactics, §11.8): a 44 px circle in the player's shirt colour with his number, surname under it in Barlow Condensed 600 `--board-ink`; drag lifts it (scale 1.08, shadow), it follows the pointer through the spring (§19.7), and on drop it settles into the slot.
- **Toast**: bottom-right stack, 4 s, types info/success/warning/error; office screens show toasts as small memos.
- **Tooltip**: on hover and focus, 300 ms delay, max 280 px.
- **Meter**: 0–100 bar with coloured thresholds and trend arrow.
- **PitchBoard**: SVG, responsive, drag with pointer events (mouse), keyboard: select token with Enter, arrows move selection between slots, Enter on a second slot swaps. Drawn as a whiteboard in Tactics (§11.8).
- **StatCompare**: two-sided bars for match stats, each side in that club's accent.
- **Sparkline**: inline SVG.
- **RadarChart** (v1.6; part of the player's file everywhere): inline SVG, 6 axes, scale 0–100, faint rings at 25/50/75 in pencil grey, drawn on the file's paper.
  - Outfield axes (weighted means of attributes): **Pace** = pace; **Shooting** = 0.7 finishing + 0.3 longShots; **Passing** = 0.6 passing + 0.2 crossing + 0.2 firstTouch; **Dribbling** = 0.6 dribbling + 0.2 firstTouch + 0.2 composure; **Defending** = 0.5 tackling + 0.35 positioning + 0.15 heading; **Physical** = 0.4 strength + 0.4 stamina + 0.2 workRate. Goalkeepers: Reflexes, Handling, One-on-ones, Aerial (aerialCommand), Distribution (passing), Positioning.
  - **His shape:** blue marker stroke (2 px) with a 15% fill of the same ink. Each axis label shows its number; hover or focus on a label lists the attributes behind it.
  - **What the role needs:** a red dashed shape for the selected role at his slot (his attacking role on With ball, his defensive role on Without ball). Its values are the mean axis values of the 20 players in the world with the highest fit for that role, computed at load and again at season start (`src/core/player/roleShapes.ts`, pure, cached). Where his value is more than 5 under the dashed one, that axis label turns `--warn`.
  - **Comparison:** while a magnet is dragged over another, the other player's shape is drawn in pencil grey on the same chart.
  - **Motion:** a new shape draws on with `stroke-dashoffset` (320 ms, the marker exception). When the role changes, the old dashed shape fades out and the new one fades in (opacity, 180 ms). Vertices are never tweened. Reduce motion: shapes appear at once.
  - Unscouted players (other clubs, §12.12): the range is a band between the low and high shapes, no fill.

### 19.6 Layout and the top bar (v1.6: no sidebar)
Shell: top bar 56 px across the full width, content below it, Ticker 36 px at the bottom of on-air screens. There is no sidebar. Padding 24 px (16 px under 1280). 12-column grid, gap 16 px. On-air screens: content max width 1600 px, and the page may scroll. **Office work screens** (Squad, Tactics, Training, Transfers/Scouting): full width up to 2400 px (centred beyond that), and they MUST fit the window with **no page scroll** at 1280×720 and up. A column whose content is longer scrolls inside itself; the main object (board, table, clipboard) never scrolls away. Every screen MUST be checked at 1280×720, 1920×1080 and 2560×1440 (§22.4).

**The top bar (the rundown, now horizontal)**:
- Left: crest (32 px) and club name in Barlow Condensed 700 18 px (name hidden under 1440 wide).
- Navigation tabs in two groups, **On air** (Hub, League, Fixtures) and **The office** (Squad, Tactics, Training, Transfers/Scouting, Club, Inbox), split by a 1 px rule; each group has a 10 px broadcast label above it (hidden under 1440). Keys `1`–`9` follow this order. Each tab: 14 px label in Barlow Condensed 600, `--text-dim`, 12 px side padding; hover or focus lifts it to `--text` (`--dur-fast`). Inbox carries its unread count as a small badge.
- **The current tab** sits in a block filled with `--accent`, label in `--accent-ink`. Changing page: the block slides from the old tab to the new one (shared-element FLIP, `--dur-med`, `--ease-snap`). Its context line ("Matchday 7 · v Port Calloway", "4-4-2 · 2 changes", "5 unread") shows as a flag hanging under the block for 1.2 s after the page change, then tucks up.
- Right: the status chip ("MD 7/18 · 3rd · 14 pts"), balance (hidden under 1440; it is on Club), settings gear, Continue. Continue keeps its idle hop (Hub README).
- Width at 1280: crest 40 + 9 tabs (about 640) + chip 150 + gear 40 + Continue 150 + gaps fits. If it ever doesn't, tabs drop to icons with the label only on the current tab.
- The bar uses broadcast surfaces on on-air pages and desk surfaces on office pages (crossfade `--dur-med`).

**Composition**: on-air screens have one dominant graphic and supporting panels of different sizes, never a uniform grid of equal cards. Office screens are a desk with objects of different sizes; slight overlap is allowed (a memo partly over a file) but data is never hidden under another object.

### 19.7 Motion: the feel
Motion explains change and gives the game weight. On-air motion is fast, precise and graphic: snap in, hold, wipe off. Office motion is physical: objects have mass, slide, settle and stack. Data never bounces.

**Screen transitions** (`ScreenTransition`, one at a time; never blocks input for more than 150 ms; Space or a click during a transition finishes it at once):
1. **On air → on air: stinger wipe.** Two parallel bands skewed −12° (`--band-2` leading by 40 ms, then `--band-1`) sweep across the content area left to right in `--dur-wipe`. They never cover the top bar. The new screen swaps in while the bands fully cover the content; then its panels build: each panel enters from `translateX(-16px)` and opacity 0, 40 ms apart, up to 8 panels, `--dur-med`, `--ease-snap`.
2. **On air ↔ office: camera cut.** The content dips to black (opacity to 0 in 90 ms); a slate label ("THE OFFICE" or "ON AIR", broadcast label 14 px in `--accent-text`) shows in the content's top-left for 300 ms; the new world appears and its objects settle.
3. **Office → office: across the desk.** The old screen slides 32 px out and fades (`--dur-fast`), the new one slides in from the other side; its sheets settle from `translateY(10px)` and ±1.2° extra rotation to their resting rotation through the spring.
4. **Modals.** On air: the graphic panel wipes in from the left edge (`--dur-med`). Office: the file opens from the row that was clicked (scale from that row's rectangle, `--dur-med`), then its sheets fan out one by one (50 ms apart).

**Spring** (`src/ui/motion/spring.ts`, no libraries, §4): stiffness 420, damping 34, mass 1; stops when velocity < 0.01 and distance < 0.5 px. Used by Magnets, sheets and the top-bar tab block.

**CountUp**: when a number changes (points, balance, a meter), it counts from the old to the new value in `--dur-count` with `--ease-out`, tabular numerals. It runs on the first view after the change, never on every revisit.

**FlipList**: rows that change order (league table after a matchday, squad sort) slide to their new places (measure, invert, play), `--dur-reorder`, 30 ms stagger. A row that moved up flashes `--win` at 12% opacity for 600 ms; down, `--loss`.

**Signature moments (MUST):**
- After every matchday: the table reorders with FlipList, points count up, the new form dot pops in (scale 0.6 → 1, `--dur-fast`).
- A new inbox item drops onto the pile (from `translateY(-12px)` with a small rotation) with `ui_paper`.
- Transfer complete or contract signed: a SIGNED stamp lands (scale 1.4 → 1 in 160 ms) with `ui_stamp`.
- Tactics: magnets slide with the spring; swapping two players moves both to each other's slot at once; a dropped magnet plays `ui_clack`.
- Kick-off from Pre-Match: the Continue press triggers a full-height stinger into the match loading screen.

**Sound hooks** (effects channel, §17.3; a missing file is simply silent): wipe `sfx/ui_whoosh.mp3`; camera cut `sfx/ui_cut.mp3`; CountUp `sfx/ui_tick.mp3` (at most 12 ticks per second, quiet); magnet drop `sfx/ui_clack.mp3`; sheet or memo `sfx/ui_paper.mp3`; stamp `sfx/ui_stamp.mp3`.

**Performance (MUST):** animate only `transform` and `opacity`; never animate `box-shadow`, `filter`, `backdrop-filter`, width/height/top/left or other layout properties (the wipe bands are skewed divs moved with `transform`, the top-bar tab block uses FLIP). Set `will-change` only while an animation runs. FlipList measures in one read pass, then writes in one pass. The ticker is one translated strip, not a timer per item. Every screen transition finishes in under 500 ms. Menus hold 60 fps on the target laptop, and the browser profiler shows no task over 50 ms during a transition.

**Reduce motion** (setting or system preference): wipes, cuts and slides become a 150 ms crossfade; no springs (objects appear at rest); CountUp jumps straight to the value; FlipList highlights the rows without moving them; the ticker shows one item at a time, changing every 6 s with a fade; stamps appear without scaling.

**Never:** bouncy overshoot on numbers or panels, parallax, tilting 3D cards, animated gradients, pulsing glows, confetti, text typed out letter by letter.

