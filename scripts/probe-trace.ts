import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer } from '../src/render3d/choreographer';
const gs: any = (createNewGame as any)({ seed: 12345, userClubId: 'c01' });
const lineup = (c: any) =>
  c.tactics.lineup.filter(Boolean).length === 11 ? c.tactics.lineup : c.squad.slice(0, 11);
const tac = (c: any) => ({
  formation: c.tactics.formation,
  ...c.tactics.instructions,
  lineup: lineup(c),
});
const paces: any = {};
for (const p of Object.values(gs.players) as any[]) paces[p.id] = p.attributes.pace;
const fx = gs.fixtures[0];
const home = gs.clubs[fx.homeId],
  away = gs.clubs[fx.awayId];
const events = createMatch(
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
const ch = new Choreographer(tac(home), tac(away), paces);
ch.setEvents(events);
const T0 = Number(process.argv[2] ?? 300),
  T1 = Number(process.argv[3] ?? 340);
const f = (v: any) => `(${v.x.toFixed(0)},${v.z.toFixed(0)},${v.y.toFixed(1)})`;
let lastPlan = -1;
for (let t = T0 - 5; t < T1; t += 1 / 60) {
  ch.update(1 / 60, t, null, 1);
  const p: any = (ch as any).activePlan;
  if (p && p.seq !== lastPlan) {
    lastPlan = p.seq;
    const e = events.find((e: any) => e.seq === p.seq)!;
    console.log(
      `== ${e.t} ${e.type} ${e.side} d=${e.duration} kick=${p.kickT.toFixed(1)} fe=${p.flightEnd.toFixed(1)} from=${e.from ? `(${(e.from.x - 52.5).toFixed(0)},${(e.from.y - 34).toFixed(0)})` : '-'} to=${e.to ? `(${(e.to.x - 52.5).toFixed(0)},${(e.to.y - 34).toFixed(0)})` : '-'} actor=${e.playerId?.slice(-4)} recv=${p.receiver?.slice(-4)}`,
    );
  }
  if (t >= T0 && Math.round(t * 60) % 30 === 0) {
    const c = ch.carrierId ? ch.getPlayerState(ch.carrierId)! : null;
    console.log(
      `  t=${t.toFixed(1)} ball=${f(ch.ballPos)} carrier=${ch.carrierId?.slice(-4) ?? '-'} gap=${c ? c.currentPos.distanceTo(ch.ballPos.clone().setY(0)).toFixed(1) : '-'} cpos=${c ? f(c.currentPos) : ''}`,
    );
  }
}
