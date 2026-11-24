import { createNewGame } from '../src/core/game/newGame';
const gs = createNewGame({ seed: 1, userClubId: 'c01' });
const ps = Object.values(gs.players);
const withT = ps.filter((p) => (p.traits ?? []).length > 0);
const counts: Record<string, number> = {};
let three = 0;
ps.forEach((p) => {
  (p.traits ?? []).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  if ((p.traits ?? []).length === 3) three++;
});
console.log(
  `players ${ps.length}, with >=1 trait ${withT.length} (${((100 * withT.length) / ps.length).toFixed(0)}%), with 3: ${three}`,
);
console.log(JSON.stringify(counts));
