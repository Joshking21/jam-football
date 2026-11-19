// Implements SPEC §6, §12, §13 balance numbers (all gameplay constants with units)

export const BALANCE = {
  // Condition & Fatigue (SPEC §12.1, §12.2)
  condition: {
    drainPerMinuteBase: 0.22, // points per minute
    staminaDivisor: 200,
    staminaBaseFactor: 1.25,
    pressingFactors: {
      High: 1.22,
      Mid: 1.0,
      Low: 0.86,
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

// SPEC §13.7, §13.8, §13.16 Calibration Constants (K.*)
export const K = {
  // Pass base logit intercepts (tuned for ~80-84% pass completion)
  passBase: {
    recycle: 2.1,
    progress: 1.6,
    switch: 1.4,
    inBoxPass: 0.9,
  },
  // Base skill and contest coefficients (tuned for strength response §13.16)
  coefficients: {
    passSkill: 0.6,
    passReceiverFirstTouch: 0.25,
    passDefenderPress: 0.55,
    dribbleSkill: 0.6,
    dribbleTackle: 0.6,
    dribblePaceDiff: 0.25,
    throughBallPasser: 0.55,
    throughBallRunner: 0.4,
    throughBallCover: 0.55,
    shotFinishing: 0.28,
    shotGoalkeeper: 0.28,
    shotCover: -0.15,
  },
  // Contest intercepts
  intercepts: {
    dribble: 0.15,
    throughBall: -0.35,
    longBallDelivery: 0.55,
    longBallAerial: -0.3,
    crossDelivery: -0.3,
    crossHeader: -0.15,
    gkClaimBase: 0.14,
    gkClaimSlope: 0.06,
  },
  // Durations (seconds)
  durations: {
    recycle: [4, 7] as const,
    progress: [5, 9] as const,
    long: [4, 6] as const,
    switch: [4, 7] as const,
    dribble: [4, 7] as const,
    through: [4, 6] as const,
    cross: [4, 6] as const,
    shot: [2, 3] as const,
    throwIn: 10,
    goalKick: 18,
    corner: 24,
    freeKick: 20,
    goal: 45,
    injury: 35,
    substitution: 25,
    offside: 16,
  },
  // Fouls and cards
  fouls: {
    failedDribbleChance: 0.25,
    boxDribbleFoulChance: 0.05,
    lostAerialDuelChance: 0.1,
    pressingHazard: {
      High: 0.05,
      Mid: 0.028,
      Low: 0.01,
    },
    yellowPerFoul: 0.2,
    directRedPerFoul: 0.002,
  },
  // Home advantage z-boost (SPEC §13.4)
  homeAdvantage: 0.08,
  // Base action utilities by zone (SPEC §13.6 and tuning)
  utilities: {
    inBox: {
      recycle: 0.9,
      progress: 1.4,
      dribble: 1.05,
      shot: 0.9,
    },
    def: {
      recycle: 1.4,
      progress: 1.2,
      long: 0.6,
      switch: 0.5,
      dribble: 0.4,
      clear: 0.2,
    },
    midCentre: {
      recycle: 1.4,
      progress: 1.15,
      long: 0.5,
      switch: 0.65,
      dribble: 0.65,
      through: 0.4,
      shot: 0.02,
    },
    midWide: {
      recycle: 1.3,
      progress: 1.15,
      long: 0.5,
      switch: 0.65,
      dribble: 0.65,
      through: 0.35,
      cross: 0.3,
    },
    attCentre: {
      recycle: 1.35,
      progress: 1.05,
      switch: 0.6,
      dribble: 0.85,
      through: 0.55,
      shot: 0.15,
    },
    attWide: {
      recycle: 1.2,
      progress: 1.05,
      switch: 0.6,
      dribble: 0.85,
      through: 0.35,
      cross: 1.35,
      shot: 0.02,
    },
  },
  // Action utility weights
  softmaxTau: 0.35,
};
