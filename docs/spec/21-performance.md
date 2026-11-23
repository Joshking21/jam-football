<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 21. Performance budgets and quality presets

### 21.1 Budgets (MUST)
| Item | Budget |
|---|---|
| First paint (HTML splash) | < 300 ms |
| Title interactive | < 2.0 s from a cold local load (dist served by `vite preview`) on a mid laptop |
| Main JS chunk (gzip) | ≤ 350 KB (three.js chunk separate, lazy) |
| Initial asset download before the title is interactive | ≤ 5 MB |
| Match scene ready after Kick Off | < 2.5 s (models cached after the first match: < 1 s) |
| Frame rate in match, Medium, 1920×1080, Intel Iris Xe class | ≥ 55 fps average, never < 30 for > 1 s |
| Instant sim of one match | < 30 ms; full round of 4 other matches < 150 ms in the worker |
| Memory after 5 matches | no growth > 50 MB versus after the first |
| Club rooms (v1.7), Medium, 1920×1080, same laptop | ≥ 55 fps during walks; 30 fps cap while a screen is open and nothing big moves |
| Each room (v1.7) | ≤ 120k triangles, ≤ 120 draw calls, ≤ 40 MB GPU textures, ≤ 12 animated people |
| Club spaces download (v1.7) | ≤ 12 MB, loaded lazily after the Title is interactive; never delays first paint or the Title |
| Next room ready (v1.7) | before the walk ends (≤ 2.5 s); first-ever visit ≤ 1.0 s extra with a fade |
| Physics (v1.8, §14.12.8) | match step ≤ 2.0 ms, grass ≤ 2.5 ms GPU, club rooms ≤ 1.0 ms; physics chunk ≤ 1.8 MB gzip (Rapier 0.21.0 measured at 1.66 MB), lazy: prefetched in the background once the Title is interactive, so it never delays first paint or the Title and the match load budget still holds |
| Total build size | < 150 MB |

### 21.2 Presets
| Setting | Low | Medium | High |
|---|---|---|---|
| Pixel ratio | 1.0 | min(1.5, devicePixelRatio) | min(2, devicePixelRatio) |
| Antialias | off | on | on |
| Shadows | off | 1024 map, 1 light | 2048 map, 1 light |
| Crowd instances | 2,000 | 6,000 | 12,000 |
| Rain particles | 0 | 3,000 | 8,000 |
| Line texture | 2048×1280 | 4096×2560 | 4096×2560 |
| Net ripple, ball shadow | blob only | yes | yes |
| Post-processing composer (§14.10) | off | on, MSAA 4 | on, MSAA 4 |
| Bloom | off | half resolution | half resolution |
| Ambient occlusion (GTAO) | off | off | half resolution |
| Floodlight beams and glare | glare sprites only | yes | yes |
| Colour grade and vignette | off | yes | yes |
| Environment map, haze, grass normal map | yes | yes | yes |
| Club rooms: people (v1.7) | still frame after the camera settles; walks become cuts | animated, ≤ 12 | animated, ≤ 12 |
| Club rooms: shadows (v1.7) | off | 1024 map, 1 light | 2048 map, 1 light |
| Touchline cuts (v1.7) | coach only | coach, Theo, bench | coach, Theo, bench |
| Ball physics, player bodies, foot IK (v1.8) | yes | yes | yes |
| Ragdolls at once (v1.8) | 0 (fall clips) | 2 | 3 |
| Grass blades (v1.8) | off (stripe multiplier) | ≤ 250k, within 30 m of the camera | ≤ 600k, within 45 m |
| Trample map (v1.8) | 256×160, sheen only | 512×320 | 1024×640 |
| Wear map (v1.8) | 512×320 | 1024×640 | 1024×640 |
| Turf and spray particles (v1.8) | off | 6 per slide | 12 per slide |
| Coach hand IK and door bodies (v1.8) | yes | yes | yes |
| Spring bones (coat, tie) (v1.8) | off | yes | yes |
**Auto**: start Medium; measure the average frame time over the first 3 s of each match; if > 22 ms drop one level (toast "Graphics set to Low for smoother play"); if < 10 ms on Medium for 10 s, offer High (toast with a button), never switch up automatically.

---

