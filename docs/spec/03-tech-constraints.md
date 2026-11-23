<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 3. Hard technical constraints

1. Build output: `dist/index.html` + hashed assets, all paths relative (`base: './'`).
2. No runtime network requests of any kind. Verify in M8 with DevTools offline mode.
3. Desktop browsers: latest Chrome, Edge and Firefox MUST work; Safari SHOULD work. WebGL2 required; if unavailable, the match falls back to the 2D top-down view (§14.9) and the rest of the game works.
4. Minimum window 1280×720; MUST stay usable down to 1024×640 (scroll allowed below 1280 wide). MUST look correct up to 2560×1440. Every layout and the 3D canvas MUST respond to `resize` within one frame.
5. Mouse + keyboard only. No hover-only information: anything shown on hover MUST also be reachable by click or focus.
6. Deterministic simulation: the same save seed + same inputs + same commands = the same events, on every browser.
7. The simulation (`src/core/**`) MUST NOT import DOM, React, three.js, audio, `Date.now()` or `Math.random()`. Use the seeded RNG (§7.3).

---

