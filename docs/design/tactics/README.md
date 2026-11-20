# Tactics reference

> **v3 (20 Nov):** full-width work mode (sidebar as icons, board left, tall panel right), attacking and defensive roles (SPEC §13.19), instructions offered by role with fit stars and the deciding attribute, the player's file with condition, morale, season stats and last-5 ratings, a With ball / Without ball switch that slides the magnets into the defensive shape, and a comparison card while dragging one player over another. Open `index.html#file` or `#file-without` to land on Calder's file.
>
> **The same pattern applies to every office screen** (Squad, Training, Scouting, Club, Inbox): the main object large on the left (the table, the clipboard, the ledger), and on the right a tall panel that becomes the selected player's file with the same header, stats and attribute bars. One player file component, used everywhere.

`index.html` is an animated, clickable reference for the Tactics screen (SPEC §11.8, §13.10, §13.17). Open it in a browser. Build the real screen to match how it looks and moves. Where this file and the SPEC differ, this file wins on layout and look; the SPEC still wins on rules and numbers.

The bar above the game frame is reference only: club themes, reduce motion, replay the settle.

## The objects on the desk
- **The whiteboard (left, dominant).** An aluminium frame, a `--board` surface with faint marker smudges, and pitch lines in `--board-ink` at 35%. Under the pitch is the bench strip (up to 9 magnets) and an "Injured" corner. Under the frame is the marker tray (red and blue pens, an eraser). Two folder tabs sit on top: **Our team** and **Opposition**.
- **Magnets.** A disc in the kit colours with the number, the surname under it, and the OVR at this slot as a small tag: green for his natural position, amber for 0.8–0.95, red under 0.8 (§11.8). Bench magnets are smaller.
- **The clipboard (right).** Formation dropdown with familiarity, the five presets, then four paper dividers: **With ball**, **Without ball**, **Transitions**, **Set pieces** (the last includes takers). Each instruction is a row of words; the chosen word is circled in blue marker and its exact SPEC wording sits under it. At the bottom: the readiness line, then **Assistant picks best XI** and **Reset to club style**.
- **The player's file.** Clicking a magnet slides a file with a manila name tab over the clipboard. It shows his roles for this slot (name, fit stars, description; the chosen one opens to show "Gives you" and "Costs you") and up to 2 player instructions. Instructions that clash are disabled with the reason.
- **Props.** Training cones, a whistle, a stopwatch and a coffee ring. They stay code-drawn (SVG), or become small Meshy models if credits remain. fal is on hold. Props never cover data and are hidden on narrow screens.

## Marker on the board (what makes it feel alive)
Every choice the player makes shows on the board in marker:
- **Roles:** each non-neutral role draws its movement from the player's slot in blue: overlap runs, inside cuts, a dashed pass line for playmakers, a zig-zag for pressing roles, a ring for an anchor or a target man. Unselected roles are faint; the selected player's role is drawn bold.
- **Team instructions:** dashed vertical lines for the defensive line and the pressing line. They slide to the new spot when you change Line or Pressing (520 ms). Width draws outward or inward arrows; Focus draws an arrow down that channel.
- **Opposition tab:** our shape as faint blue Xs, their likely XI as red-marker Os with numbers and surnames. Click an O to give an order; the order draws a red line or arrow between his marker and him, with a short label (Tight, ×2, Press, In, Out). "N of 3 orders used" shows on the sheet and on the tab.

## Motion
- **Magnets:** one spring per magnet (stiffness 420, damping 34, `spring.ts`). Drag lifts it (scale 1.08 plus a deeper shadow) and it follows the pointer through the spring. Drop it on another magnet and both slide to each other's spot at once. Drop it anywhere else and it springs home. Changing formation slides every magnet to its new slot, 22 ms apart.
- **Paper:** sheets settle with the spring from 10 px lower and ±1.2° extra turn to their resting angle. The file comes in from 40 px to the right and leaves the same way (180 ms).
- **Marker:** strokes draw on with `stroke-dashoffset` (320 ms, 60 ms apart). The same exception as in the Hub README applies.
- **Reduce motion:** magnets jump, paper appears at rest, and marker strokes appear without drawing.

## Keyboard
Tab to a magnet. **Enter** picks it and opens his file; **Enter** on a second magnet swaps the two; arrow keys move between magnets by position; **Esc** drops the pick and closes the file. Opposition Os take Enter as well. Space is Continue (Go to match), which is disabled with its reason while the team isn't valid.

## Differences from SPEC (these win)
1. **The pitch lies sideways (own goal on the left, attacking right), not upright.** On 16:9 screens it is about 40% larger, the magnets and names don't collide, and it matches how the broadcast camera shows the match.
2. **Clipboard dividers instead of one long list.** Four groups (§13.17.6) as tabs, so nothing needs scrolling at 1280×720.
3. **"Reset to club style" also sets club roles**, using the AI manager rules of §13.17.8 (only when the player's fit ≥ 0.5). A fresh club therefore starts with a few marker arrows on its board, not a blank one.
4. **Injured players can't be dragged onto the board.** They sit in the Injured corner and a memo explains why, instead of a validation error after the fact. The validation line still covers the goalkeeper rules.

## SPEC 1.4 controls (M3b task 3): drawn
- **Plans A/B/C:** three paper tabs at the top of the clipboard (default names: Club style, Chasing a game, Protect a lead; the user can rename them). Switching slides every magnet to the plan's formation and redraws the board.
- **Familiarity per area:** four small bars beside the formation dropdown (Formation, Mentality, Passing, Pressing), 0-100, red under 70 with "Not sharp yet. It improves every week you use it."
- **Five dividers:** Build-up (mentality in 5 steps, passing, tempo, width), Attack (focus, final third, crosses), Defend (pressing, line, offside trap, tackling, force them), Transition (when we lose it, when we win it, goalkeeper, time-wasting), Set pieces (our corners, corner delivery, men back, free kicks, their corners, the posts, takers).
- **Wording** for the defaults the SPEC leaves blank (use these): offside trap Off "Hold the line. No trap."; tackling Mixed "Pick the moment to go in."; force them Mixed "No preference."; time-wasting Never "Play it straight."; men back Two "Two back. The usual."; posts None "Nobody on the posts."
- **New board marks:** offside trap = a zig-zag on the Line marker (label "Line · trap"); force them = arrows on both flanks in our third; crosses = an arrow from the wing into the box whose curve shows Low, Whipped or Floated; final third = a shot arrow or short pass arrows at their box; on the Set pieces divider, men back as Xs in our half and men on the posts as red Xs at our goal. Each mark draws on only when its own option changes.
- **The 6 new player instructions** in the player's file, with clashes blocked and the reason shown (e.g. "Clashes with “Cross early, from deep”").

## Not in this reference
Sound (`ui_clack` on drop, `ui_paper` on the file). The compact Pre-Match and in-match versions of these controls. Key battles (they're in the Hub's opponent report).
