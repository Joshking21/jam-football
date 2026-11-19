# Art direction

Version 1 · 19 Nov 2026 · Owner: Claude · Approved direction: the user, 19 Nov 2026

This file defines how every model, texture and image in the game looks. Claude makes the assets to it. Gemini uses its numbers for the realism pass (SPEC §14.10) and makes the fallbacks match it. Where this file and SPEC disagree on behaviour or data, SPEC wins; on look, this file wins.

---

## 1. The look in one line

**A real floodlit stadium, filmed by a broadcaster, in a league that prints its own matchday programme.**

- **3D (the match):** realistic stadium, light, grass and materials. Players and managers have realistic bodies, kits and skin, and faces that are a little simplified: clean shapes, no pores, no stubble or eyelash detail. They should look like real people from 40 m and like well-made figures at 3 m, never uncanny.
- **2D people (portraits):** every face is printed like a matchday programme: a halftone photo in two of the club's colours on warm paper.
- **The world:** a fictional league of old coastal and industrial towns: harbours, foundries, cliffs, moors, brick and floodlight steel. Lean on that in every image.

## 2. Rules

**Never**
- Glossy plastic skin, wax faces, perfect fashion-model faces, studio "beauty" lighting.
- Purple or teal-orange "AI" grading, lens flares, chromatic aberration, heavy bloom, haze so thick the far stand disappears.
- Real brands, real club badges, real stadiums, real players' faces, readable text inside generated images (signs, shirts, banners). All text in the game is drawn by the game.
- Logos, sponsor marks or numbers baked into kit textures. The game draws patterns and numbers (SPEC §14.2).
- Mixing styles: one asset in a different style (cartoony, painterly, low-poly) breaks the whole set.

**Always**
- Light comes from somewhere you can name: the floodlight banks at night, the sun in the afternoon.
- Kits are the brightest, most saturated colours on the pitch. The grass is deep, not neon. The UI's accent is the user's club colour (SPEC §19.2), so the game's palette comes from the clubs, not from a UI colour.
- Ordinary faces: varied ages (17–36 for players), builds, noses, ears and hairlines; older players look weathered.
- Every asset is checked at the distance it is seen from (broadcast camera, free camera close-up, portrait at 48 px and 256 px) before it ships.

## 3. Match day (values for SPEC §14.10, `balance.ts → render.*`)

### 3.1 Time slots

| | Night | Evening | Afternoon |
|---|---|---|---|
| Sky top | `#03060D` | `#0D1A33` | `#5E8DC2` |
| Sky horizon | `#0D1830` | `#4A3C33` (muted amber band, low) | `#C7D6E4` |
| Stars | faint, 600 points | none | none |
| Hemisphere light sky / ground / intensity | `#1C2C4D` / `#0B1A10` / 0.25 | `#33466E` / `#14200F` / 0.45 | `#9DB7D9` / `#3A4A2A` / 0.8 |
| Key light | 4 floodlights `#FFF0DA` | 4 floodlights `#FFF0DA` at 85% | sun `#FFF4E0`, elevation 38° |
| Beams | yes | 60% of night opacity | none |
| Env map intensity (dry) | 0.5 | 0.6 | 0.8 |

The night sky matches the UI's `--bg` family on purpose: menus and match feel like one game.

### 3.2 Haze (`FogExp2`)
Colour = the slot's sky horizon colour. Density: night 0.0030, evening 0.0028, afternoon 0.0018. Rain adds 0.0008.

### 3.3 Floodlights
Colour `#FFF0DA` (about 4,300 K, slightly warm). Lamp banks are emissive at 6.0 (they bloom); the light they throw is 4 spot lights aimed at points 20 m inside each corner of the pitch. Only the light nearest the broadcast camera casts shadows. Shadows: soft (`PCFSoftShadowMap`), slightly blue in tone thanks to the hemisphere light.

### 3.4 Grade (`GradePass`)
| | Night / Evening | Afternoon |
|---|---|---|
| Lift (RGB, added to shadows) | 0.000, 0.004, 0.014 (cool shadows) | 0, 0, 0.006 |
| Gamma | 1.0 | 1.0 |
| Gain (RGB) | 1.02, 1.00, 0.97 (warm highlights) | 1.01, 1.00, 0.99 |
| Saturation | 1.06 | 1.03 |
| Contrast | 1.08 | 1.05 |
| Vignette strength / softness | 0.22 / 0.45 | 0.15 / 0.5 |

The test: a still frame should look like a TV broadcast of a night match, not like a film poster.

### 3.5 Pitch
- Grass albedo averages `#3E6B2F` dry (a real, slightly blue-green pitch, not lime). Mowing stripes ±6% (SPEC §14.2).
- Line paint `#F2F2EC`, roughness 0.8, very slightly softer edges than the grass detail (painted, not vector-sharp).
- Wet: values in SPEC §14.10; floodlights should streak across the grass toward the camera.
- Run-off area beyond the lines: same grass, no stripes, 6% darker.

