<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 11.25 Club spaces (v1.7, `src/club3d/`)
The menus become places. Every screen in §11 keeps its content, rules and keyboard access, and is shown inside a room of one club building. You play the coach living the club's week, filmed like a TV documentary.

#### 11.25.1 Rooms
**The site (the user, 23 Nov):** the club is **its stadium with the training ground right beside it**, not a whole campus. The stadium's main stand holds the office, boardroom, dressing room, press room and tunnel, joined by the corridor. The **training ground** sits next to the stadium and is reached by a short outdoor path past the side of the stand and the car park; the walk outside is part of the coach's walk (§11.25.2). The Exterior shot shows both the stand and the training pitches behind it. Free walking (§24, top extra) uses this same site.

Each room is one small three.js set. Walls, floors, ceilings and windows are built in code (`rooms.ts`), with props from `models/club/*.glb` and window and backdrop images from `images/club/` (§18.2). Only the current room is drawn. The next room loads while the coach walks, and a room's props are kept in memory after its first visit.

| Room | Set | Screens and moments |
|---|---|---|
| **Exterior** | The club at dusk: brick main stand, floodlights warming up, car park | Title, New Game. On Start, the camera flies in through the front doors. |
| **Corridor** | A short corridor with a door per room. Each door has a sign (text drawn by the game) and a lamp that lights on hover. | Between every two rooms |
| **Office** | Desk, chair, lamp, phone, wall TV, a window onto the pitch, the sideways whiteboard (§11.8) on the wall, a second chair for Theo | Hub, Inbox, Club (finances), Transfers, and **Tactics** (the coach and Theo at the whiteboard, §14.11.4). **On-air screens (League, Fixtures, Week Summary) play on the wall TV:** the camera pushes into the TV and the broadcast UI fills the screen. Player conversations (§14.11.3). |
| **Boardroom** | A long table, leather chairs, framed portraits of past chairmen (programme print, no text), the owner and 2 directors | Board Meeting (§11.4), board reviews (when §12.7 confidence crosses a band, and budget requests from Club), Sacked (§11.21) |
| **Dressing room** | **One big room with lockers and a bench running around the walls** (back wall and both sides, a U), so the squad sits in a ring facing the middle. The coach stands in the middle on a crest-pattern floor (pattern only), with Theo near the door and a tactics board on a stand. The players' shirts hang in the lockers (name and number drawn by the game, §14.2 kit). The default shot is from the front of the U, slightly raised, looking past the coach at the players. | **Squad**: click a locker to open that player's Profile. **Pre-Match briefing**: the coach presents Plan A on the board (key battles, takers, who marks whom) while the players listen. **Team talks** pre-match, at half-time and full-time (§12.8). Half-Time and Full-Time. |
| **Tunnel** | Concrete walls, studs, the pitch light at the end | The walk-out after the pre-match talk, straight into the M4 match intro |
| **Training ground** | A grey afternoon, cones, mannequins, a small stand, a clipboard in the foreground | Training (§11.9), with drills by focus (§14.11.4) |
| **Press room** | A table with microphones, a club backdrop (pattern only), rows of reporters, camera flashes | Press Conference (§11.18 step 3, pre-match press) |

#### 11.25.2 Moving between rooms (`walk.ts`)
- A tab click or a door click makes **the coach walk there** on a fixed path through the corridor. The camera follows behind him at shoulder height like a documentary shot, and he opens the door (`DoorOpen`). **A walk takes at most 2.5 s**; paths are timed to fit.
- **Any click or key during a walk skips to arrival.** Number keys `1`–`9` cut straight to the room with the `ScreenTransition` wipe (§19.7) and no walk.
- Setting **"Coach walks between rooms"** (§11.22), default **on**. When off, every move is a cut with a wipe.
- The Continue button moves the story on through rooms by itself: Hub → (press, if pre-match press) → dressing room briefing and talk → tunnel → match → dressing room → press room → office.
- **Budget:** walks add no more than 3 minutes to a full season with default settings (measure in M6b, §23).
- Reduce motion (§11.22): walks become cuts; people still animate in place.

#### 11.25.3 How screens sit in a room
- When the camera settles on a room's mark, the screen arrives as an object in the shot: papers slide onto the desk, the board on the wall, the clipboard at training, cards on the boardroom table. Layout and content are the existing screen designs (§19, `docs/design/`), re-framed to sit in the shot.
- **The room is the frame and the UI is the content.** The room stays visible around the edges. Panels behind text are opaque, so legibility never depends on the 3D. Office screens still fit the window with no page scroll (§19.6).
- The top bar stays on every screen. On-air screens on the TV keep their broadcast look; office screens keep their paper and board look.
- With no models or images, rooms are lit boxes in the ART-DIRECTION colours and people are capsules (§14.2 fallback). Every screen stays fully usable, and the game plays offline with nothing delivered.

