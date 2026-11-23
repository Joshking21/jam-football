<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 6. Coding conventions

- TypeScript strict. No `any` (use `unknown` and narrow). No non-null `!` except with a comment proving safety.
- Functions in `core/` are pure: input → output, plus explicit RNG argument. State mutation in `core/` only on objects passed in and documented as mutated (engine state only). Everything else returns new objects.
- All gameplay numbers live in `src/config/balance.ts`, grouped and commented with units. No magic numbers elsewhere (0, 1, array indexes and pure geometry excepted).
- Money: integers in whole currency units (no cents). Display with `formatMoney()`: `€12.4M`, `€850K`, `€9,500`. Currency symbol constant `CURRENCY = '€'`.
- IDs: players `p0001`…, clubs `c01`…`c10`, fixtures `f001`…, news `n…` (counter), save seed is a 32-bit unsigned int.
- File names: `camelCase.ts`, React components `PascalCase.tsx`, one component per file, CSS Modules `Component.module.css`.
- React: function components, hooks, zustand selectors to avoid re-renders. No business logic in components: call `core/` functions through store actions.
- Comments explain *why*, not what. Each `core/` module starts with a 2–5 line header comment naming the spec section it implements (e.g. `// Implements SPEC §13.6 shots`).
- Tests sit in `tests/` mirroring `src/` paths.

---