### 3.6 People on the pitch
- **Kits:** the club colours from SPEC §9.2 exactly. Cloth is matte knit (roughness 0.7) with folds from the model's detail map; never shiny polyester.
- **Shirt numbers and names:** Barlow Condensed 700, drawn by the game, in the club's text colour.
- **Skin tones (6 presets, SPEC §14.2):** `#F1D3BC`, `#E0B18F`, `#C68B63`, `#A0694A`, `#7A4B33`, `#4E3022`.
- **Hair colours:** `#1A1410`, `#3B2A1E`, `#6A4A30`, `#A07A4C`, `#C9A46A`, `#7A3B1E`. Chosen per player from nationality and seed.
- **Referees:** all black `#16181C` (shirt, shorts, socks), assistants the same. The bright greens and oranges belong to the goalkeepers (SPEC §9.2).
- **Fallbacks (capsule players):** use these same skin, hair and kit values and the same materials, so a match without models still looks lit and graded.

## 4. Models (Meshy)

**How each one is made:** a fal concept image in this style → Meshy image-to-3D → reduced to the triangle budget → rigged and animated in Meshy where needed → `tools/` script fixes scale, origin, names, materials and compression, and bakes ambient occlusion into static props. Budgets and names are binding (SPEC §18.2–18.3).

### 4.1 Player (`models/player.glb`), target 10k triangles
- **Body:** adult male footballer, 1.80 m, athletic but not bodybuilder, realistic proportions. A-pose for rigging.
- **Face:** realistic structure, simplified surface: clear brow, nose, jaw and ears as clean forms; no skin pores, no stubble, no eyelashes. Neutral expression.
- **Hair:** short, close to the head (one mesh, `Hair` material, tinted per player).
- **Kit:** plain crew-neck short-sleeve shirt, shorts, knee socks, boots. No logos or text.
- **Material split trick:** the concept is made with each part in a flat ID colour (shirt red, shorts blue, socks yellow, boots green, skin natural, hair dark). The tool splits the mesh into the materials `Shirt`, `Shorts`, `Socks`, `Skin`, `Hair` and `Boots` by those colours, then replaces the colour with neutral white and keeps the folds as a greyscale detail texture, so the game can tint each part. This gets tested on the first model before anything else.
- **Animations:** all clips in SPEC §18.3 that Meshy's library covers; the rest use the spec's fallbacks. Clips are checked for foot sliding at Jog and Run speed.

### 4.2 Manager (`models/manager.glb`), target 9k triangles
Middle-aged man, 1.78 m, knee-length charcoal wool overcoat (`#2A2C31`) worn open over a white shirt and plain tie, dark trousers, black shoes. The `Tie` is tinted in the club's primary colour. Same face rules as the player. Clips and materials: SPEC §18.3.

### 4.3 Props
| Model | Look | Budget |
|---|---|---|
| `ball.glb` | Modern bonded match ball: white with an original swirl panel graphic in navy `#0B1F3A` and pitch green `#2E8B57`, no brand, no text. 0.22 m diameter. | 1.5k |
| `goal.glb` | White aluminium posts, elliptical 12 cm section, rear stanchions in white steel. The net is a separate mesh named `Net`, a 40×16 vertex grid with an alpha-cut knotted net texture, so the engine can ripple it. | 3k |
| `corner_flag.glb` | Flexible white post 1.5 m with a red band at the base, square flag (material `Flag`, tinted home club primary). | 400 |
| `floodlight.glb` | 45 m steel lattice tower, grey galvanised, with a rectangular bank of 4×6 lamps tilted 25° down (material `Lamps`, emissive). The silhouette matters more than the lattice detail. | 4k |
| `dugout.glb` | Modern dugout: curved clear perspex roof on a steel frame, eight padded bucket seats (material `Seats`, tinted home club primary). | 5k |

### 4.4 Stands (`stand_side.glb`, `stand_end.glb`)
Concrete terraces with plastic seats (material `Seats`, tinted home club primary), a steel roof with a slim fascia, floodlit underside. Side stand 110 m long; end stand 72 m. Baked ambient occlusion and soft baked light under the roof (lightmap). 8k triangles each.
**Three styles by club size (decided by the user, 19 Nov; made last of all models):**
| Style | Clubs (reputation) | Look |
|---|---|---|
| Modern (`stand_side.glb`, `stand_end.glb`) | rep 5–4: c01, c02, c03 | as above: concrete, steel roof, slim fascia |
| Brick (`stand_*_brick.glb`) | rep 3: c04, c05, c06, c07 | older two-tier stand, red-brick back and ends, steel columns holding a pitched roof |
| Timber (`stand_*_timber.glb`) | rep 2: c08, c09, c10 | small single-tier stand, dark painted timber, low pitched roof on posts, open terracing at the ends |
If credits or time run out, the brick and timber versions are dropped and every ground uses the modern ones.

