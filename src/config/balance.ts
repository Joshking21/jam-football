// Implements SPEC §6, §12, §13 balance numbers (all gameplay constants with units)

export const BALANCE = {
  // Condition & Fatigue (SPEC §12.1, §12.2)
  condition: {
    drainPerMinuteBase: 0.22, // points per minute
    staminaDivisor: 200,
    staminaBaseFactor: 1.25,
    pressingFactors: {
      High: 1.12,
      Mid: 1.0,
      Low: 0.92,
    },
    tempoFactors: {
      Fast: 1.05,
      Normal: 1.0,
      Slow: 0.96,
    },
    weeklyRecoveryBase: 18, // points recovered per week
    weeklyRecoveryStaminaDivisor: 10,
    intensityRecoveryMultipliers: {
      Light: 1.2,
      Normal: 1.0,
      Hard: 0.8,
    },
    fitnessFocusBonus: 4, // points
    restBonus: 6, // points for unplayed players
    tiredThreshold: 75,
    dropPenaltyThreshold: 70,
    selectionMinimum: 40,
  },
  fatigue: {
    minutesDivisor: 9, // +minutes/9 after match
    weeklyRecoveryBase: 6, // points
    weeklyRecoveryIntensity: {
      Light: 9,
      Normal: 6,
      Hard: 4,
    },
    hazardThreshold: 60,
    hazardMultiplier: 1.5,
    severeThreshold: 80,
  },
  // Training & Development (SPEC §12.3, §12.4)
  training: {
    baseInjuryChancePerPlayer: 0.004,
    intensityFactors: {
      Light: { growth: 0.6, injury: 0.5, recovery: 1.2 },
      Normal: { growth: 1.0, injury: 1.0, recovery: 1.0 },
      Hard: { growth: 1.3, injury: 2.0, recovery: 0.8 },
    },
    individualFocusShare: 0.4, // 40%
  },
  development: {
    ageBaseGrowth: [
      { maxAge: 20, growth: 0.45 },
      { maxAge: 23, growth: 0.3 },
      { maxAge: 27, growth: 0.12 },
      { maxAge: 30, growth: 0.0 },
      { maxAge: 33, growth: -0.1 },
      { maxAge: 99, growth: -0.25 },
    ],
  },
  // Injuries (SPEC §12.5)
  injuries: {
    hazardBase: 0.00012, // per player per minute
    severityDistribution: {
      Minor: 0.55,
      Moderate: 0.35,
      Major: 0.1,
    },
  },
  // Discipline (SPEC §12.6)
  discipline: {
    yellowProbability: 0.16,
    directRedProbability: 0.006,
    yellowSuspensionCount: 5,
  },
} as const;
