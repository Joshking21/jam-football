<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 18. Asset contract

Claude produces assets in parallel with your work and drops them into `public/assets/`, then regenerates `public/asset-manifest.json`. You MUST build against this contract and the fallbacks so the game is always complete without any asset.

### 18.1 Registry (`src/assets/registry.ts`)
- On boot, fetch `./asset-manifest.json` (local file, part of the build): `{ "version": 1, "files": { "models/player.glb": { "bytes": 1234567 }, ... } }`.
- `assetUrl(path): string | null` returns `./assets/<path>` if listed, else `null`. Every consumer handles `null` with its fallback. Never request an unlisted file (no 404s in the console).
- M0 creates `public/asset-manifest.json` as `{ "version": 1, "files": {} }`.

### 18.2 Paths and formats
| Path | Format | Notes |
|---|---|---|
| `models/player.glb` | glTF binary, meshopt-compressed | contract §18.3 |
| `models/goal.glb`, `models/ball.glb`, `models/stand_side.glb`, `models/stand_end.glb`, `models/floodlight.glb`, `models/dugout.glb`, `models/manager.glb`, `models/corner_flag.glb` | GLB | origin at ground centre, metres, +Z forward |
| `models/stand_side_brick.glb`, `models/stand_end_brick.glb`, `models/stand_side_timber.glb`, `models/stand_end_timber.glb` | GLB, optional | stand style by home club reputation: 5–4 modern (`stand_side/end.glb`), 3 brick, 2 timber. If a style's file is not in the manifest, use the modern one; if that is missing too, the boxes fallback (§14.2) |
| `textures/grass_albedo.webp` (1024²), `textures/grass_normal.webp` (1024², OpenGL convention, linear), `textures/crowd_atlas.webp` (2048², 4×4 cells), `textures/ad_boards.webp` (2048×128) | WebP | |
| `images/portraits/{playerId}.webp` | 256×256 WebP, greyscale halftone | 280 files; tinted per club at runtime (§18.5) |
| `images/crests/{clubId}.webp` | 512×512 WebP, transparent | 10 files |
| `images/people/{assistant,chairman_{clubId},journalist_{1..3},manager_{clubId}}.webp` | 512×512 WebP, greyscale halftone | tinted at runtime (§18.5): assistant in the user's club, chairman/manager in their club, journalists in their outlet's ink (ART-DIRECTION §5) |
| `images/news/{clubId}_{scenario}.webp` | 1024×576 WebP | 40 files |
| `images/stadium/{clubId}.webp` | 1280×720 WebP | 10 files |
| `images/ui/title_bg.webp`, `images/ui/board_room.webp`, `images/ui/press_room.webp` | 1920×1080 WebP | |
| `images/ui/logo.webp` | transparent WebP | game logo when the name is final |
| `audio/music/*.mp3`, `audio/crowd/*.mp3`, `audio/sfx/*.mp3` | MP3 128–192 kbps | names in §17 |
| `audio/vo/commentary/{lineId}.mp3`, `audio/vo/names/{playerId}.mp3`, `audio/vo/clubs/{clubId}.mp3`, `audio/vo/assistant/{lineId}.mp3`, `audio/vo/press/{questionId}.mp3` | MP3 64–96 kbps mono | generated from your content files; ids MUST match |
| `audio/vo/coach/{lineId}.mp3`, `audio/vo/coach_names/{playerId}.mp3`, `audio/vo/owner/{lineId}.mp3`, `audio/vo/players/{lineId}.mp3` (v1.7) | MP3 64–96 kbps mono | §17.4; every one optional |
| `audio/ambience/{room}.mp3` (v1.7) | MP3 128 kbps, seamless loop, 30–60 s | §17.5 |
| `models/person.glb` (v1.7) | GLB | contract §18.6 |
| `models/club/{prop}.glb` (v1.7) | GLB, origin at floor centre, metres, +Z forward | desk, desk_chair, lamp, phone, tv, whiteboard, locker, bench, board_table, board_chair, frame, mic_table, press_chair, tripod, cone, mannequin, dugout_bench. Baked `aoMap` allowed (§14.10). Missing → coloured boxes |
| `textures/faces/{coach,player,person,assistant,owner}.webp` (v1.7) | 1024² WebP, transparent | face atlases, §18.6 |
| `images/club/{exterior,window_office,window_boardroom,training_bg,press_backdrop}.webp` (v1.7) | 1920×1080 WebP | backdrops seen through windows or behind sets; no readable text (ART-DIRECTION §2) |

