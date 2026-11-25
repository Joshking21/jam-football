// SPEC §11.25 Club spaces types and contracts
import type { AppScreen } from '../state/store';

export type RoomId =
  | 'exterior'
  | 'corridor'
  | 'office'
  | 'boardroom'
  | 'dressing'
  | 'tunnel'
  | 'training'
  | 'press';

export type TimeOfDayBeat =
  | 'monday_morning'
  | 'wednesday_afternoon'
  | 'friday_evening'
  | 'matchday';

export interface Vec3Tuple {
  0: number;
  1: number;
  2: number;
}

export type Point3D = [number, number, number];

export interface TouchPoint {
  hand: 'L' | 'R' | 'auto';
  point: Point3D;
  normal: Point3D;
  kind: 'handle' | 'push' | 'rest' | 'brush';
}

export interface Hotspot {
  id: string;
  name: string;
  position: Point3D;
  radius: number;
  room: RoomId;
  opens?: {
    screen?: AppScreen;
    scene?: string;
    action?: string;
    room?: RoomId;
  };
  touch?: TouchPoint;
}

export interface CameraRail {
  position: Point3D;
  target: Point3D;
  fov: number;
}

export interface RoomBounds {
  min: Point3D;
  max: Point3D;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  bounds: RoomBounds;
  doorPosition: Point3D;
  cameraRail: CameraRail;
  hotspots: Hotspot[];
}

export interface NavWaypoint {
  id: string;
  room: RoomId;
  position: Point3D;
  neighbors: string[];
}

export interface FaceMoodPreset {
  browShape: 'neutral' | 'raised' | 'furrowed' | 'arched';
  restingMouth: 'neutral' | 'smile' | 'frown' | 'slack';
  eyeState: 'normal' | 'squint' | 'wide';
}

export type FaceMood = 'neutral' | 'happy' | 'angry' | 'worried' | 'shocked';

export type MouthShape = 'closed' | 'small' | 'open' | 'wide';

export interface TalkSceneBeat {
  id: string;
  type: 'speaking' | 'choice' | 'reaction';
  speaker?: string;
  role?: string;
  line?: string;
  audioKey?: string;
  voUrl?: string;
  targetPersonId?: string;
  choices?: TalkSceneChoice[];
  summaryNote?: string;
  onChoiceSelected?: (choiceId: string) => void;
}

export interface TalkSceneChoice {
  id: string;
  tone?: string;
  label: string;
  predictedReaction?: string;
  effectSummary?: string;
  actionPayload?: unknown;
}

export interface TeamTalkReaction {
  playerId: string;
  playerName: string;
  moraleDelta: number;
  clip: 'FistPump' | 'SitClap' | 'SitNod' | 'Listen' | 'SitHeadDown' | 'ArmsFolded';
  mood: FaceMood;
  delaySec: number;
}
