# Title reference (approved by the user, 23 Nov)

`title.png` is the target; `index.html` is its static, drawn source. In the game, the background is the **3D club exterior** from M6b (§11.25.1 "Exterior"), not a drawing. Until M6b, use the fal backdrop `images/club/exterior.webp` with a slow parallax; the fallback is the M4 stadium scene at night, slowly orbiting. Where this file and §11.2 differ, this file wins on layout and look.

## The scene
- **Matchday night** when the next fixture is that day or the next: floodlights on, windows lit, fans walking to the turnstiles, gulls, the coastal town behind. **Daytime** otherwise: an overcast afternoon, floodlights off, a few staff cars.
- It's the user's club: the gable crest and the turnstile sign band are drawn by the game in the club colours. No readable text inside images.
- **New player (no save):** the home club of the default first offer (Port Calloway).

## The menu (left)
- A dark gradient from the left edge keeps the menu readable over any scene.
- **Wordmark:** `GAME_TITLE` in Barlow Condensed 800, about 168 px at 1920 (scales with the viewport), with a 220×6 px accent rule and the tagline "A season in the dugout" (letter-spaced, 18 px).
- **Continue:** only when an autosave exists. A dark glass panel with an accent left edge: the save's crest, "Continue", club · matchday · position and points, and "Saved N ago". `Space`.
- **The list:** numbered rows (01 New game, 02 Load, 03 Settings, 04 Credits) with key hints. The hover/focus state is an accent diamond, the row nudged 8 px, and bright text.
- **Foot:** "Desktop · mouse and keyboard" (small). There is no "jam edition" line on the title; the credits carry that.
- **"Tonight" chip** (bottom right): the save's next fixture, stadium, time, and "floodlights on" when it's a night match. Hidden with no save.

## Motion
- **Camera:** a slow drift (about 0.5°/s yaw, ±1 m height). The floodlight banks switch on one bank at a time over 2 s on first load. Fans walk on loops, and gulls cross every 8–14 s.
- **Menu:** wipes in from the left after 400 ms.
- **Continue or New game:** the camera flies through the front doors (1.2 s) into the corridor (§11.25.2), with no loading screen in between.
- **Reduce motion:** a still frame, and a cut instead of the fly-in.
- **Audio:** `ambience/exterior.mp3` under `music/title_theme.mp3`.

All names, numbers and colours in the image are **sample data**. Always use the game's real data (club colours from `clubs.data.ts`, targets from the board, and so on).