### 18.3 Player model contract (`models/player.glb`)
- Humanoid, 1.80 m tall, origin at the feet, facing +Z, ≤ 12,000 triangles, one skinned mesh (or a few sharing one skeleton), ≤ 60 bones.
- Materials named exactly: `Shirt`, `Shorts`, `Socks`, `Skin`, `Hair`, `Boots`. Base colours white/neutral so tinting works (shirt texture slot used for patterns/numbers).
- Animation clips named exactly: `Idle`, `Jog`, `Run`, `Sprint`, `Pass`, `Shoot`, `Header`, `Tackle`, `Throw`, `Celebrate`, `Dejected`, `GK_Idle`, `GK_DiveLeft`, `GK_DiveRight`, `GK_Catch`. Missing clips fall back in this order: Sprint→Run→Jog→Idle; Shoot→Pass; Header→Idle; Tackle→Run; Throw→Idle; Celebrate→Idle; GK_*→Idle.
- In-place locomotion (no root motion).
- `models/manager.glb` follows the same rules (origin at the feet, +Z, ≤ 12,000 triangles, in place), 1.78 m tall, materials `Coat`, `Shirt`, `Tie`, `Trousers`, `Shoes`, `Skin`, `Hair` (`Tie` is tinted the club's primary colour, `Coat` stays as delivered), clips `Idle`, `Point`, `Clap`, `Celebrate`, `Dejected` (missing clips → `Idle`).
- **v1.7: one shared skeleton.** `player.glb`, `manager.glb` and `person.glb` use the same bone names and rest pose, so any clip plays on any of them.
  - **Clips added to all three:** `Walk`, `DoorOpen`, `Sit`, `SitIdle`, `SitNod`, `SitHeadDown`, `SitClap`, `Listen`, `Nod`, `TalkGesture`, `ArmsFolded`, `FistPump`, `HeadInHands`, `Shout`, `Write`, `RaiseHand`, plus `Point`, `Clap`, `Celebrate` and `Dejected` on everyone.
  - **Fallbacks:** `Sit*` → `SitIdle` → `Idle`; `Walk` → `Jog` → `Idle`; `FistPump` → `Celebrate` → `Idle`; `HeadInHands` → `Dejected` → `Idle`; everything else → `Idle`.
  - A bone named `Head` is required.
  - Speaking characters carry a `Face` mesh (§18.6).

### 18.4 What you build vs what Claude builds
| You (Gemini) | Claude |
|---|---|
| All code, content JSON text, procedural fallbacks (crest, avatar, kit, flags, pitch, stadium boxes, capsule players, box rooms), registry, audio engine | Meshy models, fal images, ElevenLabs voices/SFX/music, `tools/` scripts, `asset-manifest.json` updates, art direction and UI design references |

### 18.5 Portrait tint (programme print)
Portraits and people images arrive as greyscale halftone prints (black dots on white). The `Portrait` component prints them in two club colours at runtime, so a player who transfers is printed in his new club's colours and the assistant always wears yours:
- Ink colour = the darker of the club's primary and secondary colours (relative luminance). Paper colour = `#F1ECE2` (warm off-white) mixed 12% toward the lighter club colour. If ink-on-paper contrast is below 4.5:1, ink = `#141414`.
- Implement as one inline SVG filter per club (`feColorMatrix` to luminance, then `feComponentTransfer` with `table` values mapping 0 → ink and 1 → paper per channel), referenced by `filter: url(#print-<clubId>)`. No canvas work per frame; filters are defined once in a hidden `<svg>` at app start.
- Free agents and players with no club use ink `#141414`.
- The procedural avatar fallback uses the same ink and paper colours, so missing images look like part of the same set.

### 18.6 People and face atlases (v1.7)
- **`models/person.glb`:** the shared rig and clips (§18.3), 1.78 m tall, ≤ 12,000 triangles, materials `Jacket`, `Shirt`, `Trousers`, `Shoes`, `Skin`, `Hair`. Tint per person for variety: reporters vary jacket, shirt and hair from seeds; Theo has a tracksuit tint in the user's club colours; the owner and directors wear dark suits. Skin tones come from the 6 presets.
- **`Face` mesh:** a thin patch over the face (≤ 200 triangles), skinned only to `Head`, with its own 0–1 UVs and material `Face`. Claude fits it in `tools/`. Without a `Face` mesh, the character has no face animation; the body still works.
- **Face atlas layout** (1024², 4×4 cells of 256², transparent background, dark features):

| Row | Cells (left → right) |
|---|---|
| 0 | eyes open, eyes half, eyes closed, (spare) |
| 1 | brows neutral, brows raised, brows angry, brows worried |
| 2 | mouth closed, mouth small, mouth open, mouth wide |
| 3 | mouth smile, mouth frown, mouth "O", (spare) |

- **Moods** (`balance.ts → faces.moods`): neutral = brows neutral + mouth closed; happy = brows raised + smile; angry = brows angry + frown; worried = brows worried + mouth small; shocked = brows raised + "O". While speaking, the mouth row-2 cells override the mood's mouth.
- Atlases: `coach`, `player` (shared by all players), `person` (reporters and directors), `assistant` (Theo), `owner`.

Procedural fallbacks MUST look intentional: crest = shield SVG with the club's colours, a simple emblem from a set of 8 shapes (anchor, hammer, bird, wave, gate, flame, tree, crow) chosen per club, and the club code; avatar = head-and-shoulders silhouette in kit colours with initials.

---

