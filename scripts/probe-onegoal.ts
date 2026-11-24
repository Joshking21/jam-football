import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
const gs: any = createNewGame({ seed: 12345, userClubId: 'c01' });
for (const fx of gs.fixtures.slice(0, 6)) {
  const home = gs.clubs[fx.homeId],
    away = gs.clubs[fx.awayId];
  const ev = createMatch(
    {
      fixtureId: fx.id,
      home: buildTeamSheet(home, gs.players, 'home'),
      away: buildTeamSheet(away, gs.players, 'away'),
      isDerby: false,
      weather: fx.weather,
      userSide: 'home',
      aiControls: ['home', 'away'],
    } as any,
    777,
  ).runToEnd();
  const g = ev.find((e: any) => e.type === 'GOAL' && e.t === 1330);
  if (!g) continue;
  const f = (p: any) => (p ? `(${p.x.toFixed(0)},${p.y.toFixed(0)})` : '-');
  for (const e of ev.filter((e: any) => e.t > 1310 && e.t < 1345))
    console.log(
      e.t,
      e.type,
      e.side,
      'd=' + e.duration,
      f(e.from),
      f(e.to),
      e.shot ? JSON.stringify(e.shot.target) : '',
    );
}
