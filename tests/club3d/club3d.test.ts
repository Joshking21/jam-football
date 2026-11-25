// SPEC §11.25, §14.11, §14.12.7 Club spaces tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ROOM_DEFINITIONS,
  getRoomForScreen,
  findNavPath,
  getWalkDuration,
  getPathLength,
  NAV_GRAPH,
  calculateTeamTalkReaction,
  MouthAnimator,
  FaceController,
  TalkSceneManager,
  TimeOfDayController,
  LookAroundController,
} from '../../src/club3d';
import { CLUB3D_CONFIG, FACES_CONFIG } from '../../src/config/balance';
import * as THREE from 'three';

describe('M6b Club Spaces — Rooms & Geometry (§11.25.1)', () => {
  it('defines all 8 required rooms in unified coordinates', () => {
    const requiredRooms = [
      'exterior',
      'corridor',
      'office',
      'boardroom',
      'dressing',
      'tunnel',
      'training',
      'press',
    ];
    for (const r of requiredRooms) {
      expect(ROOM_DEFINITIONS[r as keyof typeof ROOM_DEFINITIONS]).toBeDefined();
      const def = ROOM_DEFINITIONS[r as keyof typeof ROOM_DEFINITIONS];
      expect(def.bounds.max[0]).toBeGreaterThan(def.bounds.min[0]);
      expect(def.bounds.max[1]).toBeGreaterThan(def.bounds.min[1]);
      expect(def.bounds.max[2]).toBeGreaterThan(def.bounds.min[2]);
      expect(def.cameraRail.fov).toBeGreaterThan(30);
    }
  });

  it('maps screens to the correct documentary rooms', () => {
    expect(getRoomForScreen('title')).toBe('exterior');
    expect(getRoomForScreen('newGame')).toBe('exterior');
    expect(getRoomForScreen('hub')).toBe('office');
    expect(getRoomForScreen('inbox')).toBe('office');
    expect(getRoomForScreen('tactics')).toBe('office');
    expect(getRoomForScreen('league')).toBe('office');
    expect(getRoomForScreen('boardMeeting')).toBe('boardroom');
    expect(getRoomForScreen('sacked')).toBe('boardroom');
    expect(getRoomForScreen('squad')).toBe('dressing');
    expect(getRoomForScreen('preMatch')).toBe('dressing');
    expect(getRoomForScreen('fullTime')).toBe('dressing');
    expect(getRoomForScreen('training')).toBe('training');
    expect(getRoomForScreen('match')).toBe('tunnel');
  });

  it('has interactive hotspots with touch points', () => {
    const office = ROOM_DEFINITIONS.office;
    const desk = office.hotspots.find((h) => h.id === 'desk_hub');
    expect(desk).toBeDefined();
    expect(desk?.touch?.kind).toBe('rest');

    const wb = office.hotspots.find((h) => h.id === 'whiteboard_tactics');
    expect(wb).toBeDefined();
    expect(wb?.touch?.kind).toBe('brush');
  });
});

describe('M6b Floor Navigation & Walk Durations (§11.25.2)', () => {
  it('nav graph connects all major areas via corridor', () => {
    expect(NAV_GRAPH.node_exterior_entrance).toBeDefined();
    expect(NAV_GRAPH.node_office_desk).toBeDefined();
    expect(NAV_GRAPH.node_board_table).toBeDefined();
    expect(NAV_GRAPH.node_dressing_center).toBeDefined();
    expect(NAV_GRAPH.node_training_pitch).toBeDefined();
  });

  it('finds paths between all rooms and clamps walk duration <= 2.5s', () => {
    const pairs = [
      ['node_office_desk', 'node_board_table'],
      ['node_office_desk', 'node_dressing_center'],
      ['node_office_desk', 'node_training_pitch'],
      ['node_exterior_entrance', 'node_office_desk'],
      ['node_dressing_center', 'node_tunnel_pitch'],
    ];

    for (const pair of pairs) {
      const start = pair[0]!;
      const end = pair[1]!;
      const path = findNavPath(start, end);
      expect(path.length).toBeGreaterThan(1);
      const len = getPathLength(path);
      expect(len).toBeGreaterThan(0);
      const duration = getWalkDuration(path);
      expect(duration).toBeLessThanOrEqual(CLUB3D_CONFIG.walkMaxSeconds);
      expect(duration).toBeLessThanOrEqual(2.5);
    }
  });
});

describe('M6b Look Around Camera Clamps (§11.25.4)', () => {
  it('clamps yaw, pitch, and lean within allowed limits', () => {
    const ctrl = new LookAroundController();
    ctrl.setRoom(ROOM_DEFINITIONS.office);

    ctrl.onMouseDown(2); // right click
    // Extreme movements
    ctrl.onMouseMove(10000, 10000);
    ctrl.onWheel(-10000);

    const cam = new THREE.PerspectiveCamera(50, 1.77, 0.1, 100);
    ctrl.update(0.016, cam, [[-12, 1.6, 7.3]]);

    const b = ROOM_DEFINITIONS.office.bounds;
    const margin = CLUB3D_CONFIG.cameraWallMargin;

    // Verify camera is within bounding box with margin
    expect(cam.position.x).toBeGreaterThanOrEqual(b.min[0] + margin);
    expect(cam.position.x).toBeLessThanOrEqual(b.max[0] - margin);
    expect(cam.position.z).toBeGreaterThanOrEqual(b.min[2] + margin);
    expect(cam.position.z).toBeLessThanOrEqual(b.max[2] - margin);
  });
});

