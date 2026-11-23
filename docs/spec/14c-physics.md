<!-- TOUCHLINE SPEC 1.8 · one part of the spec. Index and task map: ../SPEC.md -->
### 14.12 Physics and contact (v1.8, `src/physics/`)

**The user's decision (23 Nov):** the world must feel physical. The ball flies, spins, bounces and rolls. Players bump, barge, jostle and fall. The grass bends under feet and gets torn up. The coach collides with walls, pushes doors and touches things. This is **top priority** (milestone M5b, §23), and the user has asked that it not push back any other work.

#### 14.12.1 Engine and the one rule
- **Engine:** `@dimforge/rapier3d-compat` (§4). The `-compat` build embeds its WASM in the JS file, so there is no extra file to fetch and it works offline and from relative paths (§3).
  - It loads lazily in its own chunk (`manualChunks: { physics: ['@dimforge/rapier3d-compat'] }`).
  - Prefetch the chunk in the background once the Title is interactive, and call `await RAPIER.init()` while the match scene or a club room is loading. Never load it on the path to the Title (§21.1).
  - The APIs used here (`KinematicCharacterController`, `SphericalImpulseJoint`, `RevoluteImpulseJoint`, `configureMotorPosition`, `setCcdEnabled`, `castShape`) were checked against 0.21.0.
- **Where it runs:** on the main thread, inside `src/physics/`. It is presentation only, like `render3d/`. `src/core/**` never imports it (§3.7).
- **Step:** fixed at 1/60 s with an accumulator, at most 4 substeps per frame. Render positions are interpolated between the last two steps.
- **The one rule: the sim decides and physics acts it out.**
  - Physics never changes an event's outcome, actor, time or end point. Every event has a contract the presentation must keep (§14.12.2 and §14.12.3).
  - Bodies are driven towards the choreographer's targets (§14.3), and physics adds momentum, contact and falls on top.
  - If a body drifts past a contract tolerance, a correction force pulls it back over 0.2 s. A visible snap is a bug.
- **Replays:** the goal replay (§14.7) plays back a recorded ring buffer of the last 12 s of every body and bone transform. It does not re-simulate, so the replay always matches what the player saw.
- **Fallback:** if Rapier fails to load or init, everything falls back to the kinematic choreographer and ball curves of §14.3, and the game plays normally. `?dev=physics` draws every collider, contact point and IK target.
- All numbers go in `src/config/balance.ts → physics.*`.

#### 14.12.2 The ball (`ball.ts`)
**The body:** a dynamic sphere, r 0.11 m, mass 0.43 kg, CCD on (it must never pass through a post or the net at shot speed).

**Ground:** restitution 0.55 dry and 0.45 wet, friction 0.6.

**Forces added every step:**
- **Drag:** `F = −0.5 × 1.2 × Cd × A × |v| × v`, with A = 0.038 m², Cd 0.25 above 12 m/s and 0.45 below it (the drag crisis that makes a struck ball dip late).
- **Magnus (curl and dip):** `F = kM × (ω × v)`, with kM = 0.0045.
- **Rolling:** deceleration 0.55 m/s² dry and 0.40 wet (the ball zips on a wet pitch), and spin decay 1.5 /s on the grass.
- The ball mesh rotates from the body's real angular velocity, so a ball that skids, spins or backspins looks like it.

**Launch solver (`aim.ts`):**
- At the kick moment (§14.12.5), solve the launch velocity and spin so that the simulated flight, with drag and Magnus, reaches `event.to` at the arrival time.
- The arrival time is `t + duration × 0.85` for a pass, matching the receiver (§14.3).
- Use a shooting method: predict with the same integrator, correct, and repeat for at most 6 iterations. This runs once per kick and must take < 0.3 ms.

