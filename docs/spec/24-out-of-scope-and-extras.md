<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 24. Out of scope (do not build) and stretch goals

Out of scope for the jam build: online multiplayer, accounts, real-time "day/week" persistent modes, loans, youth academy intake, cups, staff hiring beyond §12.17.1, stadium upgrades, editor, mobile/touch, and the SPEC-1.4 Tier C items (a free-draw set-piece designer; the job-based one is §13.20; contract clauses, social groups).

**Free walking: the TOP-PRIORITY extra (v1.7, approved by the user 23 Nov).** Start it first, as soon as M6b is accepted and M7 is on track, before every other extra below. Write the full rules as a short SPEC addition first.
- **Controls:** the player walks the coach through the club with **WASD** (Shift to walk faster), with a third-person camera behind him and the mouse to look. **E** interacts with the hotspot in front of him: it opens its screen or scene. A prompt ("E · Tactics board") shows when one is in reach.
- **The building:** one floor: the corridor, office, boardroom, dressing room, press room, the tunnel, and a door out to the training ground. Extra spaces to explore: a trophy cabinet, past-team photos, the kit room, the gym (opens Training), the canteen, and the window onto the pitch. People stand or move at set spots (chatting, stretching, eating); walk up to a player and press E to talk to him (his §12.9 conversation, if one is open).
- **Kept as they are:** the tabs and Continue still auto-walk (or cut) the coach to the right room, so a season still fits in about 30 minutes. The click-to-use hotspots still work, and the §11.25.5 talk scenes are unchanged.
- **Technical:** a capsule character controller against the M6b colliders, a camera that doesn't clip into walls (it pulls in along the view ray), the whole floor loaded with distance-based LOD and frustum culling, and the §21 budgets for the whole floor.
- **Fallback:** if it misses the budget on the reference laptop, it ships as an opt-in "Explore mode" on High only.

**Real-life extras (v1.7, approved by the user 22 Nov; only if time allows, after M6b is accepted and M7 is on track, in this order; write each as a short SPEC addition before starting):**
1. **Referees with a personality:** a named referee per match, with strictness (lenient / normal / strict: yellow chance per foul ×0.8 / ×1 / ×1.25, penalty-for-box-foul chance ±10%) and an advantage habit. Shown in the Pre-Match report ("Strict: 4.6 yellows a game"), and the assistant factors it in ("Strict ref. Easy on the tackles.").
2. **Real contract talks:** renewals and signings become a negotiation scene (§11.25.5) with the player's agent. Wage, years, a role promise and a signing bonus are proposed and countered over up to 3 rounds, with a walk-away point from the player's personality, ambition and the club's reputation. It replaces the single-line renewal in §12.9 and the Contract dialog in §11.10.
3. **Matchday atmosphere:** crowd density follows the real attendance (§12.10), with away fans in their colours in one corner. A full-time handshake with the other manager (a touchline cut), and before derbies, the rival manager's jibes in the pre-match press (`press.json` context `RIVAL_QUOTE`).

**Separate shape without the ball (v1.7, approved by the user 22 Nov as one of the last items):** start only when M5, M6, M6b and the club life extras below are done and M7 is on track. A plan can have a second formation for defending (for example, attack in 4-3-3 and defend in 4-4-2). The engine uses the defending formation's anchors and involvement when out of possession (§13.5, §14.3 out-of-possession shape), with defensive roles per its slots (§13.19.2). Familiarity is tracked for each formation pair. The switch costs a transition-shape penalty for the first 6 s after a turnover (their Counter ctx +0.05). Write the full rules as a SPEC addition before starting; a Claude design review is needed for the board's two-shape view.

**Club life extras (v1.7; only if time and credits allow, after M6b is accepted and M7 is on track, in this order):**
1. **A club that changes over the season:** the trophy cabinet fills, the weather turns wintry by December, the office gets messier during a losing run, and fans outside cheer or boo by form as the coach arrives.
2. **Signing day:** a new signing shakes the coach's hand and holds up the club scarf for the photographers in the press room.
3. **The physio room:** injured players on a treatment table, and you can visit them (§12.5).
4. **Big endings:** a trophy lift on the pitch if you win the league; packing a box after the boardroom sacking.

Stretch (only after M8 passes, in this order):
1. **Career mode**: continue to Season 2+ with ageing, retirements, contract expiries, regens (new fictional players generated with a separate seed and generic commentary lines), and the board's new expectation.
2. **League Cup**: 8-team knockout (top 8 by reputation), single matches on matchdays 5, 11, 15.
3. **Weather and pitch wear visuals** (worn goalmouths over the season).
4. **"Create your own club"** (name, colours, crest emblem; takes the place of Veldmoor Town).
5. A lean optional server for live AI press conferences (would need the jam's "keys stay on your server" rule and an offline fallback).
6. **Challenge a friend (no server):** the engine is deterministic, so a "challenge code" (your club, XI and Plan A, compressed into a short string) lets a friend play a match against your side on their own machine. Optional later: a small server for friend leagues and a results board. Online play must never be needed to play the game (the review runs offline).

---