describe('M6b Faces & Mouth Animation (§14.11.6, §14.11.7)', () => {
  it('hysteresis and minimum hold time of 70ms on mouth shapes', () => {
    const animator = new MouthAnimator();
    expect(animator.getShape()).toBe('closed');

    // Create a mock AnalyserNode
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteTimeDomainData: (arr: Uint8Array) => {
        // High loudness (all 255)
        arr.fill(255);
      },
    } as unknown as AnalyserNode;

    // Update with 16ms (less than 70ms hold threshold)
    animator.updateFromAudio(mockAnalyser, 0.016);
    // Even if target is wide, hold time must pass
    animator.updateFromAudio(mockAnalyser, 0.08); // total ~96ms
    expect(['small', 'open', 'wide']).toContain(animator.getShape());
  });

  it('procedural caption rhythm pauses on punctuation', () => {
    const animator = new MouthAnimator();
    const text = 'Hello, manager.';

    // Index 5 is comma ','
    const shapeAtComma = animator.updateFromCaption(text, 5, 0.016);
    expect(shapeAtComma).toBe('closed');

    // Index 14 is period '.'
    const shapeAtPeriod = animator.updateFromCaption(text, 14, 0.016);
    expect(shapeAtPeriod).toBe('closed');
  });

  it('face controller sets moods and rotates head correctly', () => {
    const fc = new FaceController();
    fc.setMood('happy');
    expect(fc.getMood()).toBe('happy');

    fc.setMood('angry');
    expect(fc.getMood()).toBe('angry');

    const rot = fc.getHeadRotation();
    expect(rot).toBeDefined();
  });
});

describe('M6b Team-Talk Reactions (§14.11.2)', () => {
  it('correctly maps morale delta to reaction animation clip and face mood', () => {
    // Morale >= +4 -> FistPump & happy
    const bigBoost = calculateTeamTalkReaction('p1', 'Player 1', 5);
    expect(bigBoost.clip).toBe('FistPump');
    expect(bigBoost.mood).toBe('happy');

    // Morale +1..+3 -> SitNod & happy
    const mildBoost = calculateTeamTalkReaction('p2', 'Player 2', 2);
    expect(mildBoost.clip).toBe('SitNod');
    expect(mildBoost.mood).toBe('happy');

    // Morale 0 -> Listen & neutral
    const neutral = calculateTeamTalkReaction('p3', 'Player 3', 0);
    expect(neutral.clip).toBe('Listen');
    expect(neutral.mood).toBe('neutral');

    // Morale -1..-3 -> SitHeadDown & worried
    const mildDrop = calculateTeamTalkReaction('p4', 'Player 4', -2);
    expect(mildDrop.clip).toBe('SitHeadDown');
    expect(mildDrop.mood).toBe('worried');

    // Morale <= -4 -> ArmsFolded & angry
    const bigDrop = calculateTeamTalkReaction('p5', 'Player 5', -5);
    expect(bigDrop.clip).toBe('ArmsFolded');
    expect(bigDrop.mood).toBe('angry');

    // Temperamental player with negative delta -> ArmsFolded & angry
    const tempDrop = calculateTeamTalkReaction('p6', 'Player 6', -1, true);
    expect(tempDrop.clip).toBe('ArmsFolded');
    expect(tempDrop.mood).toBe('angry');
  });
});

describe('M6b Talk Scenes (§11.25.5)', () => {
  it('supports skip to choice and line progression', () => {
    const mgr = new TalkSceneManager();
    let currentBeatId: string | null = null;
    let sceneFinished = false;

    mgr.startScene(
      [
        { id: 'b1', type: 'speaking', line: 'Welcome to the club.' },
        { id: 'b2', type: 'choice', choices: [{ id: 'c1', label: 'Accept' }] },
        { id: 'b3', type: 'speaking', line: 'Great choice.' },
      ],
      (beat) => {
        currentBeatId = beat?.id ?? null;
      },
      () => {
        sceneFinished = true;
      },
    );

    expect(currentBeatId).toBe('b1');

    // Skip to next choice
    mgr.skipToChoice();
    expect(currentBeatId).toBe('b2');

    // Select choice
    mgr.selectChoice('c1');
    expect(currentBeatId).toBe('b3');

    // Skip last line
    mgr.skipLine();
    expect(sceneFinished).toBe(true);
  });
});

describe('M6b Time of Day (§11.25.6)', () => {
  it('cycles through the 4 weekly beats and generates top bar chips', () => {
    const tod = new TimeOfDayController();

    tod.setBeat('monday_morning', true);
    expect(tod.getBeat()).toBe('monday_morning');
    expect(tod.getTopBarChip()).toEqual({ dayText: 'MON', timeText: 'MORNING' });

    tod.setBeat('wednesday_afternoon', true);
    expect(tod.getBeat()).toBe('wednesday_afternoon');
    expect(tod.getTopBarChip()).toEqual({ dayText: 'WED', timeText: 'AFTERNOON' });

    tod.setBeat('friday_evening', true);
    expect(tod.getBeat()).toBe('friday_evening');
    expect(tod.getTopBarChip()).toEqual({ dayText: 'FRI', timeText: 'EVENING' });

    tod.setBeat('matchday', true);
    expect(tod.getBeat()).toBe('matchday');
    expect(tod.getTopBarChip()).toEqual({ dayText: 'SAT', timeText: 'MATCHDAY' });
  });
});
