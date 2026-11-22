# SPEC 1.7 proposal: club spaces, living people, painted faces

Status: **approved 22 Nov 2026 and written into SPEC 1.7** (§11.25, §14.11, §16.9, §17.4–17.5, §18.6, §21, M6b, §24 extras). All §7 decisions are made: the coach always walks (skippable), the coach is voiced, there is a separate boardroom, and Squad, briefings and talks are in the dressing room, with tactics planned in the office with Theo. This file is the record; the SPEC wins. Once approved, it is written into SPEC 1.7 (new §11.25, §14.11, §18.6, and milestone M6b). Until then the SPEC wins.

## The idea in one line
You play the coach living the club's week: the menus become places in one club building. The coach walks between rooms, players react to what he says, and reporters question him, all filmed like a TV documentary about a manager's week.

## What stays the same
- **Depth comes first.** Every screen, rule and number in the SPEC stays. A room is a frame around its screen, not a replacement for it. M6b starts only when M6 is accepted.
- **All text is still game UI:** sharp, the §19 tokens, keyboard-reachable. Nothing readable is baked into a model or image.
- **The top bar and its tabs stay** on every screen (§11.0). A tab click is now also a trip to a room.
- **Offline, no keys, fallbacks for everything:** with no models loaded, the rooms are plain boxes and the people are capsules, and the game still plays.

---

## 1. The club building (scenes)

Each room is one small 3D set: walls, floor and windows built in code; a few Meshy props; fal images through the windows. Only the current room and its corridor are loaded and drawn.

