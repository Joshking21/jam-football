<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 4. Tech stack (exact)

Node 24 is installed on the dev machine. Use **npm**. Pin exact versions (no `^`/`~`). If a listed exact version fails to install, use the nearest existing patch version and record it in `DECISIONS.md`.

| Package | Version | Use |
|---|---|---|
| vite | 6.0.7 | build/dev server |
| @vitejs/plugin-react | 4.3.4 | React plugin |
| typescript | 5.7.2 | strict TS |
| react, react-dom | 18.3.1 | UI |
| @types/react | 18.3.12 | types |
| @types/react-dom | 18.3.1 | types |
| three | 0.171.0 | 3D match view |
| @types/three | 0.171.0 | types |
| zustand | 5.0.2 | app state |
| idb-keyval | 6.2.1 | IndexedDB saves |
| lucide-react | 0.468.0 | icons (tree-shaken named imports only) |
| @fontsource/barlow-condensed | 5.1.0 | headings font (weights 500, 600, 700) |
| @fontsource/inter | 5.1.0 | body font (weights 400, 500, 600) |
| vitest | 2.1.8 | tests (dev) |
| prettier | 3.4.2 | formatting (dev) |
| tsx | 4.19.2 | run TS scripts (dev) |

**Not allowed:** React Three Fiber, drei, any physics engine, any UI kit (MUI, Chakra, Tailwind, etc.), chart libraries, lodash, moment/dayjs, any CDN.

**npm scripts (exact names):**
```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "gen:world": "tsx scripts/gen-world.ts",
  "calibrate": "tsx scripts/calibrate.ts",
  "check": "npm run format:check && npm run typecheck && npm run test && npm run build"
}
```

`vite.config.ts` MUST set `base: './'`, `build.target: 'es2022'`, `build.assetsInlineLimit: 0`, `worker.format: 'es'`, and split three.js into its own chunk (`manualChunks: { three: ['three'] }`).

`tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: false`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, path alias `@/*` → `src/*`.

---

