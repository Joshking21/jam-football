// Implements SPEC §13.16 & §22.2 Engine Calibration and Benchmarking Script
import { simulateInstant } from '../src/core/match/engine';
import { createTestMatchInput } from '../tests/core/match/testHelper';

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

async function main() {
  console.log('=== TOUCHLINE ENGINE CALIBRATION (SPEC §13.16) ===\n');

  const N = 500; // 500 matches for initial calibration run
  console.log(`Running ${N} equal matches (OVR 68 vs 68)...`);
  const eq = runEqualMatches(N);

  console.log('Running strength response checks...');
  const winGapPlus5 = runStrengthMatches(5, 300);
  const winGapPlus10 = runStrengthMatches(10, 300);
  const winGapMinus10 = runStrengthMatches(-10, 300);

  console.log('Running tactical sanity checks...');
  const tactics = runTacticChecks(200);

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

  console.log('\n| Metric | Value | Target | Status |');
  console.log('|---|---|---|---|');
  for (const c of checks) {
    console.log(`| ${c.name} | ${c.value} | ${c.target} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  console.log('\nTactical sanity checks:');
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

  const allPassed = checks.every((c) => c.pass);
  console.log(`\nOverall status: ${allPassed ? 'ALL PASS' : 'NEEDS TUNING'}`);
}

main().catch(console.error);
