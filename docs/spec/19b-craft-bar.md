<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 19.8 The craft bar (MUST, applies to every screen, line of copy and match moment)
The judges score depth, fun and visual fidelity. Anything that looks or reads like generic AI output loses on all three. Treat this section as a hard requirement, not a style tip.

**Visual: never do these**
- No purple/blue "AI gradient" backgrounds, gradient text, glassmorphism stacks, glowing borders on everything, floating blobs, sparkle icons or emoji used as icons.
- No card grids where every card has the same size and weight. The Hub has one dominant card (Next match) and supporting cards.
- No centred walls of text, no all-caps body copy, no more than 2 font weights on one card.
- No icons without meaning. Each icon is from lucide-react, 16 or 20 px, and sits next to a label unless the meaning is universal (close, settings, search).
- No default browser controls left unstyled (select, range, number input, scrollbars on dark surfaces).

**Visual: always do these**
- One clear primary action per screen (the Continue button or the screen's own primary button), everything else visually quieter.
- Hierarchy you can read in 2 seconds: one H1 per screen, then section titles, then data.
- Every element sits on the 4 px grid and the 12-column layout. Equal gaps inside a group, larger gaps between groups.
- Tables: numbers right-aligned with tabular numerals, text left-aligned, long names truncated with an ellipsis and shown in full on hover and focus.
- Every interactive element has hover, `:focus-visible` (2 px `--accent-text` ring, 2 px offset; `--paper-ink` ring on paper and whiteboard), active, disabled and loading states.
- Every list has a designed empty state (an icon, one sentence that says what goes here and how to fill it, and an action if one exists).
- Club identity everywhere it belongs: crest, colours stripe, kit icons, stadium name. The game must feel like it is about *your* club.

**Copy: never do these**
- Never use marketing or AI filler: "unleash", "elevate", "dive in", "seamless", "embark", "journey", "game-changer", "level up", "Let's get started!", exclamation marks in UI labels.
- Never write vague labels ("Manage", "Info", "Details"). Say what the thing is ("Contract", "Last 5 matches").

**Copy: always do these**
- Write like football people talk: "XI", "clean sheet", "matchday", "the gaffer", "deadline day", "sat deep", "went direct". British/international English spelling.
- Button labels are verbs with objects: "Pick best XI", "Make offer", "Kick off".
- Numbers carry units and context: "Condition 68% (tired)", "€4.2M (fair price)".

**Game feel: details that MUST exist in the match**
Players walk back to their halves after a goal; the scorer runs to the corner flag and teammates join; the keeper picks the ball out of the net; the losing side's heads drop (Dejected); the substitution board is held up by the fourth official at the halfway line before a sub; an injured player limps off or is helped off; players argue with the referee after a red (two players walk toward him); the wall shuffles before a free kick; the taker places the ball and steps back before corners and penalties; the crowd groans on a miss and "ooh"s on a save; the scoreboard pulses on a goal; added time is shown on a board.

**Football sense: things that MUST never happen**
A goal the camera does not show; the ball teleporting; two players on top of each other; a player running through the goal frame; a scorer who did not touch the ball; a GK playing as a striker; implausible score lines more than rarely (calibration §13.16 guards this); the same commentary line twice in one half; a press question repeated in the same season.

**Design references and review gates**
Claude will put reference mock-ups for the key screens in `docs/design/` (Hub, Squad, Player Profile, Tactics, Pre-Match, Match HUD, Full-Time, Season End). Match them closely; where a reference and this spec disagree, the spec's data and behaviour win and the reference's look wins.
At the end of M3, M4 and M7, save screenshots of every screen at 1280×720 and 1920×1080 into `docs/screens/<milestone>/` (named `<screen>-<width>.png`) and stop for a design review. (2560×1440 captures were dropped on 22 Nov to save data; 2560 layouts are still checked by a live resize, §22.4.) Don't open the screenshots yourself to review them: the design review is Claude's job. Only check that the capture script's guards pass. Claude reviews them and writes fixes into `docs/design/REVIEW-<milestone>.md`. Fix every item before starting the next milestone.

---