#### 11.25.4 Look around (the player controls the camera)
The Meshy sponsor track judges models "under a camera you do not control", so in every room the player can move the camera.
- **Mouse:** hold the right mouse button and drag to turn the camera around the room's mark: yaw ±60°, pitch −20° to +15°. The scroll wheel leans in or out by up to 1.5 m along the view. **Keyboard:** `Shift` + arrow keys turn, and `Shift` + `+`/`−` lean.
- **Limits:**
  - The camera never passes through walls or props (clamp against the room's bounding box minus 0.3 m).
  - It never gets closer than 1.2 m to any person's head, so the §14.11.8 framing rule still holds.
- **Release:** let go and the camera eases back to the room's normal shot over 600 ms (spring, §19.7). A screen panel stays where it is while you look; panels fade to 30% while the button is held, so the room can be seen behind them.
- **Not available during a walk, a cutscene or a touchline cut.** In the match, the existing Free camera (§14.4) does this job.
- **First time in each room:** a small one-time hint "Right-drag to look around" (KeyHint style) shows for 4 s, then never again. This is not one of the seven tutorial coach-marks.
- **Reduce motion:** the ease-back is instant.
- **Craft:** because anyone can look at any prop from any side, every Meshy prop and person must hold up from every angle reachable inside these limits. Claude checks this in the M6b review.


#### 11.25.5 Talk scenes: watch, then choose (the user, 22 Nov)
Concepts: `docs/design/dressing-room/` (team talk) and `docs/design/press/` (press conference).
**This is the one pattern for every moment in the game where people talk** (the user, 22 Nov): team talks, the pre-match briefing, press conferences, player conversations at the door or locker, board meetings and reviews, the sacking, one-to-one sessions, Theo's office visits and week plan, signing day (§24 extras), and any later scene. No screen ever shows choices while someone is speaking. (The only exception is the live match: touchline shouts use the HUD wheel, §13.21, because the match doesn't stop for them.) Every such moment is a scene made of two kinds of beat:
- **Speaking beats** (someone talks): no menus or panels on screen, only the caption strip and the scene. The player can't act during them, except to skip:
  - `Space` or a click skips the current line.
  - `Esc` skips straight to the next choice, or to the end if there is none.
  - The skip hint ("Space skip · Esc skip to choice") shows small in a corner.
- **Choice beats** (your turn): the scene holds on an idle shot. The people keep breathing, blinking and glancing; nobody talks. The **choice card** slides up on screen with the options and nothing else: for a team talk, the 6 tones with each one's predicted reaction (§12.8); for press, the 3 answers; and so on. Pick with a click, number keys `1`–`6` or arrows and Enter. There is no timer.
- **After the choice,** the card slides away and the scene continues: the coach says the chosen line (voiced), the room reacts (§14.11.2), and either more talk follows or the scene ends. A short "How they took it" summary (one line per group of players) shows for 3 s after a team talk, then fades. It is also kept in the Half-Time and Full-Time screen's history.
- **Team talk order:**
  1. The coach walks into the middle.
  2. A short opener from Theo or the coach (speaking beat).
  3. Choice.
  4. The chosen line: if it names a player, he is the one looked at (§16.3).
  5. Reactions.
  6. For half-time only, Theo's analysis (§15.5) as a speaking beat with its Apply buttons on a small card.
  7. Continue to the tunnel.
- Reduce motion: cards appear without sliding. Keyboard-only play must reach every choice.

#### 11.25.6 Time of day (the user, 23 Nov)
The week between matchdays has **four club beats**. Time does not run in real time: **Continue** moves to the next beat, and visiting screens never moves the clock. The top bar shows a day-and-time chip next to the status ("WED · AFTERNOON").

| Beat | When | Light | Who's where |
|---|---|---|---|
| **Monday morning** | after the Week Summary | cool, bright daylight; office blinds half open | coach and Theo in the office; players who played ≥ 60' recovering in the dressing room; the owner in the boardroom only if a board review is due |
| **Wednesday afternoon** | the middle of the training week | warm low sun; long shadows on the training ground | the squad on the training ground doing the week's main session (§12.18); the physio with any injured player at the side of the pitch; Theo with a clipboard on the touchline |
| **Friday evening** | the day before the match | dusk turning to night; windows lit; the stadium floodlights tested once | the coach alone in the office or at the tactics board; the opponent report on the desk; the dressing room set out with shirts |
| **Matchday** | the fixture's kick-off slot (§10.3) | as the match (ART-DIRECTION §3.1) | players in the dressing room, the crowd arriving outside, the tunnel |

- **Events are scheduled into beats,** so they happen in the right place and time:
  - Monday: the Week Summary items, inbox, board reviews.
  - Wednesday: one-to-ones (§12.18.6), training incidents (§12.20), and players knocking about playing time (§12.9).
  - Friday: Theo's opponent report, warm-up scares are announced on matchday instead (§12.19.3), and the pre-match press for derbies.
- A beat with nothing to do is skipped by Continue.
- **Lighting:** each beat has one preset (sun or sky colour, intensity, window emissive, interior lamp levels) in `balance.ts → render.tod.*`. Rooms crossfade the preset over 1.2 s when the beat changes. On Low it's a cut.
- **Exterior and title:** the Title scene (`docs/design/title/`) uses the save's current beat; Matchday uses the night look when kick-off is Night.
- **Sound:** ambience follows the beat: birds and distant traffic in the morning, training shouts in the afternoon, quiet and a ticking clock in the evening (§17.5 loops get a `{room}_{beat}` variant where it matters; otherwise the room loop plays).
- **What it does not do:** no real-time clock, no NPC daily routines beyond the table above, no new rooms. It is about 2 days of M6b work on top of the rooms.

---

