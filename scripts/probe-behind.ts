import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer, TeamTacticsInput } from '../src/render3d/choreographer';
const gs = createNewGame({ seed: 12345, userClubId: 'c01' });
const counts: Record<string, number> = {};
for (const fx of gs.fixtures.slice(0, 3)) {
  const home = gs.clubs[fx.homeId]!;
  const away = gs.clubs[fx.awayId]!;
  const events = createMatch(
    {
      fixtureId: fx.id,
      home: buildTeamSheet(home, gs.players, 'home'),
      away: buildTeamSheet(away, gs.players, 'away'),
      isDerby: false,
      weather: fx.weather,
      userSide: 'home',
      aiControls: ['home', 'away'],
    },
    777,
  ).runToEnd();
  const lineup = (c: typeof home) =>
    (c.tactics.lineup.filter(Boolean).length === 11
      ? c.tactics.lineup
      : c.squad.slice(0, 11)) as string[];
  const tac = (c: typeof home): TeamTacticsInput => ({
    formation: c.tactics.formation,
    ...c.tactics.instructions,
    lineup: lineup(c),
  });
  const pace: Record<string, number> = {};
  Object.values(gs.players).forEach((p) => (pace[p.id] = p.attributes.pace));
  const ch = new Choreographer(tac(home), tac(away), pace);
  ch.setEvents(events);
  const ids = [...lineup(home), ...lineup(away)];
  for (let t = 0; t < 600; t += 1 / 30) {
    ch.update(1 / 30, t, null, 1);
    for (const pid of ids) {
      const s = ch.getPlayerState(pid)!;
      if (Math.abs(s.currentPos.x) > 52.6) {
        const slot = [...lineup(home), ...lineup(away)].indexOf(pid) % 11;
        const k = `${ch.activePlan?.type}|slot${slot}|${ch.carrierId === pid ? 'carrier' : ''}|tgt${Math.abs(s.targetPos.x) > 52.6 ? 'OUT' : 'in'}`;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
  }
}
console.log(
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => `${v}\t${k}`)
    .join('\n'),
);