| Scene | What's in it | Screens it holds |
|---|---|---|
| **Exterior** | The club at dusk: brick main stand, floodlights warming up, car park | Title, New Game (the camera flies in on Start) |
| **Corridor** | A short corridor with painted door signs; a door's light comes on when hovered | The map between rooms |
| **Office** | Desk, chair, lamp, phone, wall TV, window onto the pitch, **the sideways whiteboard (our design) on the wall**, a second chair for Theo | Hub, Inbox, Club (finances), Transfers, **Tactics**: you plan with Theo at the whiteboard, and he sits in and gives his §15.2 report. **On-air screens (League, Fixtures, Week Summary) play on the wall TV:** the camera pushes into the TV and the broadcast UI fills the screen. |
| **Boardroom** (the user, 22 Nov) | A long table, leather chairs, portraits of past chairmen (programme-print style, no text), the owner at the head of the table with 2 directors | Board Meeting at the start, board reviews (§12.7 confidence changes, budget talks from the Club screen), Sacked (the owner tells you to your face) |
| **Dressing room** | Lockers with your players' shirts and numbers (drawn by the game), benches, a tactics board | Squad (click a locker to open that player's profile). **Pre-Match briefing:** you present the plan made in the office on the dressing-room board, with key battles and who does what, and the players listen and nod. **Team talks** before the match, at half-time (praise, caution or a real shout; the §12.8 tones) and at full-time. Half-Time, Full-Time. |
| **Tunnel** | A concrete tunnel and the pitch light at the end | The walk-out into the 3D match (connects to M4's match intro) |
| **Training ground** | A grey afternoon, cones, mannequins, a small stand, a clipboard in the front of the shot | Training |
| **Press room** | A table with microphones, a club backdrop (pattern only, no text), rows of reporters, camera flashes | Press Conference |

### 1.1 Moving between rooms
- Clicking a tab or a door makes **the coach walk there**. The camera follows behind him like a documentary shot, and he opens the door. **Each walk takes at most 2.5 s.**
- **Any click or key skips to arrival.** Number keys `1`–`9` cut straight to the room with a quick wipe (no walk).
- New setting **"Coach walks": Always / First visit each matchday / Never**. Default Always. *(Decision for the user: see §7.)*
- **Target:** walks add no more than 3 minutes to a full season, so it still fits in about 30 minutes (§2).

### 1.2 How the UI sits in a room
- When the camera settles, the room's screen slides in as its own object: papers on the desk, the board on the wall, the clipboard at training. Layout and content are the current screen designs, re-skinned to sit in the shot.
- **The room is the frame and the UI is the content.** The room stays visible around the edges. Behind text, panels are opaque, so legibility never depends on the 3D.
- The §19.8 craft bar and the "no page scroll on office screens" rule still apply.

---

## 2. Living people

### 2.1 One skeleton for everyone
The coach, players, reporters and the chairman share one rig. Clips are made once and reused on everyone. Meshy rigs the body; the face uses §3.

**New clips** (added to the §18.3 player list; the same names go on `manager.glb` and the new `person.glb`):
`Walk`, `DoorOpen`, `Sit`, `SitIdle`, `SitNod`, `SitHeadDown`, `SitClap`, `Listen`, `Nod`, `TalkGesture`, `ArmsFolded`, `FistPump`, `Point`, `Write`, `RaiseHand`.
Missing clips fall back: Sit* → `SitIdle` → `Idle`; `TalkGesture`/`Nod`/`Listen` → `Idle`; `Walk` → `Jog` → `Idle`; others → `Idle`. Clips are crossfaded (0.25 s).

### 2.2 Where they move
- **The coach:** walks the corridor on a fixed path (no steering by the player); in rooms he stands or sits at set marks; he gestures while talking.
- **Team talks (dressing room):** players sit on the benches. After a talk, **each player reacts according to his real §12.8 result**:

  | Morale change | Body | Face |
  |---|---|---|
  | Big rise | `FistPump` or `SitClap` | happy |
  | Rise | `SitNod` | happy |
  | No change | `Listen` | neutral |
  | Fall | `SitHeadDown` | worried |
  | Big fall (or a volatile personality) | `ArmsFolded`, stares at the coach | angry |

  Reactions start at staggered times (0.1–0.6 s) so they never move in sync. This shows the sim working, so it's the last thing to cut.
- **Training ground:** 10–12 players do a drill that matches the week's focus (rondo for passing, shooting drill, fitness runs, set-piece walk-through). They move with the M4 choreographer's steering code and the match clips.
- **Press room:** 6–8 seated reporters `Write` and idle. The one asking a question leans in or does `RaiseHand` and speaks (voiced, §2.6). Camera flashes go off with `sfx/camera_shutter.mp3`.

### 2.3 Players knock on your door (approved by the user, 22 Nov)
- When a §12.9 conversation triggers, it no longer just arrives in the inbox. On the next visit to the office, there is a knock. The player walks in, sits across the desk, and the conversation happens face to face.
- His face and body follow the conversation: worried or angry when he raises the issue; happy, neutral or angry after your answer, from the §12.9 result. If he's unhappy, he leaves with `ArmsFolded` before walking out.
- "Talk to player" from the Squad or Profile screen does the same in reverse: the coach walks to the dressing room and they talk by his locker.
- The inbox item stays, as the record (and for players who turn walks off).

### 2.4 Theo, the assistant, as a person (approved by the user, 22 Nov)
Theo (§15, staff in §12.17.1) uses `person.glb` with his own look (tracksuit tint, clipboard) and his own face atlas.
- **Office:** he walks in with the week's tips (§15.3). On Tactics he sits with you at the whiteboard and gives the opponent report (§15.2). His Apply suggestions are where he points at the board.
- **Dressing room:** he stands beside you during team talks and at half-time, and gives his §15.5 analysis there.
- **Match:** when an in-match tip fires (§15.4), the touchline camera (§2.5) shows him leaning in to whisper. The advice card still appears in the HUD with Apply.
- He is voiced only if credits allow (about 20 short lines: "Gaffer.", "Look at their left side.", and so on). Otherwise he uses captions with the text-rhythm mouth.

### 2.5 The coach on the touchline (approved by the user, 22 Nov)
- The match (M4) gets a technical area: the coach, Theo, and the bench (at most 5 substitutes on view).
- **Short touchline cuts (about 2 s, broadcast-style)** after: our goals (`Celebrate`, the bench jumps up), goals against (`HeadInHands`, the bench sits still), red cards and big misses (`Shout`), and a substitution you make (`Point`, the sub warms up).
- Cuts follow the playback mode: Key highlights shows them, Full shows only goals, and the instant result shows none. They never hide a goal or the replay.
- **New `manager.glb` clips:** `HeadInHands`, `Shout`, `ArmsFolded`, `Walk`. The bench people use the `Sit*` clips.
- **Performance:** bench people only animate while a touchline cut is on screen; otherwise they are frozen and use the low LOD.

### 2.6 Who speaks
- **Reporters:** voiced questions, already in the SPEC (ElevenLabs, offline files).
- **The coach is voiced** (the user, 22 Nov). Every line he says is a pre-made ElevenLabs file (offline, no keys in the build): press answers, team talks (the §12.8 tones × pre, half and full time; the half-time shout really shouts), the pre-match briefing lines, and his lines in player conversations. Captions stay on screen too. Lines that use names the game fills in (a player's name, the opponent) are written so the voiced part never says the name ("Look at me. That wasn't good enough."), and the name appears only in the caption.
- **The owner and the directors:** voiced (a few lines each).
- **Theo:** voiced (about 20 lines).
- **Credits:** the coach is the largest set, roughly 200–250 lines. I count characters against the ElevenLabs plan before generating. If it doesn't fit, the press answers go first to captions with the text-rhythm mouth.

---

## 3. Painted face layers

The art direction already asks for slightly simplified faces, and painted features suit that look. Real lip-sync is not the goal: the mouth must move with speech and the face must show a feeling.

### 3.1 How it's built
- Each speaking character's head carries a separate mesh `Face`: a thin curved patch fitted over the face, parented to the `Head` bone, with its own 0–1 UVs. Claude fits it in `tools/` so it works whatever UVs Meshy produces.
- The `Face` material samples one **face atlas** (1024² WebP, transparent background, a 4×4 grid of cells). The features are drawn dark and tinted by the character's skin tone:
  - eyes: open, half, closed
  - brows: neutral, raised, angry, worried
  - mouth: closed, small, open, wide, smile, frown, "O"
- A small shader shows one eyes cell, one brows cell and one mouth cell, and **crossfades** between old and new cells (mouth 60 ms, brows and expressions 150 ms).
- Atlases: coach, player (shared by all players), reporter, chairman. That's 4 files, about 0.4 MB in total.

### 3.2 Expressions
Five moods: **neutral, happy, angry, worried, shocked**, each a preset of brow and mouth-rest cells. Small touches always run: a blink every 2–6 s at random, a slight head tilt while listening, and the eyes turning towards whoever is speaking.

### 3.3 The mouth
- **When there is audio:** an `AnalyserNode` on the voice reads its loudness every frame and maps it to closed / small / open / wide, with hysteresis and a 70 ms minimum hold so it doesn't flicker.
- **When there is no audio** (coach captions): the mouth opens and closes in a rhythm made from the caption's syllables (about 5 per second, with pauses at commas and full stops).
- **Who gets faces:** only the speaker and the person being spoken to. Everyone else keeps a static neutral face plus body language, which keeps it cheap.

### 3.4 Cameras
Mid-distance shots only (waist-up at the closest). Faces never fill the screen. This is the main defence against uncanny faces.

---

## 3b. Room sound (approved by the user, 22 Nov)
Each scene gets an ambience loop. Loops crossfade over 0.6 s as the coach walks between rooms, and one-shots play on events. All are made with ElevenLabs sound effects and go in `audio/ambience/` and `audio/sfx/`.

| Scene | Loop | One-shots |
|---|---|---|
| Exterior | Wind, distant traffic, a far-off gull (coastal towns, ART-DIRECTION §1) | Car door |
| Corridor | Building hum | Footsteps on lino (synced to the `Walk` clip), door open and close |
| Office | Clock tick, rain on the window in wet weeks | Phone ring (chairman and board messages), knock on the door, paper |
| Dressing room | Low chatter, a dripping shower | Studs clacking on tile, a locker door bang |
| Tunnel | Crowd heard through concrete, rising | Studs on concrete |
| Training ground | Wind, distant shouts, ball strikes | Whistle, cone kicked over |
| Press room | Murmur, chairs | Camera shutter bursts (existing file), a mic tap |

The ambience volume follows the existing music and SFX sliders (§20). The loops are kept quiet enough that UI sounds (§19.7) still read clearly over them.

---

## 4. Performance (additions to §21)
- **Animated people:** 12 at most on screen; skinned meshes 12k triangles at most each.
- **Each room:** at most 120k triangles, 120 draw calls and 40 MB of textures on the GPU.
- **Frame rate:** 60 fps on Medium at 1080p on the reference laptop.
- **When a screen is open and nothing big is moving:** the 3D drops to 30 fps.
- **Low preset:** after the camera settles, the 3D freezes to a still frame with no animated people; walks become cuts.
- **Loading:** the club spaces load lazily after the Title; they must never delay the first frame (§11.1). Extra download is 12 MB at most.

## 5. Assets (Claude)

| Asset | Source | Notes |
|---|---|---|
| `models/person.glb` | Meshy | Reporter and chairman body, shared rig, materials `Jacket`, `Shirt`, `Trousers`, `Shoes`, `Skin`, `Hair` (tinted per person for variety) |
| `manager.glb`, `player.glb` | Meshy | Existing contracts plus the §2.1 clips and the `Face` mesh |
| Room props, about 15–20 | Meshy | Desk, chair, lamp, phone, TV, lockers, benches, whiteboard, mic table, cones, mannequins, camera tripod, box (for Sacked) |
| Face atlases (4) | Drawn or fal, then cleaned by hand in `tools/` | §3.1 grid, programme-print style line weight |
| Window views and exterior backdrop | fal | Pitch at night from the office, training ground, car park; no readable text (ART-DIRECTION §2) |
| Voices | ElevenLabs | Reporter questions (already planned); **the coach (about 200–250 lines)**; Theo (about 20); the owner and directors (about 15) |
| Boardroom props | Meshy | Long table, leather chairs, frames |
| Room ambience and one-shots | ElevenLabs SFX | 7 loops and about 15 one-shots (§3b) |
| Theo's face atlas | as the other atlases | His own look |

**Risk:** Meshy credits. 1,000 credits on the $1 plan must cover players, the manager, `person.glb`, rigging, clips and props. **First test once the key is in:** one rigged person with 3 clips and a fitted `Face` patch. If it looks wrong, we stop and rethink before spending more.

## 6. Milestone M6b: Club spaces (after M6, about 5 days, before M7)
Gemini is about two weeks ahead of the M-schedule, so this fits without moving M7–M9.

1. Scene manager, corridor, camera rails, coach walk with skip, nav mapping, "Coach walks" setting. Fallback rooms as boxes and people as capsules.
2. Room shells (code) and each screen re-framed in its room. Frame-rate drop and the Low-preset still.
3. People system: shared rig loader, clip mixer with fallbacks, marks and paths, sitting.
4. Face layers: `Face` shader, blink, expressions, audio-driven and text-rhythm mouth.
5. Dressing room: the pre-match briefing, team-talk reactions from §12.8 results; Pre-Match, Half-Time and Full-Time live here. Boardroom: Board Meeting, board reviews, Sacked.
6. Press room: reporters, voiced question, raised hands, flashes.
7. Tunnel walk-out into the M4 match intro.
8. Training ground drills by focus.
9. Players knocking on the door: §12.9 conversations become office scenes (§2.3).
10. Theo in the office, dressing room and match (§2.4).
11. Touchline cuts during the match, with the bench (§2.5).
12. Room ambience and one-shots (§3b).
13. Capture `docs/screens/M6b/` and a performance run (this is the review gate for Claude).

This is now about 6–7 days, not 5. Gemini's lead still covers it.

**Acceptance:** everything still works with no assets; every screen is reachable by keyboard; offline; 60 fps on Medium; walks add ≤ 3 min per season; team-talk reactions match the morale results in a test.

**If time runs short, cut in this order:**
1. training drills (players stand in a still drill pose)
2. press-room reporter animation (they stay seated; the question is still voiced)
3. Theo in the match (his tips stay as HUD cards)
4. the bench in touchline cuts (only the coach is shown)
5. the coach's walk (becomes a camera glide)
6. faces on everyone but the coach

Team-talk reactions, players knocking on the door and room sound stay.

## 6b. If time and credits allow (the user, 22 Nov: keep them, do them only if there is room)
Start these only after M6b is accepted and M7 is on track. Do them in this order.
1. **A club that changes over the season:** the trophy cabinet fills, the weather turns wintry by December, the office gets messier during a losing run, and fans outside cheer or boo by form on arrival.
2. **Signing day:** a new player shakes your hand and holds up the club scarf for the photographers in the press room.
3. **The physio room:** injured players on a treatment table, and you can visit them (ties into §12.5).
4. **Big endings:** a trophy lift on the pitch if you win the league; packing your box if you're sacked.

## 7. Decisions for the user
1. ~~"Coach walks" default~~ **Decided 22 Nov:** always walk, skippable; setting on/off.
2. ~~Voiced coach~~ **Decided 22 Nov:** the coach is fully voiced (§2.6).
3. ~~Board meeting~~ **Decided 22 Nov:** a separate boardroom with the owner (§1).
4. ~~Squad~~ **Decided 22 Nov:** Squad, the pre-match briefing and team talks are in the dressing room. Tactics is planned in the office with Theo, so the separate tactics room is gone (§1).
