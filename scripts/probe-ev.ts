import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
const gs: any = (createNewGame as any)({ seed: 12345, userClubId: 'c01' });
const fx = gs.fixtures[0];
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
const f = (p: any) => (p ? `(${p.x.toFixed(0)},${p.y.toFixed(0)})` : '-');
let shown = 0;
ev.forEach((e: any, i: number) => {
  if (e.type === 'SHOT' && shown < 6) {
    shown++;
    for (const x of ev.slice(i - 1, i + 4))
      console.log(
        x.t.toFixed(1),
        x.type.padEnd(12),
        x.side,
        'd=' + x.duration,
        f(x.from),
        f(x.to),
        x.playerId ? x.playerId.slice(-4) : '',
      );
    console.log('--');
  }
});
