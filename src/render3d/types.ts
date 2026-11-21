// Implements SPEC §14, §18, §21 3D Match Types and Options
import * as THREE from 'three';
import { Club, Player, Side } from '../core/types';

export type QualityPreset = 'Low' | 'Medium' | 'High';
export type CameraMode = 'broadcast' | 'tactical' | 'player' | 'orbit';
export type TimeSlot = 'night' | 'evening' | 'afternoon';
export type WeatherType = 'dry' | 'rain' | 'snow';

export interface Player3DVisual {
  id: string;
  side: Side;
  number: number;
  name: string;
  group: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  hair: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  shadow: THREE.Mesh;
  nameTag?: THREE.Sprite;
  currentSpeed: number;
  limbPhase: number;
  isKicking: boolean;
  isTackling: boolean;
  isDiving: boolean;
}

export interface Match3DContext {
  container: HTMLElement;
  homeClub: Club;
  awayClub: Club;
  homePlayers: Player[];
  awayPlayers: Player[];
  weather: WeatherType;
  timeSlot?: TimeSlot;
  quality?: QualityPreset;
  choreographer?: any;
}
