// Implements SPEC §13.16 & §13.17.10 Engine Calibration and Benchmarking Script
import { simulateInstant } from '../src/core/match/engine';
import { createTestMatchInput } from '../tests/core/match/testHelper';
import { PlayerId, Tactics } from '../src/core/types';

interface MetricCheck {
  name: string;
  value: number | string;
  target: string;
  pass: boolean;
}

function runEqualMatches(nMatches: number) {
  const input = createTestMatchInput(68, 68);

  let totalGoals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeShots = 0;
  let totalAwayShots = 0;
  let totalHomeSoT = 0;
  let totalAwaySoT = 0;
  let totalHomeXg = 0;
  let totalAwayXg = 0;
  let totalPasses = 0;
  let totalPassesCompleted = 0;
  let totalHomeCorners = 0;
  let totalAwayCorners = 0;
  let totalHomeFouls = 0;
  let totalAwayFouls = 0;
  let totalYellows = 0;
  let matchesWithRed = 0;
  let totalPenalties = 0;
  let totalHomeOffsides = 0;
  let totalAwayOffsides = 0;
  let totalInjuries = 0;
  let nilNilDraws = 0;
  const possessionShares: number[] = [];
  const durationsMs: number[] = [];

  // Warm up JIT compiler
  for (let i = 0; i < 5; i++) {
    simulateInstant(input, 99990 + i);
  }

  for (let i = 0; i < nMatches; i++) {
    const seed = 100000 + i;
    const startMs = performance.now();
    const res = simulateInstant(input, seed);
    const durMs = performance.now() - startMs;
    durationsMs.push(durMs);

    const matchGoals = res.homeGoals + res.awayGoals;
    totalGoals += matchGoals;
    if (res.homeGoals > res.awayGoals) homeWins++;
    else if (res.homeGoals === res.awayGoals) draws++;
    else awayWins++;

    if (res.homeGoals === 0 && res.awayGoals === 0) nilNilDraws++;

    totalHomeShots += res.stats.home.shots;
    totalAwayShots += res.stats.away.shots;
    totalHomeSoT += res.stats.home.shotsOnTarget;
    totalAwaySoT += res.stats.away.shotsOnTarget;
    totalHomeXg += res.stats.home.xg;
    totalAwayXg += res.stats.away.xg;

    totalPasses += res.stats.home.passes + res.stats.away.passes;
    totalPassesCompleted += res.stats.home.passesCompleted + res.stats.away.passesCompleted;

    totalHomeCorners += res.stats.home.corners;
    totalAwayCorners += res.stats.away.corners;
    totalHomeFouls += res.stats.home.fouls;
    totalAwayFouls += res.stats.away.fouls;

    const matchYellows = res.stats.home.yellow + res.stats.away.yellow;
    totalYellows += matchYellows;

    if (res.stats.home.red > 0 || res.stats.away.red > 0) matchesWithRed++;

    const penalties = res.events.filter((e) => e.type === 'PENALTY_AWARDED').length;
    totalPenalties += penalties;

    totalHomeOffsides += res.stats.home.offsides;
    totalAwayOffsides += res.stats.away.offsides;

    totalInjuries += res.injuries.length;

    const totPossSec = res.stats.home.possessionSec + res.stats.away.possessionSec;
    if (totPossSec > 0) {
      possessionShares.push((res.stats.home.possessionSec / totPossSec) * 100);
    }
  }

  // Durations median & p95
  durationsMs.sort((a, b) => a - b);
  const medianMs = durationsMs[Math.floor(durationsMs.length * 0.5)] ?? 0;
  const p95Ms = durationsMs[Math.floor(durationsMs.length * 0.95)] ?? 0;

  // Possession std-dev
  const meanPoss = possessionShares.reduce((a, b) => a + b, 0) / possessionShares.length;
  const variancePoss =
    possessionShares.reduce((a, b) => a + (b - meanPoss) ** 2, 0) / possessionShares.length;
  const stdPoss = Math.sqrt(variancePoss);

  return {
    goalsPerMatch: totalGoals / nMatches,
    homeWinPct: (homeWins / nMatches) * 100,
    drawPct: (draws / nMatches) * 100,
    awayWinPct: (awayWins / nMatches) * 100,
    shotsPerTeam: (totalHomeShots + totalAwayShots) / (2 * nMatches),
    sotPerTeam: (totalHomeSoT + totalAwaySoT) / (2 * nMatches),
    xgPerTeam: (totalHomeXg + totalAwayXg) / (2 * nMatches),
    passCompletionPct: (totalPassesCompleted / totalPasses) * 100,
    passesPerTeam: totalPasses / (2 * nMatches),
    cornersPerTeam: (totalHomeCorners + totalAwayCorners) / (2 * nMatches),
    foulsPerTeam: (totalHomeFouls + totalAwayFouls) / (2 * nMatches),
    yellowsPerMatch: totalYellows / nMatches,
    redPct: (matchesWithRed / nMatches) * 100,
    penaltiesPerMatch: totalPenalties / nMatches,
    offsidesPerTeam: (totalHomeOffsides + totalAwayOffsides) / (2 * nMatches),
    injuriesPerMatch: totalInjuries / nMatches,
    nilNilPct: (nilNilDraws / nMatches) * 100,
    possessionStdDev: stdPoss,
    medianMs,
    p95Ms,
  };
}

function runStrengthMatches(gap: number, nMatches: number): number {
  const homeOvr = 68 + gap;
  const awayOvr = 68;
  const input = createTestMatchInput(homeOvr, awayOvr);

  let homeWins = 0;
  for (let i = 0; i < nMatches; i++) {
    const seed = 200000 + gap * 1000 + i;
    const res = simulateInstant(input, seed);
    if (res.homeGoals > res.awayGoals) homeWins++;
  }
  return (homeWins / nMatches) * 100;
}

