import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
const gs: any = (createNewGame as any)({ seed: 12345, userClubId: 'c01' });
const ds: number[] = [];
const pre: Record<string, number> = {};
for (const fx of gs.fixtures.slice(0, 20)) {
  const home = gs.clubs[fx.homeId],
    away = gs.clubs[fx.awayId];
  const sim = createMatch(
    {
      fixtureId: fx.id,
      home: buildTeamSheet(home, gs.players, 'home'),
      away: buildTeamSheet(away, gs.players, 'away'),
      isDerby: false,
      weather: fx.weather,
      userSide: 'home',
      aiControls: ['home', 'away'],
    } as any,
    99,
  );
  const ev = sim.runToEnd();
  ev.forEach((e: any, i: number) => {
    if (e.type === 'SHOT' && e.from && e.to) {
      const d = Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y);
      ds.push(d);
      if (d > 30) {
        const p = ev[i - 1];
        pre[p.type] = (pre[p.type] ?? 0) + 1;
      }
    }
  });
}
ds.sort((a, b) => a - b);
const q = (p: number) => ds[Math.floor(p * (ds.length - 1))].toFixed(1);
console.log(
  'shots',
  ds.length,
  'p10',
  q(0.1),
  'median',
  q(0.5),
  'p90',
  q(0.9),
  'over 30m:',
  ds.filter((d) => d > 30).length,
  'preceded by',
  JSON.stringify(pre),
);
