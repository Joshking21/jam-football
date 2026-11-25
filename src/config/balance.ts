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
  // Training & Development (SPEC §12.3, §12.4, §12.18)
  training: {
    baseInjuryChancePerPlayer: 0.004,
    intensityFactors: {
      Light: { growth: 0.6, injury: 0.5, recovery: 1.2 },
      Normal: { growth: 1.0, injury: 1.0, recovery: 1.0 },
      Hard: { growth: 1.3, injury: 2.0, recovery: 0.8 },
    },
    individualFocusShare: 0.4, // 40%
    // SPEC §12.18 Detailed Training
    loadCond: 0.6,
    baselineLoad: 12,
    volumeBase: 0.6,
    volumePerSession: 0.05,
    workload: {
      Light: { growth: 0.8, injury: 0.6, condition: 3, rating: 0.0 },
      Normal: { growth: 1.0, injury: 1.0, condition: 0, rating: 0.0 },
      Heavy: { growth: 1.15, injury: 1.6, condition: -3, rating: 0.2 },
    },
    extraSessions: {
      growth: 1.15,
      fatigue: 4,
      injury: 1.3,
      rating: 0.2,
      skipChance: 0.3,
      skipMoralePenalty: -3,
    },
    mentoring: {
      maxPairs: 3,
      mentorMinAge: 28,
      menteeMaxAge: 21,
      moraleDriftPct: 0.2,
      menteeGrowthMult: 1.08,
      mentorGrowthMult: 0.9,
      lostPlacePenalty: -6,
    },
    oneToOne: {
      techniqueGrowthMult: 1.25,
      confidenceLowMorale: 6,
      confidenceNormalMorale: 2,
      confidenceRelaxedMult: 0.5,
      confidenceLeaderMult: 1.2,
      fitnessCondition: 6,
      fitnessFatigue: -4,
      videoContestsCtx: 0.05,
      favouriteWeeks: 3,
      favouriteMoralePenalty: -2,
    },
    ratings: {
      base: 6.4,
      profBonus: 0.6,
      ambBonus: 0.3,
      relPenalty: -0.4,
      tempStdDev: 1.0,
      normalStdDev: 0.6,
      highThreshold: 7.5,
      highGrowthMult: 1.05,
      highMoraleBonus: 1,
      lowThreshold: 5.5,
      lowGrowthMult: 0.95,
      wellNotPlayingWeeks: 3,
      wellNotPlayingStartsPct: 0.5,
      wellNotPlayingChance: 0.5,
    },
    physioOverload: {
      fatigueThreshold: 60,
      extraFatigueThreshold: 50,
    },
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
  // Injury Decisions (SPEC §12.19)
  injuryDecisions: {
    knockHazardMultiplier: 0.6,
    knockPhysioBasePct: 70,
    knockPhysioStarStep: 5, // 70 to 90
    knockPlayOnSkillPenalty: -0.3,
    knockPlayOnHazardMultiplier: 4.0,
    knockTakeOffConditionDelta: -10,
    rushCondition: 70,
    rushHazardMultiplier: 3.0,
    rushPhysioBase: 1.2,
    rushPhysioStarSlope: 0.08, // (1.2 - 0.08 * stars)
    rushSkillPenalty: -0.1,
    rushBreakdownMultiplier: 1.5,
    warmupScareBaseChance: 0.03,
    warmupScareFatigueThreshold: 50,
    warmupScareFatigueMultiplier: 2.0,
    warmupScarePhysioDiscount: 0.7, // 4-5 stars
    warmupScareStartHazardMultiplier: 2.5,
    warmupScareStartSkillPenalty: -0.1,
  },
  // Discipline (SPEC §12.6)
  discipline: {
    yellowProbability: 0.16,
    directRedProbability: 0.006,
    yellowSuspensionCount: 5,
  },
  // Discipline Decisions (SPEC §12.20)
  disciplineDecisions: {
    lateBaseChance: 0.015,
    latePersonalityMult: {
      Relaxed: 2.0,
      Professional: 0.2,
    } as Record<string, number>,
    lateLowMoraleThreshold: 30,
    lateLowMoraleMult: 2.0,
    lateExtraSessionsMult: 0.5,
    pressMouthChance: 0.3,
    bustUpCohesionThreshold: 45,
    bustUpChance: 0.1,
    repeatFineWeeks: 8,
    temperamentalTransferDemandChance: 0.3,
    repeatOffenceMultiplier: {
      warn: 1.5,
      let_go: 2.0,
    },
    repeatOffenceDurationWeeks: 4,
    consistencyRecordWeeks: 6,
    consistencyCohesionPenalty: -4,
    personalityMoraleMult: {
      Professional: 0.5,
      Temperamental: 1.5,
      Leader: 0.8,
    } as Record<string, number>,
  },
  // Assistant Coach Advice Engine (SPEC §15)
  assistant: {
    preMatchMaxAdvices: 3,
    preBackLinePaceThreshold: 65,
    preForwardPaceThreshold: 75,
    preOvrGapThreshold: 4,
    preCbHeadingThreshold: 72,
    weekFatigueThreshold: 80,
    weekFamiliarityThreshold: 50,
    weekTiredConditionThreshold: 70,
    weekTiredCountThreshold: 3,
    weekUnhappyMoraleThreshold: 45,
    weekProspectPotentialThreshold: 78,
    weekProspectMaxApps: 2,
    inMatchEvalIntervalMin: 5,
    inMatchWindowSec: 900, // 15 minutes
    inMatchMaxPerMatch: 6,
    inMatchRepeatCooldownMin: 20,
    inMatchFlankEntryShare: 0.5,
    inMatchFlankMinShots: 3,
    inMatchLowAvgCondition: 62,
    inMatchMinCrosses: 6,
    inMatchMaxCrossSuccess: 0.2,
    inMatchCbHeadingAdvantage: 5,
    inMatchMinOffsides: 2,
    inMatchTiredPlayerCondition: 58,
    inMatchYellowExtraFouls: 2,
    inMatchNeedGoalMinute: 70,
    inMatchSeeItOutMinute: 80,
    inMatchLowPossessionShare: 0.35,
    halfTimeWorstRatingThreshold: 6.4,
  },
  // Audio Engine & Settings (SPEC §17)
  audio: {
    // Crossfades & transitions (seconds)
    crossfadeDurationMusic: 1.5, // §17.2: Crossfades 1.5 s
    crossfadeDurationRoom: 0.6, // §17.5: crossfaded over 0.6 s
    dangerSmoothingSec: 1.5, // §17.3: smoothed over 1.5 s
    voiceFadeOutMs: 150, // §17.4: fade current line out over 150 ms
    voiceMaxDropAgeSimSec: 3.0, // §17.4: Drop lines older than 3 sim seconds
    chantIntervalMinSec: 60, // §17.3: random every 60-120 s
    chantIntervalMaxSec: 120,

    // Attenuation & gains (dB)
    menuMusicDb: -6, // §17.2: -6 dB
    roomAmbienceDb: -18, // §17.5: -18 dB
    duckingCrowdDb: -6, // §17.4: Duck crowd by -6 dB while voice plays
    duckingMusicDb: -10, // §17.4: Duck music by -10 dB while voice plays
    awayGoalDb: -8, // §17.3: away goals at -8 dB
    homeGoalDb: 0, // §17.3: home goals full
    homeAttackSwellDb: 3, // §17.3: crowd swells (+3 dB) on home attacks

    // Spatial panning
    panMax: 0.6, // §17.3: StereoPannerNode, ±0.6

    // Match pitch dimensions & third thresholds (pitch: 105 x 68)
    pitchLength: 105.0,
    pitchWidth: 68.0,
    defThirdMaxX: 35.0,
    midThirdMaxX: 70.0,
    boxMinX: 88.5,
    boxMinY: 13.84,
    boxMaxY: 54.16,

    // Procedural synthesis frequencies (Hz) and timings (seconds)
    synth: {
      whistleFreq1: 2600,
      whistleFreq2: 2850,
      whistleShortDuration: 0.22,
      whistleLongDuration: 0.75,
      kickPassFreqStart: 130,
      kickPassFreqEnd: 45,
      kickPassDuration: 0.09,
      kickShotFreqStart: 160,
      kickShotFreqEnd: 38,
      kickShotDuration: 0.14,
      postFreq1: 1250,
      postFreq2: 2450,
      postDuration: 0.55,
      netDuration: 0.22,
      headerDuration: 0.1,
      roarDuration: 2.8,
      groanDuration: 1.4,
      oohDuration: 1.1,
      booDuration: 1.5,
      crowdCalmCutoffHz: 500,
      crowdTenseCutoffHz: 2200,
    },
  },
  // Finances (SPEC §12.10)
  finances: {
    tvIncomeWeekly: 600_000,
    sponsorIncomeWeekly: {
      5: 800_000,
      4: 600_000,
      3: 400_000,
      2: 250_000,
    } as Record<number, number>,
    ticketPriceByReputation: {
      5: 45,
      4: 38,
      3: 32,
      2: 26,
    } as Record<number, number>,
    operatingCostPerReputation: 100_000,
    prizeMoney1st: 20_000_000,
    prizeMoneyStep: 2_000_000,
    attendanceBase: 0.55,
    attendanceFanMoodFactor: 0.4,
    attendanceDerbyBonus: 0.08,
    attendanceRep5Bonus: 0.04,
    attendanceNoiseRange: 0.06,
    attendanceMin: 0.4,
    attendanceMax: 1.0,
  },
  // Board Confidence (SPEC §12.7)
  board: {
    winBase: 3,
    winHigherRep: 5,
    drawHigherRep: 1,
    drawLowerRep: -1,
    lossBase: -3,
    lossLowerRep: -5,
    lossMargin3Extra: -2,
    matchday4TargetMet: 1,
    matchday4AcceptableExceeded: -1,
    matchday4AcceptablePlus3Extra: -2,
    wageOverBudgetPenalty: -2,
    balanceNegativePenalty: -4,
    warningThreshold: 25,
    sackingThreshold: 12,
    sackingMatchdayStart: 6,
    praiseThreshold: 80,
  },
  // Fans (SPEC §12.14)
  fans: {
    homeWin: 4,
    awayWin: 3,
    draw: -1,
    loss: -4,
    margin3Extra: 2,
    derbyMultiplier: 2,
    driftTarget: 60,
    driftStep: 1,
  },
  // Club Depth (SPEC §12.17)
  club: {
    staffWage: 1500, // per week * stars^2
    coachDevBase: 0.85,
    coachDevPerStar: 0.06,
    physioInjuryLenBase: 1.2,
    physioInjuryLenPerStar: 0.08,
    physioHazardBase: 1.1,
    physioHazardPerStar: 0.04,
    scoutKnowledgeBase: 0.6,
    scoutKnowledgePerStar: 0.15,
    prepBonusSetPieces: -0.12,
    prepBonusPress: 0.15,
    prepBonusWingers: -0.12,
    prepBonusShapeFamiliarity: 8,
    prepDevPenalty: 0.85,
    restConditionGain: 8,
    restFatigueReduction: 6,
    restConsecutiveWeeksMoralePenalty: -5,
    cohesionInitial: 55,
    cohesionWinBonus: 1,
    cohesionLossPenalty: -1,
    cohesionLeaderSoldPenalty: -8,
    cohesionPromiseBrokenPenalty: -5,
    cohesionSigningPenalty: -2,
    cohesionMaxWeeklyDelta: 6,
    cohesionMatchExecutionFactor: 0.001, // (cohesion - 50) / 1000
    injuryRiskLowThreshold: 1.2,
    injuryRiskMedThreshold: 1.6,
  },
  // Transfers (SPEC §12.13)
  transfers: {
    roundsPerWindow: 3,
    importanceTop3: 1.6,
    importanceRank4To11: 1.25,
    importanceDefault: 1.0,
    deadlineDayFactor: 1.1,
    buyerRepHigherFactor: 1.05,
    notForSaleRep5MinMultiplier: 2.5,
    bidAcceptThreshold: 1.0,
    bidCounterThreshold: 0.82,
    bidCounterMin: 0.95,
    bidCounterMax: 1.0,
    maxBidsPerPlayerPerRound: 2,
    loyalRefusalChance: 0.3,
    wageIncreaseBase: 1.15,
    wageIncreaseRoleDowngrade: 1.2,
    roleDiscountStar: 0.9,
    roleDiscountStarter: 0.95,
    maxSquadSize: 26,
    fanMoodSigningOvrDiff: 3,
    fanMoodSigningBonus: 5,
    fanMoodSellingPenalty: -8,
    aiBidChance: 0.15,
    aiBidListedMultiplier: 3,
    aiBidMinOffer: 0.85,
    aiBidMaxOffer: 1.15,
    aiBidAcceptMaxCounter: 1.25,
    aiMoveChance: 0.25,
    boardWageRequestBoost: 0.1, // +10%
    boardWageRequestMinConfidence: 60,
    boardWageRequestPenalty: -2,
  },
  // Scouting (SPEC §12.12)
  scouting: {
    attributeBandWidth: 12,
    ovrBandWidth: 8,
    maxScoutingPerRoundInWindow: 2,
    maxScoutingPerMatchdayOutside: 1,
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
    boxDribbleFoulChance: 0.08,
    lostAerialDuelChance: 0.1,
    pressingHazard: {
      High: 0.05,
      Mid: 0.028,
      Low: 0.01,
    },
    yellowPerFoul: 0.2,
    directRedPerFoul: 0.002,
  },
  // Home advantage z-boost (SPEC §13.4, §13a line 66)
  homeAdvantage: 0.1,
  // Base action utilities by zone (SPEC §13.6 and tuning)
  utilities: {
    inBox: {
      recycle: 0.9,
      progress: 1.4,
      dribble: 1.05,
      shot: 0.88,
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
      shot: 0.14,
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

  // Tactical Depth Constants (SPEC §13.17)
  roles: {
    sweeperKeeper: {
      oppThroughBallsCtx: -0.3,
      oppOneOnOneProbMult: 0.75,
      shortDistPassCtx: 0.2,
      oppOutsideCentralXgAdd: 0.02,
      oppThroughBallGkFoulRate: 0.03,
    },
    stopper: {
      asD_tkl: 0.35,
      asD_press: 0.25,
      asD_airD: 0.2,
      lostDuelOppThroughCtx: 0.3,
      foulsMult: 1.2,
    },
    coveringCb: {
      oppThroughBallsCtx: -0.25,
      asD_tkl: -0.15,
      asD_press: -0.2,
    },
    ballPlayingCb: {
      use_def_progress: 0.3,
      use_def_switch: 0.2,
      use_def_long: 0.1,
      asA_passCtx: 0.15,
      oppHighPressShotUtilityAdd: 0.3,
    },
    fbDefensive: {
      teamOppLaneDefCtx: -0.15,
      inv_att_to_def: 0.6,
      inv_mid_to_def: 0.15,
      use_cross: -0.3,
    },
    fbOverlapping: {
      inv_mid_to_att: 0.25,
      use_cross: 0.4,
      teamLaneCrossDelivery: 0.1,
      oppCounterLaneCtx: 0.25,
      fatigueMult: 1.08,
    },
    fbInverted: {
      inv_lane_to_c_mid: 0.4,
      teamMidPassCtx: 0.1,
      use_progress: 0.2,
      use_cross: -0.4,
      oppCounterLaneCtx: 0.2,
    },
    anchor: {
      inv_mid_to_def: 0.2,
      inv_att_to_mid: 0.5,
      oppAttCentreCtx: -0.15,
      use_recycle: 0.3,
      use_progress: -0.2,
      use_through: -0.2,
    },
    deepPlaymaker: {
      recvMultDefMid: 1.3,
      use_switch: 0.3,
      use_long: 0.2,
      use_through: 0.2,
      asA_passCtx: 0.1,
    },
    ballWinner: {
      asD_press: 0.4,
      asD_tkl: 0.3,
      foulsMult: 1.5,
      fatigueMult: 1.1,
      use_through: -0.2,
    },
    boxToBox: {
      inv_mid_to_att: 0.1,
      inv_mid_to_def: 0.1,
      asD_mid_press: 0.2,
      fatigueMult: 1.12,
    },
    playmaker: {
      recvMult: 1.25,
      use_through: 0.35,
      use_progress: 0.1,
      asA_passCtx: 0.1,
      asD_press: -0.2,
      asD_tkl: -0.1,
    },
    runner: {
      inv_mid_to_att_centre: 0.25,
      use_box_shot: 0.3,
      asR_throughRun: 0.2,
      oppMidProgressCtx: 0.1,
    },
    shadowStriker: {
      inv_mid_to_att: 0.3,
      use_attCentre_box_shot: 0.3,
      asR_throughRun: 0.2,
      asD_mid_press: -0.2,
      asD_mid_tkl: -0.2,
    },
    wmDefensive: {
      inv_att_to_mid: 0.3,
      inv_mid_to_def: 0.15,
      teamOppLaneDefCtx: -0.15,
      use_cross: -0.1,
      use_dribble: -0.1,
    },
    widePlaymaker: {
      inv_lane_to_c_mid: 0.25,
      use_through: 0.3,
      use_switch: 0.2,
      use_cross: -0.3,
    },
    winger: {
      inv_c_to_lane: 0.25,
      use_cross: 0.4,
      use_dribble: 0.2,
      use_shot: -0.2,
    },
    insideForward: {
      inv_lane_to_c_att: 0.3,
      use_att_shot: 0.4,
      use_att_dribble: 0.1,
      fbOverlapCrossDelivery: 0.15,
      use_cross: -0.5,
      noWidthCrossUtility: -0.3,
    },
    targetMan: {
      teamLongUtility: 0.2,
      asR_air: 0.35,
      crossHeaderTargetWeightMult: 1.4,
      knockdownPassCtx: 0.2,
      use_dribble: -0.3,
      asR_run: -0.2,
    },
    poacher: {
      inv_mid_to_att: 0.5,
      inv_lane_to_c_att: 0.2,
      use_box_shot: 0.3,
      asA_box_fin: 0.15,
      recvMultOutsideAtt: 0.5,
      pressDefThirdMult: 0.9,
    },
    pressingForward: {
      teamDefThirdPress: 0.2,
      oppDefPassCtx: -0.15,
      fatigueMult: 1.18,
      use_shot: -0.1,
    },
    falseNine: {
      inv_att_to_mid_centre: 0.35,
      recvMultMid: 1.2,
      use_through: 0.4,
      use_progress: 0.2,
      teamThroughRun: 0.25,
      crossHeaderTargetWeightMult: 0.5,
      teamCrossHeaderDuel: -0.15,
    },
    advancedForward: {
      recvMultThrough: 1.4,
      asR_run: 0.3,
      oneOnOneProbAdd: 0.05,
      offsideProbMult: 1.25,
      recvMultMid: 0.7,
    },
  },
  opp: {
    tightMark: {
      recvMult: 0.55,
      markerPressTklAdd: 0.3,
      oppThroughIntoZoneCtx: 0.14,
      markerFoulsMult: 1.2,
    },
    doubleUp: {
      targetDribbleCtx: -0.5,
      targetShotCrossCtx: -0.2,
      targetPassCtx: -0.1,
      oppOppositeLaneCtx: 0.2,
    },
    pressOnBall: {
      pressAdd: 0.4,
      targetPassCtx: -0.3,
      targetRecycleUtility: 0.3,
      nextStepProgress: 0.3,
      nextStepThrough: 0.2,
      fatigueMult: 1.05,
    },
    showInside: {
      crossUtility: -0.5,
      dribbleUtility: -0.2,
      shotUtilityAtt: 0.2,
    },
    showOutside: {
      shotUtility: -0.4,
      crossUtility: 0.2,
      dribbleUtility: 0.1,
    },
  },
  trans: {
    counterPress: {
      pressRegainBase: -1.15,
      pressRegainPressWeight: 0.8,
      pressRegainPassWeight: 0.6,
      failCounterDuration: 2,
      failCounterCtx: 0.2,
      fatigueMult: 1.05,
    },
    regroup: {
      firstStepRecycle: 0.3,
      nextStepsPassCtx: 0.22,
    },
    counter: {
      bonusTriggerChance: 0.22,
      executionCtx: -0.25,
      baselineTurnoverCounterChance: 0.08,
      attackingTurnoverCounterAdd: 0.05,
      veryAttackingTurnoverCounterAdd: 0.07,
    },
    keepIt: {
      firstStepsRecycle: 0.2,
      firstStepsPassCtx: 0.25,
    },
    distribution: {
      shortHighPressPassCtx: -0.4,
      longContestedChance: 0.45,
      wideFirstStepProgress: 0.2,
    },
  },
  setp: {
    cornersFor: {
      nearPost: {
        gkClaimAdd: -0.04,
        xG_ref: 0.13,
        deliveryCtx: -0.1,
      },
      farPost: {
        targetWeightMult: 1.5,
        headerDuel: 0.2,
        gkClaimAdd: 0.03,
      },
      short: {
        nextStepCrossUtility: 0.3,
      },
    },
    cornersAgainst: {
      zonal: {
        oppNearPostDeliveryCtx: -0.15,
        oppFarPostHeaderDuel: 0.1,
      },
      manMark: {
        oppHeaderDuel: -0.45,
        penaltyFoulRate: 0.005,
      },
    },
  },
  pi: {
    shootMore: { shotUtility: 0.35 },
    shootLess: { shotUtilityOutsideBox: -0.35, progressUtility: 0.15 },
    dribbleMore: { dribbleUtility: 0.35 },
    dribbleLess: { dribbleUtility: -0.35, recycleUtility: 0.15 },
    crossMore: { crossUtility: 0.4 },
    crossLess: { crossUtility: -0.4, progressUtility: 0.15 },
    getForward: {
      inv_mid_to_att: 0.2,
      inv_def_to_mid: 0.15,
      oppCounterZoneCtx: 0.15,
      fatigueMult: 1.06,
    },
    holdPosition: {
      mainThirdWeightRetain: 0.5,
      recvMultOutsideThird: 0.9,
    },
    stayWider: {
      inv_c_to_lane: 0.25,
      teamMidCentreRecycleCtx: -0.05,
    },
    closeDownMore: {
      asD_press: 0.3,
      fatigueMult: 1.08,
      oppNextStepProgress: 0.2,
    },
    stayOnFeet: { foulsMult: 0.5, asD_tkl: -0.25 },
    longThrows: { minStrength: 70, extraSeconds: 6, gkClaimAdd: 0.04 },
  },
  // SPEC 1.4 Depth Pass 2 (SPEC §13.18)
  d2: {
    mentality: {
      veryStepMultiplier: 1.6,
      veryAttackingInvShift: 0.15,
      veryAttackingOppCounterCtx: 0.1,
      veryAttackingFatigueMult: 1.04,
      veryDefensiveInvShift: 0.15,
      veryDefensiveShotUtil: -0.1,
    },
    finalThird: {
      workIntoBox: {
        shotUtilOutsideBox: -0.2,
        attProgressUtil: 0.2,
        attDribbleUtil: 0.1,
        attInBoxPassUtil: 0.2,
        attPassCtx: 0.0,
        inBoxXGMult: 1.18,
      },
      shootOnSight: {
        shotUtilOutsideBox: 0.24,
        midCentreShotUtil: 0.12,
        shotUtilInBox: 0.08,
        xGMult: 0.74,
        blockedShotDefPossessionChance: 0.65,
      },
    },
    crossStyle: {
      low: {
        groundChanceRatio: 0.35,
        groundBoxCentralRatio: 0.7,
        groundPaceWeight: 0.5,
        groundOffTheBallWeight: 0.5,
        gkClaimAdd: -0.04,
        blockChance: 0.04,
        blockCornerRatio: 0.4,
        headerShotRatio: 0.85,
      },
      whipped: {
        headerXGRef: 0.13,
        onTargetAdd: 0.05,
        deliveryCtx: -0.15,
      },
      floated: {
        deliveryCtx: 0.15,
        headerSkillMult: 1.3,
        gkClaimAdd: 0.04,
        headerShotRatio: 0.6,
      },
    },
    offsideTrap: {
      failedThroughOffsideProbAdd: 0.12,
      failedThroughOffsideCap: 0.7,
      oppLongBallAttOffsideChance: 0.06,
      beatenTrapOneOnOneAdd: 0.07,
    },
    tackling: {
      getStuckIn: {
        sTklAdd: 0.25,
        foulsMult: 1.25,
        yellowPerFoulMult: 1.2,
      },
      stayOnFeet: {
        foulsMult: 0.85,
        sTklAdd: -0.2,
      },
    },
    forceOpp: {
      inside: {
        oppWideCrossUtil: -0.3,
        oppWideShotAttUtil: 0.15,
      },
      outside: {
        oppWideShotUtil: -0.25,
        oppWideCrossUtil: 0.2,
      },
    },
    timeWasting: {
      minMinute: 70,
      restartDurationMult: 1.4,
      recycleUtilAdd: 0.2,
      stoppageExtraRatio: 0.5,
      yellowRiskPerRestart: 0.02,
      oppAttackingCtxAdd85: 0.1,
    },
    setPieces: {
      freeKicks: {
        shootDirectChance: 0.85,
        crossChance: 0.85,
        shortNextStepProgress: 0.3,
      },
      cornerSwing: {
        inswinger: {
          headerDuelAdd: 0.1,
          sixYardHeaderRatio: 0.15,
          gkClaimAdd: 0.03,
        },
        outswinger: {
          gkClaimAdd: -0.03,
          secondBallAttackerChance: 0.55,
          headerDuelAdd: -0.05,
        },
      },
      menBack: {
        1: {
          headerTargetWeightMult: 1.15,
          headerDuelAdd: 0.22,
          clearanceCounterChance: 0.28,
        },
        2: {
          headerTargetWeightMult: 1.0,
          headerDuelAdd: 0.0,
          clearanceCounterChance: 0.18,
        },
        3: {
          headerTargetWeightMult: 0.85,
          headerDuelAdd: -0.22,
          clearanceCounterChance: 0.12,
        },
      },
      postMen: {
        none: {
          nearPostXGRefAdd: 0.0,
          headerGoalMult: 1.0,
          secondBallAttackerChance: 0.4,
        },
        near: {
          nearPostXGRefAdd: -0.03,
          headerGoalMult: 1.0,
          secondBallAttackerChance: 0.5,
        },
        both: {
          nearPostXGRefAdd: 0.0,
          headerGoalMult: 0.85,
          secondBallAttackerChance: 0.55,
        },
      },
    },
    pi: {
      roam: {
        spreadWeightRatio: 0.25,
        recvMult: 1.15,
        slotPressPenalty: -0.15,
      },
      sitNarrower: {
        laneToCRatio: 0.25,
        crossUtilAdd: -0.3,
        oppLaneCtxAdd: 0.1,
      },
      crossFromByline: {
        deliveryCtxAdd: 0.1,
        cutBackChance: 0.3,
      },
      crossFromDeep: {
        midWideCrossUtilAdd: 0.4,
        deliveryCtxAdd: -0.2,
        gkClaimAdd: 0.03,
      },
      riskyPasses: {
        throughUtilAdd: 0.3,
        progressUtilAdd: 0.1,
        passCtxAdd: -0.15,
      },
      playSafe: {
        recycleUtilAdd: 0.3,
        passCtxAdd: 0.15,
        throughUtilAdd: -0.3,
      },
    },
    familiarity: {
      threshold: 70,
      divisor: 350,
      maxPenalty: -0.26,
      weeklyMatchGain: 6,
      tacticalTrainingGain: 6,
      weeklyDecay: 2,
      decayFloor: 40,
      startingClubStyle: 90,
      startingClose: 65,
      startingOther: 45,
      startingFormationOther: 40,
    },
  },
  // SPEC 1.5 Attacking and Defensive Roles (SPEC §13.19)
  droles: {
    gk_line: {},
    gk_sweep: {
      oppThroughBallsCtx: -0.3,
      oppOneOnOneMult: 0.75,
      oppOutsideCentralXGRefAdd: 0.04,
      oppThroughFoulChance: 0.04,
    },
    cb_hold: {},
    cb_step: {
      asD_tkl: 0.35,
      asD_press: 0.25,
      asD_airD: 0.2,
      beatenNextStepThroughCtx: 0.3,
      foulsMult: 1.2,
    },
    cb_cover: {
      teamOppThroughBallsCtx: -0.25,
      asD_tkl: -0.15,
      asD_press: -0.2,
    },
    fb_track: {},
    fb_press: {
      asD_midLanePress: 0.3,
      beatenNextStepThroughCtx: 0.25,
    },
    fb_tuck: {
      oppDefCentreCtx: -0.1,
      oppDefLaneCtx: 0.15,
      oppLaneCrossUtil: 0.2,
    },
    dm_screen: {},
    dm_win: {
      asD_press: 0.4,
      asD_tkl: 0.3,
      foulsMult: 1.5,
      fatigueMult: 1.1,
    },
    dm_drop: {
      oppThroughBallsCtx: -0.65,
      oppBoxHeaderDuel: -0.05,
      oppMidCentreCtx: 0.15,
      oppAttCentreShotUtil: 0.14,
    },
    cm_hold: {},
    cm_press: {
      asD_midPress: 0.3,
      fatigueMult: 1.08,
      beatenNextStepProgress: 0.2,
    },
    cm_track: {
      oppBoxThroughRunCtx: -0.15,
      fatigueMult: 1.05,
      oppMidCentreCtx: 0.1,
    },
    am_screen: {},
    am_press: {
      asD_oppHoldingPress: 0.3,
      fatigueMult: 1.08,
      oppProgressPastHim: 0.15,
    },
    w_track: {},
    w_press: {
      asD_oppFbPress: 0.3,
      fatigueMult: 1.08,
      oppDefLaneCtx: 0.1,
    },
    w_high: {
      counterTriggerBonus: 0.016,
      firstStepThrough: 0.2,
      oppDefLaneCtx: 0.2,
    },
    st_central: {},
    st_press: {
      teamOppDefPress: 0.52,
      oppDefPassCtx: -0.28,
      fatigueMult: 1.15,
    },
    st_shoulder: {
      asR_longThroughRun: 0.2,
      oppDefRecycleCtx: 0.2,
    },
  },
  dpi: {
    closeDownMore: {
      asD_press: 0.3,
      fatigueMult: 1.08,
      oppNextStepProgress: 0.2,
    },
    standOff: {
      oppThroughBallsInZoneCtx: -0.1,
      oppPassDribbleCtx: 0.15,
    },
    tackleHarder: {
      asD_tkl: 0.25,
      foulsMult: 1.35,
      yellowChanceMult: 1.2,
    },
    stayOnFeet: {
      foulsMult: 0.5,
      asD_tkl: -0.25,
    },
    markTighter: {
      oppRecvMult: 0.85,
      oppThroughPastHimCtx: 0.15,
    },
    trackRuns: {
      oppRunMinus: -0.2,
      fatigueMult: 1.05,
      oppZoneActionsCtx: 0.1,
    },
  },
  // SPEC §12.18 Detailed Training Constants (K.train)
  train: {
    loadCond: 0.6,
    baselineLoad: 12,
    volumeBase: 0.6,
    volumePerSession: 0.05,
    workload: {
      Light: { growth: 0.8, injury: 0.6, condition: 3, rating: 0.0 },
      Normal: { growth: 1.0, injury: 1.0, condition: 0, rating: 0.0 },
      Heavy: { growth: 1.15, injury: 1.6, condition: -3, rating: 0.2 },
    },
    extraSessions: {
      growth: 1.15,
      fatigue: 4,
      injury: 1.3,
      rating: 0.2,
      skipChance: 0.3,
      skipMoralePenalty: -3,
    },
    mentoring: {
      maxPairs: 3,
      mentorMinAge: 28,
      menteeMaxAge: 21,
      moraleDriftPct: 0.2,
      menteeGrowthMult: 1.08,
      mentorGrowthMult: 0.9,
      lostPlacePenalty: -6,
    },
    oneToOne: {
      techniqueGrowthMult: 1.25,
      confidenceLowMorale: 6,
      confidenceNormalMorale: 2,
      confidenceRelaxedMult: 0.5,
      confidenceLeaderMult: 1.2,
      fitnessCondition: 6,
      fitnessFatigue: -4,
      videoContestsCtx: 0.05,
      favouriteWeeks: 3,
      favouriteMoralePenalty: -2,
    },
    ratings: {
      base: 6.4,
      profBonus: 0.6,
      ambBonus: 0.3,
      relPenalty: -0.4,
      tempStdDev: 1.0,
      normalStdDev: 0.6,
      highThreshold: 7.5,
      highGrowthMult: 1.05,
      highMoraleBonus: 1,
      lowThreshold: 5.5,
      lowGrowthMult: 0.95,
      wellNotPlayingWeeks: 3,
      wellNotPlayingStartsPct: 0.5,
      wellNotPlayingChance: 0.5,
    },
  },
  // SPEC §13.20 Detailed Set Pieces Constants (K.sp)
  sp: {
    jobs: {
      nearPost: {
        max: 2,
        targetMatchWeightMult: 2.0,
      },
      farPost: {
        max: 2,
        targetMatchWeightMult: 2.0,
      },
      penaltySpot: {
        max: 2,
        targetMatchWeightMult: 2.0,
        boxCentralRatio: 0.3,
        headerDuelAdd: -0.05,
        onTargetAdd: 0.03,
      },
      keeperScreen: {
        max: 1,
        gkClaimAdd: -0.04,
        headerWeightMult: 0.3,
      },
      edge: {
        max: 2,
        secondBallChances: {
          0: 0.25,
          1: 0.4,
          2: 0.5,
        },
        shotUtilityAdd: 0.3,
      },
      short: {
        max: 1,
      },
      stayBack: {
        min: 1,
        max: 3,
        default: 2,
      },
    },
    predictability: {
      duelPerUse: 0.04,
      duelCap: 0.12,
    },
    sharpness: {
      baselineFamiliarity: 70,
      newRoutineFamiliarity: 40,
      deliveryCtxDivisor: 300,
      deliveryCtxCap: 0.1,
      practiceWeeklyGainTotal: 15,
      unpractisedWeeklyLoss: 5,
      familiarityFloor: 40,
      familiarityCeiling: 100,
    },
    swing: {
      forcedPenaltyDeliveryCtx: -0.08,
      inswinger: {
        headerDuelAdd: 0.1,
        sixYardHeaderRatio: 0.15,
        gkClaimAdd: 0.03,
      },
      outswinger: {
        gkClaimAdd: -0.03,
        secondBallAttackerChance: 0.55,
        headerDuelAdd: -0.05,
      },
    },
    freeKicks: {
      central: {
        dummy: {
          xgRefAdd: 0.02,
          wallBlockAdd: -0.05,
          mistimedRecycleChance: 0.2,
        },
        shootDirectChance: 0.85,
        shortNextStepProgress: 0.3,
      },
      deep: {
        quick: {
          nextStepProgress: 0.3,
          rushedLostChance: 0.15,
        },
        long: {
          deliveryCtx: -0.2,
        },
      },
    },
    defendingCorners: {
      edgeGuard: {
        secondBallReduction: 0.1, // -10 points
        longRangeXGRefReduction: 0.02,
        oppHeaderDuelAdd: 0.04,
      },
      forwardsUp: {
        0: {
          oppHeaderDuelAdd: -0.05,
          clearanceCounterChance: 0.0,
        },
        1: {
          oppHeaderDuelAdd: 0.0,
          clearanceCounterChance: 0.18,
        },
        2: {
          oppHeaderDuelAdd: 0.06,
          clearanceCounterChance: 0.35,
        },
      },
      manMarkDuelMod: -0.15,
      zonalFarPostDuelAdd: 0.1,
      zonalNearPostDeliveryCtx: -0.15,
    },
    defendingFreeKicks: {
      wall: {
        auto: {
          blockProb: 0.2,
          xgRefAdd: 0.0,
          oppCrossHeaderDuelAdd: 0.0,
        },
        small: {
          blockProb: 0.12,
          xgRefAdd: 0.01,
          oppCrossHeaderDuelAdd: -0.05,
        },
        big: {
          blockProb: 0.26,
          xgRefAdd: 0.0,
          oppCrossHeaderDuelAdd: 0.05,
        },
        wallZBonusFactor: 0.02, // +0.02 * mean z(heading, strength)
      },
      lineHeight: {
        high: {
          offsideChance: 0.2,
          headerXGRefAdd: 0.03,
        },
        normal: {
          offsideChance: 0.0,
          headerXGRefAdd: 0.0,
        },
        deep: {
          gkClaimAdd: 0.04,
          secondBallAttackerBonus: 0.1,
        },
      },
    },
    assistant: {
      readNearPostThresholdUses: 3,
      readNearPostLostHeaders: 2,
      dropForwardBackLostHeaders: 3,
      dropForwardBackMinutes: 20,
    },
  },
  shouts: {
    durationT: 600, // 10 match minutes (§13.21)
    cooldownT: 900, // 15 match minutes for half-effect
    delayT: 10, // takes effect 10s after issuedAtT
    pushForward: {
      fatigueDrainMult: 1.1,
      oppCounterBonus: 0.2,
    },
    keepTight: {
      oppShotCtxMod: -0.04,
      ourShotUtilMod: -0.2,
    },
    getStuckIn: {
      tackleCtxMod: 0.1,
      foulMult: 1.4,
      temperamentalCardMult: 1.3,
    },
    calmDown: {
      foulMult: 0.7,
      temperamentalCardMult: 0.7,
      tackleCtxMod: -0.05,
    },
    concentrate: {
      oppShotCtxMod: -0.03,
      passCtxMod: 0.02,
      minMinute: 75,
      concedeWindowSeconds: 300, // within 5' of conceding
      maxPerHalf: 1,
    },
    encourage: {
      focusBoost: 0.02,
      minRatingForMorale: 7.0,
      winningBy2FocusBoost: -0.01,
    },
    demandMore: {
      focusBoost: 0.03,
      ambitiousLeaderMult: 1.3,
      relaxedMult: 0.5,
      temperamentalFlipChance: 0.4,
      temperamentalFlipFocusBoost: -0.02,
      winningMoraleDelta: -1,
    },
    ai: {
      minClubReputation: 3,
      pushForwardMinMinute: 75,
      keepTightMinMinute: 80,
    },
  },
  matchPlans: {
    maxRules: 4,
    askMeFirstTimeoutSeconds: 6,
  },
  traits: {
    worldGen: {
      baseChance: 0.1, // spec formula base 0.08 gave 50% with ≥1 trait; 0.10 lands in the 55–65% target
      bonusSlope: 0.25,
      divisor: 20,
      maxTraits: 3,
    },
    clashes: {
      moraleWeeklyPenalty: -1,
      memoWeeks: 3,
      matchingRoleGainBonus: 0.05,
    },
    learning: {
      baseProgress: 8,
      youthBonus: 4, // age <= 23
      veteranPenalty: -3, // age >= 30
      decisionsBonus: 2, // decisions >= 70
      completionThreshold: 100,
      devFactorMult: 0.8,
    },
    cutsInside: {
      attCenterInvShift: 0.2,
      wideShotUtilMod: 0.2,
      crossesMult: 0.6,
      minDribbling: 60,
    },
    shootsFromDistance: {
      outsideShotUtilMod: 0.3,
      minLongShots: 60,
    },
    getsForward: {
      defToAttInvShift: 0.1,
      theirCounterShotCtxMod: 0.05,
      minStamina: 60,
    },
    staysBack: {
      attToDefInvShift: 0.15,
      theirCounterCtxMod: -0.04,
    },
    playsOneTwos: {
      returnRecvMult: 1.4,
      passCtxMod: 0.05,
      dribbleUtilMod: -0.2,
      minPassing: 60,
    },
    killerBalls: {
      throughUtilMod: 0.3,
      interceptionMult: 1.15,
      minPassing: 65,
    },
    runsWithBall: {
      midDribbleUtilMod: 0.25,
      midBallLostMult: 1.1,
      minDribbling: 60,
    },
    arrivesLate: {
      cutbackBoxCentralRecvMult: 1.3,
      defCoverMod: -0.1,
      minOffTheBall: 60,
    },
    holdsUp: {
      longFirstTouchMod: 0.15,
      nextStepRecycleMod: 0.2,
      throughRecvMult: 0.8,
      minStrength: 65,
    },
    comesDeep: {
      attToMidInvShift: 0.15,
      boxRecvMult: 0.85,
    },
    attacksAir: {
      sAirMod: 0.1,
      aerialFoulsMult: 1.2,
      minHeading: 65,
    },
    divesIn: {
      sTklMod: 0.15,
      foulsMult: 1.4,
    },
  },
};

export const RENDER_CONFIG = {
  timeSlots: {
    night: {
      skyTop: '#03060D',
      skyHorizon: '#0D1830',
      hasStars: true,
      starCount: 600,
      hemisphere: { sky: '#1C2C4D', ground: '#142012', intensity: 1.15 },
      keyLight: { color: '#FFF0DA', intensity: 1.0 },
      floodlightMult: 1.0,
      beams: { enabled: true, opacityMult: 1.0 },
      envMapIntensity: 0.5,
      hazeDensity: 0.003,
    },
    evening: {
      skyTop: '#0D1A33',
      skyHorizon: '#4A3C33',
      hasStars: false,
      starCount: 0,
      hemisphere: { sky: '#33466E', ground: '#14200F', intensity: 1.1 },
      keyLight: { color: '#FFF0DA', intensity: 0.85 },
      floodlightMult: 0.85,
      beams: { enabled: true, opacityMult: 0.6 },
      envMapIntensity: 0.6,
      hazeDensity: 0.0028,
    },
    afternoon: {
      skyTop: '#5E8DC2',
      skyHorizon: '#C7D6E4',
      hasStars: false,
      starCount: 0,
      hemisphere: { sky: '#9DB7D9', ground: '#3A4A2A', intensity: 1.6 },
      keyLight: { color: '#FFF4E0', intensity: 2.5, elevation: 38 },
      floodlightMult: 0.0,
      beams: { enabled: false, opacityMult: 0 },
      envMapIntensity: 0.8,
      hazeDensity: 0.0018,
    },
  },
  floodlights: {
    color: '#FFF0DA',
    candela: 13500,
    decay: 2,
    emissiveIntensity: 6.0,
    targetInsetX: 20,
    targetInsetZ: 20,
  },
  grade: {
    night: {
      lift: [0.0, 0.004, 0.014] as [number, number, number],
      gamma: 1.0,
      gain: [1.02, 1.0, 0.97] as [number, number, number],
      saturation: 1.06,
      contrast: 1.08,
      vignetteStrength: 0.22,
      vignetteSoftness: 0.45,
    },
    afternoon: {
      lift: [0, 0, 0.006] as [number, number, number],
      gamma: 1.0,
      gain: [1.01, 1.0, 0.99] as [number, number, number],
      saturation: 1.03,
      contrast: 1.05,
      vignetteStrength: 0.15,
      vignetteSoftness: 0.5,
    },
  },
  pitch: {
    length: 115,
    width: 78,
    playLength: 105,
    playWidth: 68,
    grassAlbedo: '#3E6B2F',
    stripeContrast: 0.06,
    stripeCount: 12,
    linePaint: '#F2F2EC',
    lineRoughness: 0.8,
    wetRoughness: 0.55,
    dryRoughness: 0.92,
    wetAlbedoMult: 0.82,
  },
  skinTones: ['#F1D3BC', '#E0B18F', '#C68B63', '#A0694A', '#7A4B33', '#4E3022'],
  hairColors: ['#1A1410', '#3B2A1E', '#6A4A30', '#A07A4C', '#C9A46A', '#7A3B1E'],
  quality: {
    Low: {
      pixelRatio: 1,
      shadows: false,
      msaa: false,
      bloom: false,
      haze: false,
      lineRes: 2048,
    },
    Medium: {
      pixelRatio: 1.5,
      shadows: true,
      shadowMapSize: 1024,
      msaa: true,
      bloom: true,
      haze: true,
      lineRes: 4096,
    },
    High: {
      pixelRatio: 2,
      shadows: true,
      shadowMapSize: 2048,
      msaa: true,
      bloom: true,
      haze: true,
      lineRes: 4096,
    },
  },
};

(BALANCE as Record<string, unknown>).render = RENDER_CONFIG;

(BALANCE as Record<string, unknown>).tacticsDepth = {
  roles: K.roles,
  opp: K.opp,
  trans: K.trans,
  setp: K.setp,
  sp: K.sp,
  pi: K.pi,
  d2: K.d2,
  droles: K.droles,
  dpi: K.dpi,
};

(BALANCE as Record<string, unknown>).setPieces = K.sp;
(BALANCE as Record<string, unknown>).sp = K.sp;