| Kick | Launch |
|---|---|
| Ground pass | Rolls the whole way. Solve the speed so it arrives at ≥ 3 m/s (the receiver traps it). Slight topspin. |
| Lofted (long, cross, switch, clearance) | Flight time T = arrival time − kick time. The apex follows from gravity, `h = 9.81 × T² / 8`, clamped to 2.5–14 m. If the clamp bites, aim at a landing point so that the bounce and roll reach the receiver on time. Crosses get sidespin away from the keeper (in-swinger or out-swinger from the taker's foot, §13.20.3). |
| Shot | Speed 18–32 m/s from finishing or longShots and the distance. Aim at `event.shot.target`. Shots from outside the box and direct free kicks get curl from sidespin (side by foot). Low shots skid and bounce. |
| Dribble | The carrier's foot taps the ball forward every 0.5–0.9 s with a small impulse (from dribbling: lower dribbling means bigger touches), so it rolls 0.8–1.8 m ahead and he catches it up. |
| Header | An impulse at the head bone towards the header's target. |

**Outcome contracts (shots):**

| Outcome | What the ball must do |
|---|---|
| GOAL | Crosses the line inside the frame, hits the net collider and drops. The ball rests in the net by physics, with no snap. |
| Saved and caught | Meets the keeper's hand colliders, then attaches to the hands. |
| Parried | Deflects off the hands to the event's rebound point. |
| POST | Aimed at the post or bar surface, and rebounds off it with restitution 0.75. |
| Wide or over | Goes past the frame into the boards or the crowd net. |
| Blocked | Meets the blocker's body collider. |

**Net:** a kinematic box collider behind the goal line with restitution 0.1 and high damping. The §14.2 vertex ripple is centred on the real contact point and scaled by the impact speed.

**Tolerances (tested, §14.12.8):** the ball arrives within 0.4 m and 0.1 s of each contract.

#### 14.12.3 Players' bodies and contact (`bodies.ts`, `contact.ts`)
**The body:**
- Each player is a dynamic capsule (r 0.3, half-height 0.6) with rotation locked.
- Mass is `65 + 25 × strength/99` kg, so strong players hold their ground.
- The §14.3 steering gives a desired velocity, applied as a force capped at the §14.3 acceleration (6 m/s²). Contact between bodies then happens on its own: shoulders meet in a chase, the box is crowded at corners, and a run gets checked by a defender.

**Contact moments** (staged from events, then resolved by physics):

| Moment | What happens |
|---|---|
| Shoulder charge (a contested chase or a DUEL) | Both players lean in (an additive upper-body lean of 10–18°). The impulse each takes is split by mass and strength. The loser staggers (`Stumble`) and loses 1–2 m. 20% of losers go down (§14.12.4) when the event is a foul. |
| Tackle | Standing tackle: the tackler's body drives into the ball's line. Sliding tackle (`SlideTackle`, more likely when the tackler is behind): his capsule slides on low friction for 2–4 m and leaves a mark (§14.12.6). A clean tackle hits the ball first and the attacker hurdles or stumbles. A FOUL catches the leg and the attacker falls. |
| Aerial duel | Both jump (vertical impulse from jumping), and their bodies meet in the air. The loser is knocked sideways and lands off balance. |
| Set-piece jostle | Before a corner or wide free kick is delivered, each marker and attacker pair holds and pushes (additive `Grapple` arms, small alternating impulses). The keeper is screened by the `keeperScreen` job (§13.20.1). |
| Keeper | A dive becomes a launched body towards the save point, landing in a partial ragdoll. Keepers collide with posts and with attackers when coming for crosses. |
| Pitch edges | The advertising boards (1 m high) and the dugouts are colliders. A player running off the pitch checks his speed, steps over or bumps the board. |

**Priority rule:** a player the next event needs (the receiver, shooter or taker) gets drive force ×3, and contacts against him are capped. The sim's actors always arrive on time.

**Separation:** the §14.3 separation force is replaced by real collisions. Capsule centres are never closer than 0.45 m except during a fall.

#### 14.12.4 Falls and get-ups: active ragdoll (`ragdoll.ts`)
**The ragdoll:**
- Built from the shared skeleton (§18.3): 11 bodies (pelvis, chest, head, and the upper and lower arms and legs).
- Capsule sizes come from the bone lengths.
- Joints:
  - Spherical joints with cone limits: hips 70°, shoulders 90°, neck 40°, spine 30°.
  - Revolute joints with limits for knees (0–140°) and elbows (0–145°).

**Triggers:** a FOUL (the fouled player), an INJURY, a lost aerial duel (30%), a slide tackle that misses (the tackler), the keeper's dive landing, and a shoulder-charge foul.

**Motion:**
1. The ragdoll takes over from the current animation pose, with each bone's velocity, and the contact impulse is applied at the real contact point.
2. **Active, not limp:** joint motors pull towards a protective pose (arms out to break the fall, chin tucked) with strength 0.15–0.3. A fall should look like a footballer going down, not a doll dropping.
3. When the pelvis speed stays below 0.3 m/s for 0.4 s (at most 1.6 s after the trigger), blend over 0.3 s into `GetUpFront` or `GetUpBack`, chosen by whether the pelvis faces up or down, and then back to steering.
4. INJURY stays down for 4–8 s with `HoldLeg`.

**Limits:** at most 3 ragdolls at once (Medium: 2). On Low, play `FallForward` or `FallBack` clips instead, with no ragdoll.

#### 14.12.5 Feet, kicks and heads: IK (`ik.ts`)
Use an analytic two-bone IK solver written by us (thigh–shin and upper arm–forearm), plus look-at on the neck and head.
- **Foot planting:** a foot is locked to the ground while it's planted (the foot bone is below 0.05 m and slow in the clip), with the pelvis lowered to fit. Feet never slide on the grass.
- **Kick contact:**
  - Each kick clip has a contact frame (`physics.kickFrame.Pass`, `.Shoot`, `.Cross` and `.Clear`, measured from the delivered clips and stored in `balance.ts`).
  - The clip is started early so that the contact frame lands on `event.t`.
  - The kicking foot's IK target is the ball at that frame, and the launch (§14.12.2) fires on that exact step. The ball leaves the boot.
- **Headers:** the neck and spine lean so the forehead meets the ball.
- **Look:** heads track the ball (yaw ±60°). The receiver looks at the passer before the pass.

#### 14.12.6 Grass that moves (`grass.ts`, `trample.ts`)
**Blades:**
- Instanced blade meshes (5 vertices, tapered, 3–5 cm tall, slightly taller than real 25 mm match grass so they read in close shots).
- They are drawn in 4 × 4 m chunks only near the camera, with density falling off with distance and a fade into the pitch material (§14.10).
- From the broadcast camera, the pitch still reads as the material. The blades show in the close cameras: Player cam, Behind goal, goal replays, and Free orbit up close.

**Ridges (the mowing stripes become physical):**
- Blades in alternate stripes lean ±20° along x.
- On Medium and High, the stripe shading comes from that lean against the light, replacing the flat 6% multiplier. Low keeps the multiplier (§14.2).

**Wind:** a gust-noise sway in the vertex shader. The amplitude rises in rain.

**Trample map:**
- A render target over the pitch: R = flatten amount, GB = flatten direction.
- **Each step, stamp:**
  - every planted foot (r 0.25 m, stronger when sprinting)
  - the rolling ball (r 0.12)
  - sliding and fallen bodies (capsule streaks)
- Blades bend away from the stamp and spring back with half-life 4 s dry and 9 s wet.
- **The map also shifts the pitch's sheen** (flattened grass shows its lighter side). This makes footpaths and the ball's track visible from the broadcast camera on every preset that has the map.

**Wear map (it stays for the whole match):**
- Slides and falls tear dark streaks.
- The goalmouths and the centre circle wear in slowly over 90 minutes.
- Rain doubles the size of a divot.
- Turf chunks (6–12 instanced bits per slide) and water spray (wet: ball bounces, slides, sprints) are small particles.

**Sizes and counts per preset:** §21.2.

#### 14.12.7 The coach and people in the club (M6b, `src/club3d/` using `src/physics/`)
**The world:**
- Each room's Rapier world uses the shared floor coordinates (M6b task 1).
- Every wall, door frame and prop has a static collider (box or capsule, as already required).
- **Doors** are dynamic bodies on revolute joints (0–100°) with a soft closing spring.
- **Loose props** are light dynamic bodies that the coach's body and hands push: chairs, cones, training balls, bottles, the bin.

**The coach's body:**
- He is a Rapier `KinematicCharacterController`: capsule r 0.28 and height 1.78, max step 0.3 m, max slope 40°, snap to ground 0.2, offset 0.02.
- The nav-graph walk (§11.25.2) now feeds a desired velocity into the controller instead of setting positions, so he slides along walls, steps round props and stops against people. Free walking (§24) uses the same controller.
- Other people are kinematic capsules, and both sidestep when paths cross.

**Touch and reach (IK, `reach.ts`):** hotspots (M6b task 1) gain optional `touch` points: `{ hand: 'L' | 'R' | 'auto', point, normal, kind: 'handle' | 'push' | 'rest' | 'brush' }`.

| Kind | Where and what |
|---|---|
| Door handles | The hand reaches the handle 0.35 s before arrival. Then he pushes: the hand applies force to the door body, and the door swings open and swings back after him. |
| Walls | Within 0.45 m of a corridor wall, the near hand sometimes brushes it (15% of walks, 0.6 s), sliding along the surface. Turning a corner close to a wall: hand on the corner. |
| Desk, board table, whiteboard | When standing at the hotspot, his hand rests on the edge. On Tactics, when the user drags a magnet, his hand reaches towards that point on the board, 120 ms behind the cursor. |
| Lockers | Clicking a locker swings its door open on its hinge. |
| Chairs | Sitting pushes the chair back a little (the office chair rolls). |

**Feet and head:**
- Feet are IK-planted on steps, the tunnel slope and the training-ground grass (the training pitch uses §14.12.6 at the Medium blade count).
- His head looks at whoever is speaking or at the hotspot (±60°).

**Secondary motion:** the coat tail and tie hang on short spring-bone chains (verlet, 3 bones each) and swing as he walks and stops (`Coat_Tail_*` and `Tie_*` bones, optional in `manager.glb`, §18.3).

**Cameras:** the look-around and follow cameras (§11.25.4) use sphere casts against the colliders and pull in along the view ray, replacing the bounding-box clamp.

#### 14.12.8 Budgets and tests
**Budgets:**
- Match physics step ≤ 2.0 ms per frame on the §21.1 laptop at Medium: 22 capsules, the ball and up to 2 ragdolls.
- Grass ≤ 2.5 ms of GPU time.
- Club rooms physics ≤ 1.0 ms.
- Physics chunk ≤ 1.8 MB gzip (Rapier 0.21.0 is 1.66 MB), prefetched in the background once the Title is interactive (§21.1).

**Tests (vitest, in node; the compat build runs there):**
- **Solver:** 300 random passes, lofted balls and shots, with drag and spin, arrive within 0.4 m and 0.1 s.
- **Contracts:** in a headless physics playback of 5 seeded matches, every GOAL ends at rest inside the net, every POST touches the frame, and every caught save ends in the keeper's hands.
- **No tunnelling:** over those matches, capsule centres stay ≥ 0.45 m apart except during falls.
- **Get-ups:** every non-injury fall returns to steering within 2.0 s.
- **The coach:** over 500 random walks, the controller never ends inside a collider and every walk still finishes in ≤ 2.5 s (§11.25.2).
- **Replay:** the replay buffer gives identical transforms when played twice.

**Captures** for the Claude review (`?screen=match&state=…`): `foul`, `slide-rain`, `corner-jostle`, `aerial`, `curler`, `post`, `ball-in-net`, `grass-close`, `wear-late`, plus every M4 state again. In the club (M6b): `door`, `corridor-brush`, `desk-rest`, `board-reach`.

---