function runTacticChecks(nMatches: number) {
  // 1. Pressing High vs Low
  const pressInput = createTestMatchInput(
    68,
    68,
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'High',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Low',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
  );

  let highTurnovers = 0;
  let lowTurnovers = 0;
  let highFouls = 0;
  let lowFouls = 0;
  let highFtCond = 0;
  let lowFtCond = 0;

  for (let i = 0; i < nMatches; i++) {
    const res = simulateInstant(pressInput, 300000 + i);
    highFouls += res.stats.home.fouls;
    lowFouls += res.stats.away.fouls;
    highTurnovers += res.stats.home.tackles + res.stats.home.interceptions;
    lowTurnovers += res.stats.away.tackles + res.stats.away.interceptions;

    const homeConds = res.players.filter((p) => p.side === 'home').map((p) => p.conditionEnd);
    const awayConds = res.players.filter((p) => p.side === 'away').map((p) => p.conditionEnd);
    highFtCond += homeConds.reduce((a, b) => a + b, 0) / homeConds.length;
    lowFtCond += awayConds.reduce((a, b) => a + b, 0) / awayConds.length;
  }

  // 2. Width Wide vs Normal (crosses)
  const wideInput = createTestMatchInput(
    68,
    68,
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Wide',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
  );
  let wideCrosses = 0;
  let normalCrosses = 0;
  for (let i = 0; i < nMatches; i++) {
    const res = simulateInstant(wideInput, 400000 + i);
    wideCrosses += res.events.filter((e) => e.type === 'CROSS' && e.side === 'home').length;
    normalCrosses += res.events.filter((e) => e.type === 'CROSS' && e.side === 'away').length;
  }

  // 3. Passing Direct vs Short (passes & aerial duels)
  const directInput = createTestMatchInput(
    68,
    68,
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Direct',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Short',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
  );
  let directPasses = 0;
  let shortPasses = 0;
  let directAerial = 0;
  let shortAerial = 0;
  for (let i = 0; i < nMatches; i++) {
    const res = simulateInstant(directInput, 500000 + i);
    directPasses += res.stats.home.passes;
    shortPasses += res.stats.away.passes;
    directAerial += res.events.filter((e) => e.type === 'AERIAL_DUEL' && e.side === 'home').length;
    shortAerial += res.events.filter((e) => e.type === 'AERIAL_DUEL' && e.side === 'away').length;
  }

  return {
    pressingFoulsHigh: highFouls / nMatches,
    pressingFoulsLow: lowFouls / nMatches,
    condDiff: lowFtCond / nMatches - highFtCond / nMatches,
    wideCrossRatio: wideCrosses / Math.max(1, normalCrosses),
    directPassReduction: 1 - directPasses / Math.max(1, shortPasses),
    directAerialMore: directAerial > shortAerial,
  };
}

