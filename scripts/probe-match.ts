// Probe: play real matches through playback + director headlessly and measure motion quality.
import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { MatchPlayback } from '../src/ui/screens/Match/playback';
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
const mode = (process.argv[2] ?? 'full') as any;
const gaps: number[] = [];
let tot = {
  frames: 0,
  teleports: 0,
  carryGap: 0,
  carryN: 0,
  still: 0,
  moved: 0,
  goals: 0,
  boxAtGoal: 0,
  scorerNear: 0,
  maxBallSpeed: 0,
  inAir: 0,
};
for (const fx of gs.fixtures.slice(0, 4)) {
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
  const pb = new MatchPlayback({});
  pb.addEvents(events);
  pb.setMode(mode);
  if (mode === 'full') pb.setFullSpeed(2);
  const dt = 1 / 60;
  let last = ch.ballPos.clone();
  const ids = [...lineup(home), ...lineup(away)];
  let seenGoal = new Set<number>();
  for (let f = 0; f < 60 * 240; f++) {
    const st = pb.update(dt);
    if (st.paused) pb.resume();
    if (st.isTimeLapse) {
      last.copy(ch.ballPos);
      ch.update(dt, st.pt, st.currentEvent, st.half);
      last.copy(ch.ballPos);
      continue;
    }
    ch.update(dt, st.pt, st.currentEvent, st.half);
    tot.frames++;
    const step = ch.ballPos.distanceTo(last);
    const sp = step / (dt * (st.speedMultiplier || 1));
    if (st.isReplay) {
      continue;
    }
    if (step > 3) tot.teleports++;
    else tot.maxBallSpeed = Math.max(tot.maxBallSpeed, sp);
    if (ch.ballPos.y > 0.5) tot.inAir++;
    last.copy(ch.ballPos);
    if (ch.carrierId) {
      const c = ch.getPlayerState(ch.carrierId)!;
      const gg = c.currentPos.distanceTo(ch.ballPos.clone().setY(0));
      tot.carryGap += gg;
      tot.carryN++;
      gaps.push(gg);
    }
    for (const id of ids) {
      const s = ch.getPlayerState(id)!;
      if (s.speed < 0.3) tot.still++;
      else tot.moved++;
    }
    const g = (ch as any).activePlan;
    if (
      g &&
      g.type === 'GOAL' &&
      Math.abs(ch.ballPos.x) > 52.6 &&
      !seenGoal.has(g.seq) &&
      !st.isReplay
    ) {
      seenGoal.add(g.seq);
      tot.goals++;
      const atk = g.side === 'home' ? lineup(home) : lineup(away);
      const goalX = Math.sign(ch.ballPos.x) * 52.5;
      tot.boxAtGoal += atk.filter((pid: string) => {
        const p = ch.getPlayerState(pid)!.currentPos;
        return Math.abs(p.x - goalX) < 17 && Math.abs(p.z) < 21;
      }).length;
      if (
        g.scorer &&
        ch
          .getPlayerState(g.scorer)!
          .currentPos.distanceTo(new (ch.ballPos.constructor as any)(goalX, 0, 0)) < 22
      )
        tot.scorerNear++;
    }
  }
}
const r = (a: number, b: number) => (b ? (a / b).toFixed(2) : '-');
console.log(
  `mode=${mode} frames=${tot.frames} ball teleports(>3m/frame)=${tot.teleports} max ball speed=${tot.maxBallSpeed.toFixed(1)} m/s inAir=${((100 * tot.inAir) / tot.frames).toFixed(1)}%`,
);
gaps.sort((a, b) => a - b);
console.log(
  'gap median',
  gaps[gaps.length >> 1].toFixed(2),
  'p75',
  gaps[Math.floor(gaps.length * 0.75)].toFixed(2),
);
console.log(
  `carrier-to-ball avg=${r(tot.carryGap, tot.carryN)} m; players moving=${((100 * tot.moved) / (tot.moved + tot.still)).toFixed(0)}%`,
);
console.log(
  `goals seen=${tot.goals} avg attackers in box at goal=${r(tot.boxAtGoal, tot.goals)} scorer within 22m of goal=${tot.scorerNear}/${tot.goals}`,
);
