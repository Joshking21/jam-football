<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 14.11 People and painted faces (v1.7, `src/club3d/people.ts`, `behaviours.ts`, `faces.ts`, `mouth.ts`)

#### 14.11.1 One rig for everyone
The coach (`manager.glb`), players (`player.glb`), and reporters, directors, the owner and Theo (`person.glb`) share one skeleton and one clip name list (§18.3), so any clip plays on anyone. Crossfade 0.25 s between clips. Each person gets a random clip time offset and a 0.95–1.05 playback rate so that groups never move in sync. In-place locomotion; paths move the root.

#### 14.11.2 Team-talk reactions (dressing room)
Players sit on the benches around the room (`SitIdle`), facing the middle. The scene follows §11.25.5. After a talk, each player reacts according to **his real §12.8 result**, starting 0.1–0.6 s after the line ends (random per player):

| His morale change | Clip | Face mood |
|---|---|---|
| ≥ +4 | `FistPump` (standing up) or `SitClap` | happy |
| +1 to +3 | `SitNod` | happy |
| 0 | `Listen` | neutral |
| −1 to −3 | `SitHeadDown` | worried |
| ≤ −4, or a Temperamental sign flip | `ArmsFolded`, eyes on the coach | angry |

The briefing: players `Listen`, the 2–3 players named in key battles `SitNod` when named, and the coach `Point`s at the board. Reactions are presentation only; they never change a number.

#### 14.11.3 Players at the door (conversations, §12.9)
- When a §12.9 conversation triggers, there is a knock (`sfx/door_knock.mp3`) on the coach's next office visit. The player walks in and sits across the desk, and the conversation screen opens on the desk. His opening uses the type's mood: `playing_time` worried or angry, `contract` neutral, `unhappy` angry, `praise` happy.
- After the reply, his face follows the reply's morale effect (+ happy, 0 neutral, − angry). If the effect is negative he leaves with `ArmsFolded`, otherwise with a `Nod`.
- "Talk to player" from Squad or Profile plays the same scene by his locker in the dressing room.
- The inbox item stays, as the record and for players who turn walks off.

#### 14.11.4 Other rooms
- **Theo** (`person.glb`, tracksuit tint, clipboard, his own face atlas): walks into the office with the week tips (§15.3). Sits with the coach at the whiteboard on Tactics and gives the opponent report (§15.2); he `Point`s at the board when an Apply suggestion is shown. Stands beside the coach for team talks and gives the §15.5 half-time analysis.
- **Training ground:** 10–12 players do a drill matching the week's team focus (§12.3): a rondo for passing, a shooting drill, fitness runs, a set-piece walk-through. Movement reuses the §14.3 steering and the match clips. At most 12 animated people.
- **Press room:** 6–8 seated reporters `Write` or idle. The journalist asking the question leans in or `RaiseHand`s and speaks (`vo/press/`). Camera flashes (white point lights, 80 ms) fire with `sfx/camera_shutter.mp3` after the coach answers.
- **Boardroom:** the owner speaks, and the directors `Listen` and `Nod`. Faces follow board confidence: ≥ 60 happy, 30–59 neutral, < 30 worried, sacking angry.

#### 14.11.5 The coach on the touchline (match, `render3d/touchline.ts`)
- The M4 dugout area gets the coach, Theo, and at most 5 substitutes on view.
- **Touchline cuts (about 2 s, broadcast-style, from a fixed touchline camera):**
  - our goal: coach `Celebrate`, bench jumps up
  - goal against: coach `HeadInHands`, bench still
  - our red card and big misses: coach `Shout`
  - our substitution: coach `Point`, the sub jogs to the line
  - an assistant tip firing (§15.4): Theo leans in to whisper; the HUD card still appears with Apply
- Cuts follow playback: Key highlights shows all of them, Full shows only goal cuts, Instant shows none. A cut plays after the goal replay, never instead of it, and never during live play near either box.
- Bench people animate only while a cut is on screen; otherwise they are frozen at the low LOD.

#### 14.11.6 Painted face layers (`faces.ts`)
- Each speaking character's head carries a separate mesh `Face` (§18.6): a thin patch over the face, parented to the `Head` bone, with its own UVs. Its material samples a **face atlas** (§18.6) and draws three cells: eyes, brows and mouth. A small shader crossfades the old cell into the new one: mouth 60 ms, brows and expressions 150 ms. The features are dark and multiplied by the skin tone, so they sit on the skin rather than on top of it.
- **Moods:** neutral, happy, angry, worried, shocked. Each mood is a preset of brows and the resting mouth.
- **Always running:** a blink every 2–6 s (random), a 3–5° head tilt while listening, and eyes turning towards whoever is speaking (head bone yaw, ±25° max).
- **Who gets faces:** the person speaking and the person being spoken to animate their face. Everyone else shows a static neutral face and uses body language only.

#### 14.11.7 The mouth (`mouth.ts`)
- **With audio:** an `AnalyserNode` on the voice's source reads its RMS loudness every frame and maps it to closed / small / open / wide. Use hysteresis (thresholds in `balance.ts → faces.*`) and a 70 ms minimum hold so it never flickers. This is not lip-sync and must not try to be.
- **Without audio** (a missing file, or voice off in settings): the mouth opens and closes to the caption's rhythm, at about 5 syllables per second with pauses at commas (150 ms) and full stops (300 ms).
- `TalkGesture` plays on the speaker every 3–5 s of speech.

#### 14.11.8 Cameras for people
Mid-distance shots only: waist-up at the closest, and faces never fill the screen. This is the main defence against uncanny faces (ART-DIRECTION §1).

---