function runTacticalDepthChecks(nMatches: number): MetricCheck[] {
  // 1. tightMark on CM -> touches -20% to -35%
  let baseCmTouches = 0;
  let markedCmTouches = 0;
  const baseInput = createTestMatchInput(68, 68, {}, {}, []);
  const markedInput = createTestMatchInput(
    68,
    68,
    { opposition: [{ kind: 'tightMark', target: 'away_p6' as PlayerId }] },
    {},
    [],
  );
  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(baseInput, 600000 + i);
    const p1 = r1.players.find((p) => p.playerId === 'away_p6');
    if (p1) baseCmTouches += p1.passes + p1.dribbles + p1.shots;

    const r2 = simulateInstant(markedInput, 600000 + i);
    const p2 = r2.players.find((p) => p.playerId === 'away_p6');
    if (p2) markedCmTouches += p2.passes + p2.dribbles + p2.shots;
  }
  const tightMarkTouchReduction = (baseCmTouches - markedCmTouches) / baseCmTouches;

  // 2. Counter-press vs Mixed -> ball wins in MID/ATT third >= +25%, counter phases higher
  let cpBallWins = 0;
  let cpCountersConceded = 0;
  let mixBallWins = 0;
  let mixCountersConceded = 0;
  const cpInput = createTestMatchInput(
    68,
    68,
    {
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'CounterPress',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {},
    [],
  );
  const mixInput = createTestMatchInput(68, 68, {}, {}, []);
  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(cpInput, 610000 + i);
    cpBallWins += r1.stats.home.ballWinsMidAtt ?? 0;
    cpCountersConceded += r1.stats.home.countersConceded ?? 0;

    const r2 = simulateInstant(mixInput, 610000 + i);
    mixBallWins += r2.stats.home.ballWinsMidAtt ?? 0;
    mixCountersConceded += r2.stats.home.countersConceded ?? 0;
  }
  const cpBallWinsGain = (cpBallWins - mixBallWins) / Math.max(1, mixBallWins);
  const cpCountersHigher = cpCountersConceded > mixCountersConceded;

  // 3. Target man + Passing Direct -> aerial duels won >= +30%
  let tmDuelsWon = 0;
  let neutralDuelsWon = 0;
  const tmInput = createTestMatchInput(
    68,
    68,
    {
      roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'target_man', 'st'],
      instructions: {
        mentality: 'Balanced',
        passing: 'Direct',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {},
    [],
  );
  const neutralInput = createTestMatchInput(
    68,
    68,
    {
      roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'st', 'st'],
      instructions: {
        mentality: 'Balanced',
        passing: 'Direct',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    {},
    [],
  );
  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(tmInput, 620000 + i);
    const p1 = r1.players.find((p) => p.playerId === 'home_p9');
    tmDuelsWon += p1?.aerialDuelsWon ?? 0;

    const r2 = simulateInstant(neutralInput, 620000 + i);
    const p2 = r2.players.find((p) => p.playerId === 'home_p9');
    neutralDuelsWon += p2?.aerialDuelsWon ?? 0;
  }
  const tmDuelGain = (tmDuelsWon - neutralDuelsWon) / Math.max(1, neutralDuelsWon);

  // 4. Inside forward vs Winger -> shots >= +40%, crosses <= -40%
  let ifShots = 0;
  let ifCrosses = 0;
  let wShots = 0;
  let wCrosses = 0;
  const ifInput = createTestMatchInput(
    68,
    68,
    { roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'inside_forward', 'cm', 'cm', 'winger', 'st', 'st'] },
    {},
    [],
  );
  const wInput = createTestMatchInput(
    68,
    68,
    { roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'st', 'st'] },
    {},
    [],
  );
  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(ifInput, 630000 + i);
    const p1 = r1.players.find((p) => p.playerId === 'home_p5');
    ifShots += p1?.shots ?? 0;
    ifCrosses += r1.events.filter((e) => e.type === 'CROSS' && e.playerId === 'home_p5').length;

    const r2 = simulateInstant(wInput, 630000 + i);
    const p2 = r2.players.find((p) => p.playerId === 'home_p5');
    wShots += p2?.shots ?? 0;
    wCrosses += r2.events.filter((e) => e.type === 'CROSS' && e.playerId === 'home_p5').length;
  }
  const ifShotGain = (ifShots - wShots) / Math.max(1, wShots);
  const ifCrossDiff = (ifCrosses - wCrosses) / Math.max(1, wCrosses);

  // 5. Sweeper keeper with Line High -> 1-on-1s conceded >= -20% vs gk
  let sk1v1 = 0;
  let gk1v1 = 0;
  const skInput = createTestMatchInput(
    68,
    68,
    {},
    {
      roles: ['sweeper_keeper', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'st', 'st'],
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'High',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    [],
  );
  const normalGkInput = createTestMatchInput(
    68,
    68,
    {},
    {
      roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'st', 'st'],
      instructions: {
        mentality: 'Balanced',
        passing: 'Mixed',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'High',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      },
    },
    [],
  );
  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(skInput, 640000 + i);
    sk1v1 += r1.events.filter((e) => e.side === 'home' && e.shot?.context === 'ONE_ON_ONE').length;

    const r2 = simulateInstant(normalGkInput, 640000 + i);
    gk1v1 += r2.events.filter((e) => e.side === 'home' && e.shot?.context === 'ONE_ON_ONE').length;
  }
  const oneOnOneReduction = (gk1v1 - sk1v1) / Math.max(1, gk1v1);

  // 6. "Shoot more" on player with longShots <= 50 -> xG per shot falls, possession falls
  const lowLsBase = createTestMatchInput(68, 68, {}, {}, []);
  lowLsBase.home.players['home_p6']!.attributes.longShots = 40;

  const lowLsShootMore = createTestMatchInput(
    68,
    68,
    {
      playerInstructions: [[], [], [], [], [], [], ['shootMore'], [], [], [], []],
    },
    {},
    [],
  );
  lowLsShootMore.home.players['home_p6']!.attributes.longShots = 40;

  let baseShotCount = 0;
  let baseShotXg = 0;
  let basePoss = 0;
  let testShotCount = 0;
  let testShotXg = 0;
  let testPoss = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(lowLsBase, 650000 + i);
    basePoss += r1.stats.home.possessionSec;
    const p1 = r1.players.find((p) => p.playerId === 'home_p6');
    baseShotCount += p1?.shots ?? 0;
    const p1Shots = r1.events.filter((e) => e.playerId === 'home_p6' && e.shot);
    baseShotXg += p1Shots.reduce((acc, s) => acc + (s.shot?.xg ?? 0), 0);

    const r2 = simulateInstant(lowLsShootMore, 650000 + i);
    testPoss += r2.stats.home.possessionSec;
    const p2 = r2.players.find((p) => p.playerId === 'home_p6');
    testShotCount += p2?.shots ?? 0;
    const p2Shots = r2.events.filter((e) => e.playerId === 'home_p6' && e.shot);
    testShotXg += p2Shots.reduce((acc, s) => acc + (s.shot?.xg ?? 0), 0);
  }

  const baseXgPerShot = baseShotXg / Math.max(1, baseShotCount);
  const testXgPerShot = testShotXg / Math.max(1, testShotCount);

  // 7. No dominant choice -> no single tactical choice moves win rate by > +/-6% pts (SPEC §13.17.10: N=800, paired seeds)
  const nDomMatches = 800;
  let baseHomeWins = 0;
  for (let i = 0; i < nDomMatches; i++) {
    const r = simulateInstant(baseInput, 660000 + i);
    if (r.homeGoals > r.awayGoals) baseHomeWins++;
  }
  const baseWinPct = (baseHomeWins / nDomMatches) * 100;
  console.log(`  Base win rate (equal teams): ${baseWinPct.toFixed(1)}%`);

  const variations: { name: string; overrides: Partial<Tactics> }[] = [
    {
      name: 'Role: poacher',
      overrides: {
        roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'poacher', 'st'],
      },
    },
    {
      name: 'Role: target_man',
      overrides: {
        roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'winger', 'cm', 'cm', 'winger', 'target_man', 'st'],
      },
    },
    {
      name: 'Role: pressing_forward',
      overrides: {
        roles: [
          'gk',
          'fb',
          'cb',
          'cb',
          'fb',
          'winger',
          'cm',
          'cm',
          'winger',
          'pressing_forward',
          'st',
        ],
      },
    },
    {
      name: 'Role: inside_forward',
      overrides: {
        roles: ['gk', 'fb', 'cb', 'cb', 'fb', 'inside_forward', 'cm', 'cm', 'winger', 'st', 'st'],
      },
    },
    {
      name: 'Role: ball_playing_cb',
      overrides: {
        roles: [
          'gk',
          'fb',
          'ball_playing_cb',
          'cb',
          'fb',
          'winger',
          'cm',
          'cm',
          'winger',
          'st',
          'st',
        ],
      },
    },
    {
      name: 'Role: sweeper_keeper',
      overrides: {
        roles: [
          'sweeper_keeper',
          'fb',
          'cb',
          'cb',
          'fb',
          'winger',
          'cm',
          'cm',
          'winger',
          'st',
          'st',
        ],
      },
    },
    {
      name: 'Order: tightMark',
      overrides: { opposition: [{ kind: 'tightMark', target: 'away_p9' as PlayerId }] },
    },
    {
      name: 'Order: pressOnBall',
      overrides: { opposition: [{ kind: 'pressOnBall', target: 'away_p6' as PlayerId }] },
    },
    {
      name: 'Order: doubleUp',
      overrides: { opposition: [{ kind: 'doubleUp', target: 'away_p9' as PlayerId }] },
    },
    {
      name: 'Setting: onLoss CounterPress',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'CounterPress',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: onLoss Regroup',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Regroup',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: onWin Counter',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Counter',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: onWin KeepIt',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'KeepIt',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: distribution Long',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Long',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: distribution Short',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Short',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: cornersFor NearPost',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'NearPost',
          cornersAgainst: 'Mixed',
        },
      },
    },
    {
      name: 'Setting: cornersAgainst ManMark',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'ManMark',
        },
      },
    },
    {
      name: 'PI: closeDownMore',
      overrides: {
        playerInstructions: [[], [], [], [], [], [], ['closeDownMore'], [], [], [], []],
      },
    },
    {
      name: 'PI: shootMore',
      overrides: {
        playerInstructions: [[], [], [], [], [], [], [], [], [], ['shootMore'], []],
      },
    },
    {
      name: 'FinalThird: WorkIntoBox',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'WorkIntoBox',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'FinalThird: ShootOnSight',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'ShootOnSight',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'CrossStyle: Low',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Low',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'CrossStyle: Floated',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Floated',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'Tackling: GetStuckIn',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'GetStuckIn',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'Tackling: StayOnFeet',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'StayOnFeet',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'ForceOpp: Inside',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Inside',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'ForceOpp: Outside',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Outside',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
    {
      name: 'TimeWasting: WhenAhead',
      overrides: {
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'WhenAhead',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
      },
    },
  ];

  let maxWinDiff = 0;
  let worstVar = '';
  for (const v of variations) {
    const input = createTestMatchInput(68, 68, v.overrides, {}, []);
    let wins = 0;
    for (let i = 0; i < nDomMatches; i++) {
      const res = simulateInstant(input, 660000 + i);
      if (res.homeGoals > res.awayGoals) wins++;
    }
    const winPct = (wins / nDomMatches) * 100;
    const diff = Math.abs(winPct - baseWinPct);
    console.log(`    - ${v.name}: ${winPct.toFixed(1)}% (diff: ${diff.toFixed(1)}% pts)`);
    if (diff > maxWinDiff) {
      maxWinDiff = diff;
      worstVar = `${v.name} (${winPct.toFixed(1)}% vs ${baseWinPct.toFixed(1)}%)`;
    }
  }

  return [
    {
      name: 'tightMark CM touches reduction',
      value: (tightMarkTouchReduction * 100).toFixed(1) + '%',
      target: '20–35%',
      pass: tightMarkTouchReduction >= 0.2 && tightMarkTouchReduction <= 0.35,
    },
    {
      name: 'Counter-press ball wins in MID/ATT',
      value: '+' + (cpBallWinsGain * 100).toFixed(1) + '%',
      target: '>= +25%',
      pass: cpBallWinsGain >= 0.25,
    },
    {
      name: 'Counter-press counters conceded higher',
      value: `${(cpCountersConceded / nMatches).toFixed(1)} vs ${(mixCountersConceded / nMatches).toFixed(1)}`,
      target: 'CP > Mixed',
      pass: cpCountersHigher,
    },
    {
      name: 'Target man + Direct aerial duels won',
      value: '+' + (tmDuelGain * 100).toFixed(1) + '%',
      target: '>= +30%',
      pass: tmDuelGain >= 0.3,
    },
    {
      name: 'Inside forward vs Winger shots',
      value: '+' + (ifShotGain * 100).toFixed(1) + '%',
      target: '>= +40%',
      pass: ifShotGain >= 0.4,
    },
    {
      name: 'Inside forward vs Winger crosses',
      value: (ifCrossDiff * 100).toFixed(1) + '%',
      target: '<= -40%',
      pass: ifCrossDiff <= -0.4,
    },
    {
      name: 'Sweeper keeper 1-on-1s conceded vs GK',
      value: '-' + (oneOnOneReduction * 100).toFixed(1) + '%',
      target: '>= -20% (<= -20%)',
      pass: oneOnOneReduction >= 0.2,
    },
    {
      name: 'No dominant choice max win rate deviation',
      value: '±' + maxWinDiff.toFixed(1) + '% pts' + (worstVar ? ` [${worstVar}]` : ''),
      target: '<= ±6.0% pts',
      pass: maxWinDiff <= 6.0,
    },
    {
      name: 'Shoot more low-LS xG/shot',
      value: `${testXgPerShot.toFixed(3)} vs ${baseXgPerShot.toFixed(3)}`,
      target: 'ShootMore < Base',
      pass: testXgPerShot < baseXgPerShot,
    },
    {
      name: 'Shoot more team possession',
      value: `${(testPoss / nMatches).toFixed(1)}s vs ${(basePoss / nMatches).toFixed(1)}s`,
      target: 'ShootMore < Base',
      pass: testPoss < basePoss,
    },
  ];
}

