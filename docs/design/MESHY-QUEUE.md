# Meshy queue: models to make later

On hold (user, 27 Nov): Meshy work waits until the office layout and mood are approved. Each model is one fal
reference image (`tools/fal/ref.py`, about $0.03) and one Meshy image-to-3D run (`tools/meshy/image3d.py`).
Costs are Meshy credits (docs.meshy.ai pricing, 27 Nov 2026: image-to-3D with 2K PBR textures = 30, rigging = 5).
Balance after the coach test: **1,065**.

## Done

| Model | Credits | Notes |
|---|---|---|
| Coach, base (bald, clean-shaven, navy suit, key-green tie) | 35 (model 30 + rig 5) | `public/assets/models/coach.glb` via `tools/blender/build_coach.py` |

## Office (`docs/design/office/`)

| Model | Credits | Reference brief |
|---|---|---|
| Desk | 30 | s32 style: dark oak, drawers both sides, worn edges; centred, the coach sits behind it facing the TV |
| Coach's chair | 30 | s32 style: worn dark leather swivel chair with arms |
| Guest chair (also used as the visitor chair by the door) | 30 | Classic leather-and-wood visitor chair with arms |
| Club cat | 30 (+5 rig if it walks) | Ordinary tabby, asleep curled on the folders; wakes and wanders off when the coach walks in |
| Trophies (2–3: league cup, Manager of the Month plaque, match ball on a stand) | 30 each | Fill the cabinet as they are won; small, so maybe one model with several pieces |

## Match

| Model | Credits | Reference brief |
|---|---|---|
| Player, lean build | 35 | Plain kit in flat key colours (shirt, shorts, socks each a different pure colour) so the game repaints every club's kit; simplified face; A-pose |
| Player, stocky build | 35 | Same kit and colours, heavier build |
| Fans for the crowd sprite atlas (2–3) | 30 each | Ordinary supporters in a plain top and scarf in key colours; rendered in Blender from many angles and poses into an atlas; also used full 3D in the front rows |
| Dugout | 30 | Curved clear roof, padded seats; seen up close in touchline cuts |
| Floodlight head (optional) | 30 | Lamp bank for close shots; the pylon stays Blender |

## Customiser (lean version)

| Model | Credits | Reference brief |
|---|---|---|
| Coach, tracksuit outfit | 35 | Same base person, club training tracksuit in key colours |
| Coach, woman base | 35 | Neutral base: hair tied back or short, plain suit, key-green scarf or tie |

Rough total if all are made: ~520 credits, leaving ~545.
