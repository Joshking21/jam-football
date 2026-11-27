# The manager's office (design reference)

Agreed with the user on 27 Nov 2026. Target picture: `final.jpg`. The real room is built from
`tools/blender/office_blockout.py` (layout) plus Meshy hero pieces (`docs/design/MESHY-QUEUE.md`).

## Layout (the user's call)
- The **desk is in the middle**. Seated, the coach **faces the TV**; the **window is on his left**, the **door on his right**. The room is big (about 8 × 6.5 m).
- A **touchscreen tactics table** stands between the desk and the TV. Tactics are discussed and picked on it (the camera looks down on it; the coach and Theo stand around it).
- A **guest chair** across the desk (one-to-ones) and a **visitor chair** by the door.
- Plenty of **folders scattered** on the desk.

## What to take from each picture
| Picture | Take |
|---|---|
| `ref-s51-furniture.jpg` | The furniture: worn dark oak pedestal desk with brass handles, buttoned oxblood leather wingback chair, green banker's lamp, brick wall |
| `ref-s54-shirts-trophies.jpg` | Trophies standing casually (on top of units, on the floor), not in a showy case; old shirts hung in a cubby display unit |
| `ref-s52-window.jpg` | The window: big, on the coach's left, looking out at the stadium and the floodlit pitch |
| `final.jpg` | The combination (fal image-to-image from s52). Known gaps: the cubby unit shows boxes, not shirts; the shirt has a brand-like mark (ours use club kits only); too bright (light follows the time of day) |

Not chosen: the fully modern office (`tests-ai/C3-office-modern`), judged "too modern".

## Living-room pieces (change with the season; the user approved 1, 2, 3, 6, 7 first, all included)
1. Desk stress: folder piles grow with unread inbox; coffee cups pile up in a losing run; the chairman's sealed letter when board confidence is low.
2. The local paper on the desk, folded to this week's real back-page headline.
3. A trophy area that starts nearly empty and fills with what is won (cups, Manager of the Month, hat-trick ball, a signed shirt).
4. A results cork board by the door with W/D/L stickers.
5. The phone lights up for calls (chairman, agent, journalist).
6. The window follows the time of day (§11.25.6): Monday mowing, Friday floodlight test, rain, matchday crowd.
7. The club cat asleep on the folders (or the warm tactics table); wanders off when the coach walks in.
8. The coach's own framed playing shirt and an old photo (ties into the customiser).
9. A radio on the shelf with a fans' phone-in (ElevenLabs later).
10. A leak bucket in the window corner while money is tight; gone after the board funds a renovation.

## Mood
Changes with the time of day (§11.25.6) rather than one fixed mood: cool daylight on Monday morning, warm lamp
and floodlights on Friday evening.

## Who makes what
| Item | Made by |
|---|---|
| Desk, coach's wingback chair, guest/visitor chair, cat, trophies | fal reference → Meshy (queued, on hold) |
| Tactics table, TV, cubby unit with shirts, shelves, folders, mugs, paper, letter, phone, lamp, clock, cork board, coat stand, radio, bucket, room shell | Blender (free); screens are live surfaces in the game |
| The view through the window | fal image |

## Blender build (27 Nov)
`tools/blender/office_textures.py` (brick, oak boards, plaster, dark oak, leather, rug, cork, newspaper, clock face,
team photo, screen fallbacks, window placeholder) then `tools/blender/build_office.py` ->
`public/assets/models/office/office.glb` (2.2 MB, ~25.6k triangles, 160 meshes). Previews: `blender-*.jpg`.

Naming contract for the game: `screen_table`, `screen_tv`, `screen_paper`, `screen_clock`, `window_view` (0..1 UVs, the
game draws on them); `live_*` (folders, mugs, reports, letter + seal, phone + light, trophies, match ball, radio,
results cards + W/D/L stickers, bucket + leak stain, clock hands); `meshy_desk`, `meshy_chair_coach`,
`meshy_chair_guest`, `meshy_chair_visitor`, `meshy_cat` (stand-ins, swapped for Meshy models); `door` (origin on the
hinge); `light_*` (downlights, sconces; the game places real lights there); `static_*` (everything else, one mesh per
material). Materials `ClubPrimary` / `ClubSecondary` are tinted by the game (framed shirt, cubby shirts, scarf).

Still to do: the window view image (fal), the coach's framed shirt and photo per the customiser, lighting per time of
day in the game (§11.25.6), and wiring into `src/club3d` once Gemini has committed its rooms work. The 101 `live_*`
meshes can be batched once their logic exists.