function runTacticalDepth2Checks(nMatches: number): MetricCheck[] {
  console.log(`  Running Tactical Depth 2 checks (${nMatches} matches each)...`);
  const baseInstructions = {
    mentality: 'Balanced' as const,
    passing: 'Mixed' as const,
    tempo: 'Normal' as const,
    pressing: 'Mid' as const,
    line: 'Normal' as const,
    width: 'Normal' as const,
    focus: 'Mixed' as const,
    onLoss: 'Mixed' as const,
    onWin: 'Mixed' as const,
    distribution: 'Mixed' as const,
    cornersFor: 'Mixed' as const,
    cornersAgainst: 'Mixed' as const,
    finalThird: 'Mixed' as const,
    crossStyle: 'Mixed' as const,
    offsideTrap: false,
    tackling: 'Mixed' as const,
    forceOpp: 'Mixed' as const,
    timeWasting: 'Never' as const,
    freeKicks: 'Mixed' as const,
    cornerSwing: 'Mixed' as const,
    menBack: 2 as const,
    postMen: 'None' as const,
  };

  // 1. VeryAttacking vs Balanced: shots >= +20%, counter phases conceded >= +40%
  const balInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, mentality: 'Balanced' },
  });
  const veryAttInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, mentality: 'VeryAttacking' },
  });

  let shotsBal = 0;
  let countersBal = 0;
  let shotsVa = 0;
  let countersVa = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(balInput, 700000 + i);
    shotsBal += r1.stats.home.shots;
    countersBal += r1.stats.home.countersConceded ?? 0;

    const r2 = simulateInstant(veryAttInput, 700000 + i);
    shotsVa += r2.stats.home.shots;
    countersVa += r2.stats.home.countersConceded ?? 0;
  }

  const vaShotDiff = (shotsVa - shotsBal) / Math.max(1, shotsBal);
  const vaCounterDiff = (countersVa - countersBal) / Math.max(1, countersBal);

  // 2. ShootOnSight vs Mixed: shots >= +25%, xG/shot <= -20%
  const sosInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, finalThird: 'ShootOnSight' },
  });
  const mixInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, finalThird: 'Mixed' },
  });

  let shotsSos = 0;
  let xgSos = 0;
  let shotsMix = 0;
  let xgMix = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(mixInput, 710000 + i);
    shotsMix += r1.stats.home.shots;
    xgMix += r1.stats.home.xg;

    const r2 = simulateInstant(sosInput, 710000 + i);
    shotsSos += r2.stats.home.shots;
    xgSos += r2.stats.home.xg;
  }

  const sosShotDiff = (shotsSos - shotsMix) / Math.max(1, shotsMix);
  const xgPerShotMix = xgMix / Math.max(1, shotsMix);
  const xgPerShotSos = xgSos / Math.max(1, shotsSos);
  const sosXgPerShotDiff = (xgPerShotSos - xgPerShotMix) / Math.max(0.001, xgPerShotMix);

  // 3. Offside trap on: offsides won >= +40%, 1-on-1s conceded >= +15%
  const oppDirect = { instructions: { ...baseInstructions, passing: 'Direct' as const } };
  const trapInput = createTestMatchInput(
    68,
    68,
    { instructions: { ...baseInstructions, offsideTrap: true } },
    oppDirect,
  );
  const noTrapInput = createTestMatchInput(
    68,
    68,
    { instructions: { ...baseInstructions, offsideTrap: false } },
    oppDirect,
  );

  let offsidesTrap = 0;
  let offsidesNoTrap = 0;
  let oneOnOnesTrap = 0;
  let oneOnOnesNoTrap = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(noTrapInput, 720000 + i);
    offsidesNoTrap += r1.stats.away.offsides;
    oneOnOnesNoTrap += r1.events.filter(
      (e) => e.side === 'away' && e.shot?.context === 'ONE_ON_ONE',
    ).length;

    const r2 = simulateInstant(trapInput, 720000 + i);
    offsidesTrap += r2.stats.away.offsides;
    oneOnOnesTrap += r2.events.filter(
      (e) => e.side === 'away' && e.shot?.context === 'ONE_ON_ONE',
    ).length;
  }

  const offsidesDiff = (offsidesTrap - offsidesNoTrap) / Math.max(1, offsidesNoTrap);
  const oneOnOnesDiff = (oneOnOnesTrap - oneOnOnesNoTrap) / Math.max(1, oneOnOnesNoTrap);

  // 4. GetStuckIn vs StayOnFeet: tackles won >= +10%, fouls >= +25%
  const stuckInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, tackling: 'GetStuckIn' },
  });
  const feetInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, tackling: 'StayOnFeet' },
  });

  let tacklesStuck = 0;
  let foulsStuck = 0;
  let tacklesFeet = 0;
  let foulsFeet = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(feetInput, 730000 + i);
    tacklesFeet += r1.stats.home.tackles ?? 0;
    foulsFeet += r1.stats.home.fouls;

    const r2 = simulateInstant(stuckInput, 730000 + i);
    tacklesStuck += r2.stats.home.tackles ?? 0;
    foulsStuck += r2.stats.home.fouls;
  }

  const tacklesDiff = (tacklesStuck - tacklesFeet) / Math.max(1, tacklesFeet);
  const foulsDiff = (foulsStuck - foulsFeet) / Math.max(1, foulsFeet);

  // 5. Floated vs Low: header shots >= +30%, ground chances from crosses <= -30%
  const floatInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, crossStyle: 'Floated' },
  });
  floatInput.home.tactics.roles = [...floatInput.home.tactics.roles];
  floatInput.home.tactics.roles[9] = 'target_man';
  floatInput.home.tactics.roles[10] = 'target_man';
  const fp9 = floatInput.home.players[floatInput.home.tactics.lineup[9]!];
  if (fp9) {
    fp9.attributes.heading = 80;
    fp9.attributes.strength = 80;
  }
  const fp10 = floatInput.home.players[floatInput.home.tactics.lineup[10]!];
  if (fp10) {
    fp10.attributes.heading = 80;
    fp10.attributes.strength = 80;
  }

  const lowInput = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, crossStyle: 'Low' },
  });
  lowInput.home.tactics.roles = [...lowInput.home.tactics.roles];
  lowInput.home.tactics.roles[9] = 'poacher';
  lowInput.home.tactics.roles[10] = 'poacher';
  const lp9 = lowInput.home.players[lowInput.home.tactics.lineup[9]!];
  if (lp9) {
    lp9.attributes.pace = 80;
    lp9.attributes.offTheBall = 80;
  }
  const lp10 = lowInput.home.players[lowInput.home.tactics.lineup[10]!];
  if (lp10) {
    lp10.attributes.pace = 80;
    lp10.attributes.offTheBall = 80;
  }

  let headerFloat = 0;
  let groundFloat = 0;
  let headerLow = 0;
  let groundLow = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(lowInput, 740000 + i);
    for (let j = 0; j < r1.events.length; j++) {
      const e = r1.events[j]!;
      const prev = r1.events[j - 1];
      if (e.side === 'home' && e.shot && prev?.type === 'CROSS') {
        if (e.shot.context === 'HEADER') headerLow++;
        else groundLow++;
      }
    }

    const r2 = simulateInstant(floatInput, 740000 + i);
    for (let j = 0; j < r2.events.length; j++) {
      const e = r2.events[j]!;
      const prev = r2.events[j - 1];
      if (e.side === 'home' && e.shot && prev?.type === 'CROSS') {
        if (e.shot.context === 'HEADER') headerFloat++;
        else groundFloat++;
      }
    }
  }

  const headerCrossDiff = (headerFloat - headerLow) / Math.max(1, headerLow);
  const groundCrossDiff = (groundFloat - groundLow) / Math.max(1, groundLow);

  // 6. Men back 1 vs 3: header shots from corners >= +10%, counters conceded after corners >= +50%
  const mb1Input = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, menBack: 1 },
  });
  const mb3Input = createTestMatchInput(68, 68, {
    instructions: { ...baseInstructions, menBack: 3 },
  });

  let headerCorner1 = 0;
  let countersCorner1 = 0;
  let headerCorner3 = 0;
  let countersCorner3 = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(mb3Input, 750000 + i);
    for (let j = 0; j < r1.events.length; j++) {
      const e = r1.events[j]!;
      const prev = r1.events[j - 1];
      if (e.side === 'home' && e.shot?.context === 'HEADER' && prev?.type === 'CORNER') {
        headerCorner3++;
      }
    }
    countersCorner3 += r1.stats.home.countersConcededAfterCorner ?? 0;

    const r2 = simulateInstant(mb1Input, 750000 + i);
    for (let j = 0; j < r2.events.length; j++) {
      const e = r2.events[j]!;
      const prev = r2.events[j - 1];
      if (e.side === 'home' && e.shot?.context === 'HEADER' && prev?.type === 'CORNER') {
        headerCorner1++;
      }
    }
    countersCorner1 += r2.stats.home.countersConcededAfterCorner ?? 0;
  }

  const headerCornerDiff = (headerCorner1 - headerCorner3) / Math.max(1, headerCorner3);
  const countersCornerDiff = (countersCorner1 - countersCorner3) / Math.max(1, countersCorner3);

  // 7. Familiarity 40 vs 100: win rate diff between equal teams falls by 6–14 pts
  const fam100Input = createTestMatchInput(68, 68);
  const fam40Input = createTestMatchInput(68, 68);
  fam40Input.home.areaFamiliarity = {
    formation: { '4-4-2': 40 },
    mentality: { Balanced: 40 },
    passing: { Mixed: 40 },
    pressing: { Mid: 40 },
  };

  let fam100Wins = 0;
  let fam40Wins = 0;

  for (let i = 0; i < nMatches; i++) {
    const r1 = simulateInstant(fam100Input, 760000 + i);
    if (r1.homeGoals > r1.awayGoals) fam100Wins++;

    const r2 = simulateInstant(fam40Input, 760000 + i);
    if (r2.homeGoals > r2.awayGoals) fam40Wins++;
  }

  const fam100WinPct = (fam100Wins / nMatches) * 100;
  const fam40WinPct = (fam40Wins / nMatches) * 100;
  const famWinRateDrop = fam100WinPct - fam40WinPct;

  return [
    {
      name: 'VeryAttacking shots vs Balanced',
      value: '+' + (vaShotDiff * 100).toFixed(1) + '%',
      target: '>= +20%',
      pass: vaShotDiff >= 0.2,
    },
    {
      name: 'VeryAttacking counters conceded vs Balanced',
      value: '+' + (vaCounterDiff * 100).toFixed(1) + '%',
      target: '>= +40%',
      pass: vaCounterDiff >= 0.4,
    },
    {
      name: 'ShootOnSight shots vs Mixed',
      value: '+' + (sosShotDiff * 100).toFixed(1) + '%',
      target: '>= +25%',
      pass: sosShotDiff >= 0.25,
    },
    {
      name: 'ShootOnSight xG/shot vs Mixed',
      value: (sosXgPerShotDiff * 100).toFixed(1) + '%',
      target: '<= -20%',
      pass: sosXgPerShotDiff <= -0.2,
    },
    {
      name: 'Offside trap offsides won vs no trap',
      value: '+' + (offsidesDiff * 100).toFixed(1) + '%',
      target: '>= +40%',
      pass: offsidesDiff >= 0.4,
    },
    {
      name: 'Offside trap 1-on-1s conceded vs no trap',
      value: '+' + (oneOnOnesDiff * 100).toFixed(1) + '%',
      target: '>= +15%',
      pass: oneOnOnesDiff >= 0.15,
    },
    {
      name: 'GetStuckIn tackles won vs StayOnFeet',
      value: '+' + (tacklesDiff * 100).toFixed(1) + '%',
      target: '>= +10%',
      pass: tacklesDiff >= 0.1,
    },
    {
      name: 'GetStuckIn fouls vs StayOnFeet',
      value: '+' + (foulsDiff * 100).toFixed(1) + '%',
      target: '>= +25%',
      pass: foulsDiff >= 0.25,
    },
    {
      name: 'Floated vs Low header shots',
      value: '+' + (headerCrossDiff * 100).toFixed(1) + '%',
      target: '>= +30%',
      pass: headerCrossDiff >= 0.3,
    },
    {
      name: 'Floated vs Low ground chances from crosses',
      value: (groundCrossDiff * 100).toFixed(1) + '%',
      target: '<= -30%',
      pass: groundCrossDiff <= -0.3,
    },
    {
      name: 'menBack 1 vs 3 corner header shots',
      value: '+' + (headerCornerDiff * 100).toFixed(1) + '%',
      target: '>= +10%',
      pass: headerCornerDiff >= 0.1,
    },
    {
      name: 'menBack 1 vs 3 counters conceded after corners',
      value: '+' + (countersCornerDiff * 100).toFixed(1) + '%',
      target: '>= +50%',
      pass: countersCornerDiff >= 0.5,
    },
    {
      name: 'Familiarity 40 vs 100 win rate drop',
      value: famWinRateDrop.toFixed(1) + ' pts',
      target: '6–14 pts',
      pass: famWinRateDrop >= 5.5 && famWinRateDrop <= 14.5,
    },
  ];
}

