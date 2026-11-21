// Implements SPEC §13.2 TeamMatchStats & PlayerMatchLine tracking
import { TeamMatchStats, PlayerMatchLine, PlayerId, Side } from '../types';

export function createEmptyTeamStats(): TeamMatchStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    possessionSec: 0,
    passes: 0,
    passesCompleted: 0,
    corners: 0,
    fouls: 0,
    offsides: 0,
    yellow: 0,
    red: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    bigChances: 0,
    countersStarted: 0,
    countersConceded: 0,
    ballWinsMidAtt: 0,
    ballWinsOppDefThird: 0,
  };
}

export function createPlayerMatchLine(
  playerId: PlayerId,
  side: Side,
  initialCondition: number,
): PlayerMatchLine {
  return {
    playerId,
    side,
    minutes: 0,
    rating: 6.0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyPasses: 0,
    passes: 0,
    passesCompleted: 0,
    dribbles: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    yellow: 0,
    red: 0,
    injured: false,
    conditionEnd: initialCondition,
    aerialDuelsWon: 0,
    throughBallsConceded: 0,
  };
}
