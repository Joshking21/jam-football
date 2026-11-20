# Decisions log

Record every gap or contradiction in the spec you had to resolve (SPEC §0.4).

Format:
```
## YYYY-MM-DD · short title
- Question:
- Choice:
- Why:
- Where: file and balance.ts key
```

## 2026-11-20 · Engine stays three.js (the user's decision)
- Question: switch to Unity (WebGL/WebGPU) or Unreal for more realism?
- Choice: stay on three.js. Unreal has no static web export (Pixel Streaming needs a server and fails the offline first-frame rule). Unity is allowed but would mean rebuilding M0–M3 and losing the HTML/CSS design system.
- Why: 4 weeks left; the jam's warn targets (under 50 MB before play, under 10 s to playable, 45 fps at 1080p) are easier to hit with three.js; realism comes mainly from light, haze and grade (ART-DIRECTION §3) plus baked lighting in the asset tools. Optional later: three.js WebGPURenderer with a WebGL fallback.
- Where: SPEC §4 (stack) unchanged.
