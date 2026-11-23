# New Game reference (approved by the user, 23 Nov)

`new-game.png` is the target for §11.3 step 1 ("Choose your club"); `index.html` is its static source. Choosing a club is **reading job dossiers**, not scrolling a carousel. Steps 2 (your name, tutorial on/off) and 3 use the same folder with the next tab. Where this file and §11.3 differ, this file wins on layout and look.

- **Header:** a `NEW GAME` chip · league · "10 clubs" · season. The headline "Ten clubs. One job." A one-line instruction. Step chips on the top right.
- **Left: the league map,** a printed paper map (tilted −0.8°) of the fictional Meridian League: sea with wave lines, the coastline, a hatched moor, a river, a dashed railway, a compass, and the map title in Playfair. The legend shows difficulty colours.
  - **Each club:** its crest pin and a label card with the name, reputation stars, and difficulty (EASY rep 5, NORMAL 4, HARD 3, VERY HARD 2, from §11.3), coloured by difficulty.
  - **The selected club:** a dashed red marker ring and a red card outline.
  - Town positions are fixed in `clubs.data.ts` as `mapPos` (coastal clubs on the coast, foundry towns inland, Veldmoor on the moor).
- **Right: the dossier,** a manila folder with three paper tabs: **The job**, **The squad**, **The town**. A red **VACANCY** stamp.
  - **Header:** a big crest, the club name, nickname · founded · town, and colour swatches.
  - **The job:** reputation stars, difficulty, board expectation, transfer budget, wage budget, stadium and capacity, and how they play (club style). A yellow memo has a line from the chairman's letter (`club.json`, one per club).
  - **Best XI:** a whiteboard mini-pitch (the Tactics look) with OVR magnets and surnames, and the average.
  - **Rivals:** the derby name, in red.
  - **The town:** a printed halftone photo of the stadium or town and one quote from the local paper.
- **"Take the job":** in the club's primary colour with its secondary text (`Enter`). The camera then flies into that club's exterior (Title, M6b).
- **Keyboard:** ←/→ cycle clubs (the map ring moves and the dossier slides), `Enter` takes the job, `Esc` goes back. Mouse: click a pin or card.
- **Motion:** the dossier pages slide out and in (180 ms) on change, and the stamp thumps on with `ui_stamp`.

All names, numbers and colours in the image are **sample data**. Always use the game's real data.
