<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 14. Match presentation

### 14.1 Playback
`MatchPlayback` (in `src/ui/screens/Match/playback.ts`, not in core) consumes the event stream and drives a **presentation clock** `pt` (match seconds). Each frame: `pt += realDelta × speedFactor`; events whose `t ≤ pt` are "started"; the choreographer interpolates within the current event using `(pt − event.t)/event.duration`.

Speed modes:
- **Key highlights** (default): only highlight windows (§14.6) play at 1.25×; between windows a time-lapse at 60× (max 3.5 s real time per gap) with the 2D radar overlay.
- **Extended**: highlight windows + every possession that reaches the ATT third, at 1.5×; gaps at 40×.
- **Full**: everything, user picks 2× / 4× / 8× (keys `+`/`−`).
- **Instant result** (key `I`): confirm, then jump to full time (worker `finishInstant`).
Pausing stops `pt`; the HUD and camera orbit still work while paused.

Target: a typical match at Key highlights = **50–80 seconds** real time.

### 14.2 Scene (three.js, `MatchScene.ts`)
- Renderer: `WebGLRenderer({ antialias: quality !== 'Low', powerPreference: 'high-performance' })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, exposure 1.0. Pixel ratio per §21.
- Scale: 1 unit = 1 metre. Pitch centre at origin, x along length, z across width (absolute frame `x` → `x − 52.5`, `y` → `y − 34` on the z axis), y up.
- **Pitch** (`pitch.ts`): plane 115 × 78 (with run-off). Grass from `textures/grass_albedo.webp` (tiled) + mowing stripes drawn in a shader (12 stripes along x, 6% brightness difference) — fallback: canvas-generated texture with noise and stripes. Line markings drawn into a separate 4096×2560 canvas texture (Medium/High) or 2048×1280 (Low) with correct FIFA dimensions (penalty area 16.5 m, six-yard 5.5 m, centre circle r 9.15 m, penalty spot 11 m, corner arcs r 1 m, penalty arc). Polygon offset to avoid z-fighting.
- **Goals**: `models/goal.glb` (fallback: white cylinders posts r 0.06, width 7.32, height 2.44, depth 2.0 net made of a `LineSegments` grid with slight sag). Net ripple on goal: animate vertices of the back net for 1.2 s.
- **Stadium** (`stadium.ts`): four stands from `models/stand_side.glb` and `models/stand_end.glb` (fallback: stepped boxes with seat-colour material in the home club's primary colour, roof plane), four `models/floodlight.glb` corner towers (fallback: cylinder + emissive box), advertising boards ring 1 m high at 4 m from the touchline with a scrolling canvas texture showing fictional sponsors (`content/sponsors` list of 12 invented brand names, e.g. "Halcyon Air", "Brightline Telecom") — never real brands.
- **Crowd** (`crowd.ts`): `InstancedMesh` of low-poly billboard quads (crossed quads) with a 4×4 sprite atlas `textures/crowd_atlas.webp` (fallback: coloured quads), counts per quality (§21). Colours biased to the home club's colours (65%) and the away club's (15% in one corner block). Idle bobbing in the vertex shader; on goals the scoring side's sections jump for 3 s.
- **Lighting**: Night/Evening: a hemisphere light (low), 4 spot/directional lights from the floodlight positions (only one casts shadows), skybox dark gradient with a faint star field. Afternoon: one directional "sun" (casts shadows), hemisphere light, sky gradient. Rain: particle system (instanced lines, 3k Medium / 8k High, none on Low), wet-grass darker tint, ground specular up. Exact colours, intensities and the post-processing chain: §14.10.
- **Players** (`players.ts`): `models/player.glb` (contract §18.3) cloned 22 times with `SkeletonUtils.clone`; kit applied by recolouring materials `Shirt`, `Shorts`, `Socks` (and a generated canvas texture for stripes/hoops/halves/sash/chevron on the `Shirt` material, numbers on the back drawn on the same canvas). Skin tones: 6 presets assigned deterministically per player. Fallback when the GLB is missing: capsule body (shirt colour) + sphere head (skin) + short cylinders for shorts/socks, with procedural leg swing.
- **Ball**: `models/ball.glb` (fallback: sphere r 0.11 with a canvas texture pattern), with a blob shadow decal under it.
- **Name labels**: above-head sprites (number + surname) on hover or for the ball holder only; toggleable.
- **Referee**: one figure in black (`player.glb` recoloured) following the ball at 15–20 m distance. Assistant referees (2) on the touchlines tracking the second-last defender x.
- **Dugouts and managers**: `models/dugout.glb` (fallback: box + bench). `models/manager.glb` (or player model in a coat colour) standing in the technical area; on goals: celebrate/dejected animations.

### 14.3 Choreographer (`choreographer.ts`)
Computes each player's target position every frame from the current event and team shapes; the player then **steers** toward it.
- **Formation anchors** in `formations.ts` (team's own frame, own goal at x = 0, y = 0 = team's left touchline; slots in the order used by `lineup`):
  - 4-4-2: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) LM(48,9) LCM(44,28) RCM(44,40) RM(48,59) LST(70,28) RST(70,40)
  - 4-3-3: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) DM(36,34) LCM(48,22) RCM(48,46) LW(72,10) ST(78,34) RW(72,58)
  - 4-2-3-1: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) LDM(38,27) RDM(38,41) LW(64,10) AM(62,34) RW(64,58) ST(80,34)
  - 3-5-2: GK(5,34) LCB(19,18) CB(17,34) RCB(19,50) LWB(46,6) DM(36,34) LCM(50,24) RCM(50,44) RWB(46,62) LST(72,28) RST(72,40)
  - 5-3-2: GK(5,34) LWB(30,6) LCB(19,20) CB(17,34) RCB(19,48) RWB(30,62) LCM(44,22) CM(42,34) RCM(44,46) LST(70,28) RST(70,40)
  - 4-1-4-1: GK(5,34) LB(24,8) LCB(19,26) RCB(19,42) RB(24,60) DM(34,34) LM(54,9) LCM(50,26) RCM(50,42) RM(54,59) ST(78,34)
  - 3-4-3: GK(5,34) LCB(19,18) CB(17,34) RCB(19,50) LM(48,8) LCM(44,27) RCM(44,41) RM(48,60) LW(72,12) ST(78,34) RW(72,56)
  Each slot also stores its `Position` (for ratings and involvement rows) — e.g. 4-4-2 slot 1 = LB.
- **Team shape transform** each frame (in the team's own frame, ball at `(bx, by)`):
  - In possession: `x = anchor.x × 0.85 + bx × 0.35 + 6 × (mentality Attacking ? 1 : mentality Defensive ? −0.5 : 0)`; width scale 1.1 (Wide 1.2, Narrow 0.95) around y = 34.
  - Out of possession: `x = anchor.x × 0.7 + bx × 0.3`, clamped so the back line x ≥ lineBase (Deep 12, Normal 18, High 28) − 6 and ≤ lineBase + 18; width scale 0.8 (Narrow 0.7); shift y toward `by` by 25%.
  - GK: x = clamp(bx × 0.12, 2, 16) in possession; on the goal line ±0.5 for shots; y follows ball y at 30%.
- **Event roles**: the actor is placed at the ball; the receiver runs to `event.to` arriving at `t + duration × 0.85`; the primary defender (`opponentId`) moves toward the actor/receiver line; for crosses, 3–4 attackers make runs into the box (near post, far post, penalty spot, edge) and 4 defenders mark them; for corners, the full set-piece setup (all CBs and STs up; defenders zonal on the six-yard line; one player on the near post); for free kicks, a wall of 3–5 defenders at 9.15 m; for penalties, everyone outside the box arc; for goal kicks, GK places the ball at the six-yard line; for kick-offs, both teams in their halves.
- **Steering**: max speed `5.5 + 3.5 × pace/99` m/s (sprinting only when > 70% of max), acceleration 6 m/s², arrival radius 0.6 m, separation force between players within 1.2 m. Facing: velocity direction, or toward the ball when slow.
- **Animation state** from speed: idle < 0.4, jog < 3.0, run < 6.0, sprint above; one-shot clips at event moments (Pass, Shoot, Header, Tackle, GK dive left/right by target.y sign, GK catch, Throw for throw-ins, Celebrate for the scorer and 3 nearest teammates, Dejected for the conceding GK). Cross-fade 0.15 s.
- **Ball flight**: ground passes linear with ease-out over `duration × 0.5`; lofted (long, cross, switch, clearance) parabolic with apex 4–12 m scaled by distance; shots: fast straight/curved path to `target` over 0.4–0.8 s; dribble: ball at the carrier's feet offset 0.7 m forward, small bounces. After a goal the ball rests in the net.
- **v1.8:** when physics is loaded, the steering above becomes the drive for physical bodies, and the ball curves above are replaced by real flight with drag, spin and bounce, solved to hit the same targets (§14.12). These kinematic rules stay as the fallback.

### 14.4 Cameras (`cameras.ts`)
- **Broadcast** (default): positioned at (x = ball.x × 0.85, y = 22, z = −62) looking at the ball with damping (0.08), FOV 32–40 zooming in when the ball is in a box.
- **Tactical**: high, top-down-ish (y = 75, pitched 65°), whole pitch visible.
- **Behind goal**: for set pieces and shots, behind the attacking goal at y = 6.
- **Player cam**: follows the ball holder at 12 m behind, 5 m up.
- **Free orbit**: mouse drag (left drag orbit, right drag pan, wheel zoom; limits: min distance 8, max 140, polar angle ≤ 85° so the camera never goes under the pitch). Use `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` (it ships inside the `three` package, so it is allowed).
- `C` cycles Broadcast → Tactical → Player → Free. Goal replays use their own cameras (§14.7).

### 14.5 HUD and overlays
See §11.16. The scoreboard bug animates the score digit on goals (scale 1 → 1.4 → 1 over 600 ms). A "GOAL" banner in the scoring club's colours slides in for 2.5 s (disabled with reduce motion → simple fade).

### 14.6 Highlight selection (`core/match/highlights.ts`)
Highlight windows (computed on the event stream as it arrives):
- Every `GOAL`: from 25 sim-seconds before the shot to 6 seconds after.
- Every `SHOT` with xG_ref ≥ 0.08 or on target: from 15 s before to 3 s after.
- `PENALTY_AWARDED`, `RED`, `INJURY`, the first `YELLOW` of each player, `POST`: from 8 s before to 4 s after.
- `KICKOFF` of each half: 6 s. `HALF_TIME`/`FULL_TIME`: whistle moment.
Merge overlapping windows. Extended adds every possession that enters the ATT third (from entry − 6 s until it ends).

### 14.7 Goal replays
After each goal (Key/Extended: always; Full: if the setting is on): replay the last 10 sim seconds before the goal from a different camera (behind-goal low or side close), at 0.6× speed for the final 3 s, with a "REPLAY" corner badge and a letterbox. `R` replays the last goal on demand. Skippable with Space/click. v1.8: replays play back the recorded physics buffer (§14.12.1), so falls and bounces repeat exactly.

### 14.8 Performance rules for the scene
- One `requestAnimationFrame` loop. No allocation per frame in hot paths (reuse vectors).
- Only one shadow-casting light; shadow map sizes per quality; static objects `matrixAutoUpdate = false`.
- Dispose all geometries, materials, textures and the renderer when leaving the match (verify no memory growth across 5 consecutive matches).
- Pause rendering when the tab is hidden.
- Load models with `GLTFLoader` + `MeshoptDecoder` (from the three package: `three/examples/jsm/libs/meshopt_decoder.module.js`). Load once, cache, clone per match.

### 14.9 2D fallback (`topdown2d.ts`)
If WebGL2 is not available or quality is "2D" (hidden option), render the same choreography on a `<canvas>` 2D top-down pitch: circles with shirt colours and numbers, the ball, simple trails. All HUD features still work.

### 14.10 Realism pass (`src/render3d/post.ts`, `environment.ts`, `beams.ts`)
Goal: a floodlit stadium that reads as real on a broadcast shot and up close, inside the §21.1 frame budget. Most of the realism comes from light and materials, not polygon counts. Every item below is switched by the quality preset (§21.2) in `quality.ts`, and every number goes in `src/config/balance.ts` under `render.*` (values in `docs/design/ART-DIRECTION.md` §3).
Post-processing and the environment pieces come from the `three` package (`three/examples/jsm/postprocessing/*`, `three/examples/jsm/objects/*`), like `OrbitControls`, so they are allowed. No other post-processing library.

**Post-processing chain** (Medium and High only; Low renders straight to the canvas with the renderer's own tone mapping):
1. `EffectComposer` with a `HalfFloatType` render target, MSAA `samples: 4` (WebGL2). Renderer `antialias: false` when the composer is on (the target does the antialiasing).
2. `RenderPass`.
3. High only: `GTAOPass` at half resolution (soft contact shadows where boots meet grass, under the stands' roofs, inside the goal frame).
4. `UnrealBloomPass` at half resolution: threshold 1.0 (only floodlight lamps, the scoreboard and the brightest highlights bloom), strength 0.55, radius 0.35. Never bloom the UI or whole kits; if kits glow, the threshold is too low.
5. `GradePass`: one small custom `ShaderPass` with lift/gamma/gain, saturation, contrast and a vignette (values in ART-DIRECTION §3.4). Runs in linear space before output.
6. `OutputPass` (ACES Filmic tone mapping + sRGB). When the composer is on, set `renderer.toneMapping = NoToneMapping` so tone mapping happens once.
Resize the composer and every pass on window resize. Dispose all render targets on leaving the match.

**Environment lighting** (`environment.ts`, all presets): build one environment map per match with `PMREMGenerator.fromScene` from a tiny scene: a gradient sky sphere (ART-DIRECTION colours for the match's time slot) plus four emissive quads where the floodlight banks are, and a dark ground disc. Assign it as `scene.environment` (never as the visible background). Dispose it on leaving the match. This is what makes kits, boots, the ball and metal look lit by the stadium instead of flat.

**Haze**: `FogExp2` in the sky's horizon colour, density per time slot (ART-DIRECTION §3.2). Exclude the HUD. The far stands should be slightly softer than the near ones.

**Floodlight beams** (`beams.ts`, Medium and High, night/evening only): one open cone mesh per tower from the lamp bank toward the pitch, length 85 m, end radius 16 m. Custom `ShaderMaterial`: additive blending, `depthWrite: false`, opacity fades along the cone's length and toward its silhouette edges (view-angle fresnel), base opacity 0.05 dry, 0.09 in rain. Plus one camera-facing glare sprite per lamp bank that bloom picks up. The beams must be subtle: on the broadcast camera you should only just see them.

**Pitch material**: `MeshStandardMaterial` with `grass_albedo.webp` + `grass_normal.webp` (normal scale 0.6), roughness 0.92 dry, texture anisotropy `min(8, renderer.capabilities.getMaxAnisotropy())` so the grass stays sharp at the broadcast angle. Mowing stripes stay in the shader (§14.2). Rain: multiply albedo by 0.82, roughness to 0.55, `envMapIntensity` from 0.5 to 1.1, so the floodlights streak across the wet grass.

**Model materials**: keep the GLB's PBR materials. Kit cloth roughness 0.7, skin 0.55, boots 0.35, ball 0.4, metalness 0 except goal posts' fittings and floodlight frames (0.8). If a GLB material has an `aoMap` or `lightMap` (baked by Claude for stands and props), use it; these are static objects, so baked light is free at runtime.

**Contact shadows**: every player and the ball keep a soft blob decal under them on all presets (on Medium/High it sits under the real shadow and grounds the feet).

**Budget guard**: if Medium misses the §21.1 frame budget on the target laptop, drop items in this order and record it in `DECISIONS.md`: bloom to quarter resolution → beams off → MSAA samples 2 → composer off. Never drop the environment map or the haze; they cost almost nothing.