### 4.5 Crowd atlas (`textures/crowd_atlas.webp`)
4×4 cells of fans from the waist up, mixed ages, coats and scarves, lit from above and in front by floodlights, on transparency. Clothing in light grey so the game can tint it with club colours; faces small and soft (they are a few pixels tall on screen). Nobody holds readable signs.

## 5. Portraits and people (fal + `tools/print.ts`)

### 5.1 The photo
- Head and shoulders, facing camera, shoulders square, eyes level with the lens, framed with the top of the head 8% from the top edge.
- Plain grey seamless background. Hard on-camera flash from slightly left, like a press-day photo in a club's media room.
- Plain crew-neck training top, dark grey. No logos, badges or text.
- Neutral or a small closed-mouth smile. Never a toothy stock-photo smile.
- Built from the player's data in `world.snapshot.json`: age, nationality, and a seeded variety of build, face shape and hairstyle. The 280 faces must look like 280 different people.

### 5.2 The print (`tools/print.ts`, applied by Claude to every image)
1. Cut out the person; background becomes paper white.
2. Greyscale, contrast curve to a strong press-photo look (solid shadows, open highlights).
3. Halftone: round dots, 45° screen, a dot cell of 3 px at 256 px (6 px at 512 px), slight dot gain.
4. Paper grain at 4% and a very slight unevenness in ink density, so it reads as printed, not filtered.
5. Saved greyscale. The game prints it in colour at runtime (SPEC §18.5).

### 5.3 Inks
- Club people (players, chairmen, AI managers): the club's ink and paper per SPEC §18.5.
- Theo Vance (assistant): the user's club, so he always "belongs" to you.
- Journalists: Priya Natarajan, Meridian Sport, ink `#1C3F94`; Joe Kettering, The Saltmere Echo, ink `#141414`; Femi Adebayo-Clarke, Coastline Radio, ink `#8A2E1F`.

## 6. Other images (fal)

### 6.1 Crests (`images/crests/{clubId}.webp`)
They should look like real lower-league badges, designed decades ago and never modernised: flat, 2–3 colours from the club palette, a simple shield or roundel, one emblem, optional founding year. No gradients, bevels, gloss, or mascot cartoons. Emblems: c01 lantern over an anchor; c02 anvil and hammer; c03 kestrel in a dive; c04 sailing ship on a wave; c05 street lamp; c06 town gate with two towers; c07 flame; c08 moorland ridge with heather; c09 linden leaf; c10 crow on a bar. All letters are drawn by Claude's tool, not by the image model.

### 6.2 Stadium images (`images/stadium/{clubId}.webp`, 1280×720)
Each ground at night under its floodlights, photographic, using the lighting in §3. Character:
- **The Lanternworks (c01):** harbour-side ground built on an old lighthouse-lamp factory; brick and glass, harbour cranes behind.
- **Furnace Park (c02):** steel-framed stands beside a foundry, chimneys in the haze.
- **Cliffside Ground (c03):** one stand backs onto a cliff, the sea beyond the other end.
- **Brinegate Road (c04):** old brick terraced-street ground, houses right behind the stand.
- **Lamplight Stadium (c05):** the newest ground, clean and modern, lit like a showcase.
- **The Gatehouse (c06):** an old stone gatehouse forms the main entrance.
- **Ember Lane (c07):** tight, steep, red-brick, smoke-stained.
- **Heathside (c08):** open, windswept moorland ground, low stands, hills beyond.
- **Linden Meadow (c09):** small, tree-lined, a park ground.
- **Rookery Park (c10):** old trees full of crows behind one end, a dark timber stand.
No readable text anywhere in the images.

### 6.3 News photos (`images/news/{clubId}_{scenario}.webp`, 1024×576)
Back-page match photos: action or reaction shots at night, printed in single black ink on newsprint `#EDE8DC` with a coarser halftone than portraits (cell 5 px). Faces small, turned, or in motion. These do not get tinted.

### 6.4 Screen backgrounds (`images/ui/`, 1920×1080)
`title_bg`: a stadium at night from high in the stand, empty pitch, floodlights on, haze. `board_room`: an old wood-panelled club boardroom, a long table, framed old team photos (no readable faces or text). `press_room`: a small media room with a plain backdrop and a desk with microphones. All dark enough for white UI text on top, graded with §3.4, slightly soft focus. No faces in focus.

## 7. How assets get approved
1. **Test batch first:** 4 portraits (different ages and nations, printed in two club inks), 1 player concept and model, 1 crest, 1 stadium image. The user approves or redirects.
2. Then each full set. Claude checks each set against §2 before delivering, and copies preview images to the user's Downloads folder.
3. Anything that fails the check is regenerated, never shipped "for now".