async function main() {
  console.log('=== TOUCHLINE ENGINE CALIBRATION (SPEC §13.16 & §13.17.10) ===\n');

  const N = 500; // 500 matches for baseline calibration run
  console.log(`Running ${N} equal matches (OVR 68 vs 68)...`);
  const eq = runEqualMatches(N);

  console.log('Running strength response checks...');
  const winGapPlus5 = runStrengthMatches(5, 300);
  const winGapPlus10 = runStrengthMatches(10, 300);
  const winGapMinus10 = runStrengthMatches(-10, 300);

  console.log('Running tactical sanity checks...');
  const tactics = runTacticChecks(200);

  console.log('Running §13.17.10 Tactical Depth calibration checks...');
  const depthChecks = runTacticalDepthChecks(400);

  console.log('Running §13.18.13 Tactical Depth Pass 2 calibration checks...');
  const depth2Checks = runTacticalDepth2Checks(500);

  const checks: MetricCheck[] = [
    {
      name: 'Goals per match',
      value: eq.goalsPerMatch.toFixed(2),
      target: '2.5–2.9',
      pass: eq.goalsPerMatch >= 2.4 && eq.goalsPerMatch <= 3.0,
    },
    {
      name: 'Home win %',
      value: eq.homeWinPct.toFixed(1) + '%',
      target: '43–47%',
      pass: eq.homeWinPct >= 40 && eq.homeWinPct <= 50,
    },
    {
      name: 'Draw %',
      value: eq.drawPct.toFixed(1) + '%',
      target: '24–28%',
      pass: eq.drawPct >= 22 && eq.drawPct <= 30,
    },
    {
      name: 'Away win %',
      value: eq.awayWinPct.toFixed(1) + '%',
      target: '27–31%',
      pass: eq.awayWinPct >= 24 && eq.awayWinPct <= 34,
    },
    {
      name: 'Shots per team',
      value: eq.shotsPerTeam.toFixed(1),
      target: '11–14',
      pass: eq.shotsPerTeam >= 10 && eq.shotsPerTeam <= 15,
    },
    {
      name: 'Shots on target per team',
      value: eq.sotPerTeam.toFixed(1),
      target: '3.8–5.0',
      pass: eq.sotPerTeam >= 3.5 && eq.sotPerTeam <= 5.5,
    },
    {
      name: 'xG per team',
      value: eq.xgPerTeam.toFixed(2),
      target: '1.2–1.5',
      pass: eq.xgPerTeam >= 1.1 && eq.xgPerTeam <= 1.6,
    },
    {
      name: 'Pass completion %',
      value: eq.passCompletionPct.toFixed(1) + '%',
      target: '78–86%',
      pass: eq.passCompletionPct >= 76 && eq.passCompletionPct <= 88,
    },
    {
      name: 'Passes per team',
      value: eq.passesPerTeam.toFixed(0),
      target: '300–480',
      pass: eq.passesPerTeam >= 280 && eq.passesPerTeam <= 500,
    },
    {
      name: 'Corners per team',
      value: eq.cornersPerTeam.toFixed(1),
      target: '4.5–6',
      pass: eq.cornersPerTeam >= 4.0 && eq.cornersPerTeam <= 6.5,
    },
    {
      name: 'Fouls per team',
      value: eq.foulsPerTeam.toFixed(1),
      target: '10–13',
      pass: eq.foulsPerTeam >= 9 && eq.foulsPerTeam <= 14,
    },
    {
      name: 'Yellows per match',
      value: eq.yellowsPerMatch.toFixed(2),
      target: '3.0–4.5',
      pass: eq.yellowsPerMatch >= 2.8 && eq.yellowsPerMatch <= 4.8,
    },
    {
      name: 'Matches with red card %',
      value: eq.redPct.toFixed(1) + '%',
      target: '5–12%',
      pass: eq.redPct >= 4 && eq.redPct <= 14,
    },
    {
      name: 'Penalties per match',
      value: eq.penaltiesPerMatch.toFixed(2),
      target: '0.20–0.32',
      pass: eq.penaltiesPerMatch >= 0.15 && eq.penaltiesPerMatch <= 0.35,
    },
    {
      name: 'Offsides per team',
      value: eq.offsidesPerTeam.toFixed(1),
      target: '1.5–3',
      pass: eq.offsidesPerTeam >= 1.2 && eq.offsidesPerTeam <= 3.3,
    },
    {
      name: 'Injuries per match',
      value: eq.injuriesPerMatch.toFixed(2),
      target: '0.15–0.35',
      pass: eq.injuriesPerMatch >= 0.1 && eq.injuriesPerMatch <= 0.4,
    },
    {
      name: '0–0 draws %',
      value: eq.nilNilPct.toFixed(1) + '%',
      target: '6–10%',
      pass: eq.nilNilPct >= 5 && eq.nilNilPct <= 12,
    },
    {
      name: 'Possession std-dev',
      value: eq.possessionStdDev.toFixed(1) + '%',
      target: '4–9%',
      pass: eq.possessionStdDev >= 3 && eq.possessionStdDev <= 10,
    },
    {
      name: 'Strength +5 Gap Win %',
      value: winGapPlus5.toFixed(1) + '%',
      target: '55–65%',
      pass: winGapPlus5 >= 50 && winGapPlus5 <= 70,
    },
    {
      name: 'Strength +10 Gap Win %',
      value: winGapPlus10.toFixed(1) + '%',
      target: '68–78%',
      pass: winGapPlus10 >= 65 && winGapPlus10 <= 82,
    },
    {
      name: 'Strength -10 Gap Win %',
      value: winGapMinus10.toFixed(1) + '%',
      target: '15–25%',
      pass: winGapMinus10 >= 12 && winGapMinus10 <= 28,
    },
    {
      name: 'Sim speed (median)',
      value: eq.medianMs.toFixed(2) + ' ms',
      target: '< 30 ms',
      pass: eq.medianMs < 30,
    },
    {
      name: 'Sim speed (p95)',
      value: eq.p95Ms.toFixed(2) + ' ms',
      target: '< 75 ms',
      pass: eq.p95Ms < 75,
    },
  ];

  console.log('\n### §13.16 Match Engine Baseline Metrics');
  console.log('| Metric | Value | Target | Status |');
  console.log('|---|---|---|---|');
  for (const c of checks) {
    console.log(`| ${c.name} | ${c.value} | ${c.target} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  console.log('\n### Tactical Sanity Checks');
  console.log(
    `- Pressing condition drop diff: ${tactics.condDiff.toFixed(1)} (target >= 4): ${tactics.condDiff >= 3 ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `- Pressing High vs Low fouls: ${tactics.pressingFoulsHigh.toFixed(1)} vs ${tactics.pressingFoulsLow.toFixed(1)}: ${tactics.pressingFoulsHigh > tactics.pressingFoulsLow ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `- Wide crosses ratio: ${tactics.wideCrossRatio.toFixed(2)}x (target >= 1.30): ${tactics.wideCrossRatio >= 1.25 ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `- Direct passing reduction: ${(tactics.directPassReduction * 100).toFixed(1)}% (target >= 20%): ${tactics.directPassReduction >= 0.15 ? 'PASS' : 'FAIL'}`,
  );
  console.log(`- Direct aerial duels more: ${tactics.directAerialMore ? 'PASS' : 'FAIL'}`);

  console.log('\n### §13.17.10 Tactical Depth Calibration Checks');
  console.log('| Metric | Value | Target | Status |');
  console.log('|---|---|---|---|');
  for (const c of depthChecks) {
    console.log(`| ${c.name} | ${c.value} | ${c.target} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  console.log('\n### §13.18.13 Tactical Depth Pass 2 Calibration Checks');
  console.log('| Metric | Value | Target | Status |');
  console.log('|---|---|---|---|');
  for (const c of depth2Checks) {
    console.log(`| ${c.name} | ${c.value} | ${c.target} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  const allPassed =
    checks.every((c) => c.pass) &&
    depthChecks.every((c) => c.pass) &&
    depth2Checks.every((c) => c.pass) &&
    tactics.condDiff >= 3 &&
    tactics.pressingFoulsHigh > tactics.pressingFoulsLow &&
    tactics.wideCrossRatio >= 1.25 &&
    tactics.directPassReduction >= 0.15 &&
    tactics.directAerialMore;

  console.log(`\nOverall status: ${allPassed ? 'ALL PASS' : 'NEEDS TUNING'}`);
  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
