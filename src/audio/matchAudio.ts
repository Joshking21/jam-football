// Implements SPEC §17.3 Crowd and SFX (Match bridge)
import { MatchEvent, Side } from '@/core/types';
import { BALANCE } from '@/config/balance';
import { clamp } from './synth';
import { audioEngine, AudioEngine } from './engine';

export class MatchAudioController {
  private engine: AudioEngine;
  private lastBallX = 52.5;
  private lastBallY = 34.0;
  private lastAttackingSide: Side = 'home';
  private lastDanger = 0;

  constructor(engine: AudioEngine = audioEngine) {
    this.engine = engine;
  }

  public setEngine(engine: AudioEngine): void {
    this.engine = engine;
  }

  /**
   * Computes spatial pan [-0.6, 0.6] relative to the camera center
   */
  public computeSpatialPan(ballX: number, cameraX = 52.5): number {
    const panMax = BALANCE.audio.panMax; // 0.6
    const halfPitch = BALANCE.audio.pitchLength * 0.5; // 52.5
    const delta = ballX - cameraX;
    const rawPan = (delta / halfPitch) * panMax;
    return clamp(rawPan, -panMax, panMax);
  }

  /**
   * Computes danger level [0, 1] based on ball position and attacking direction
   */
  public computeDanger(
    ballX: number,
    ballY: number,
    attackingSide: Side,
  ): { danger: number; isHomeAttacking: boolean } {
    const pLength = BALANCE.audio.pitchLength; // 105
    const defMax = BALANCE.audio.defThirdMaxX; // 35
    const midMax = BALANCE.audio.midThirdMaxX; // 70
    const boxMinX = BALANCE.audio.boxMinX; // 88.5
    const boxMinY = BALANCE.audio.boxMinY; // 13.84
    const boxMaxY = BALANCE.audio.boxMaxY; // 54.16

    // Relative X: 0 = own goal line, 105 = opponent goal line
    const relX = attackingSide === 'home' ? ballX : pLength - ballX;
    let danger = 0;

    if (relX <= defMax) {
      // Own defensive third: 0.0 to 0.15
      danger = (relX / defMax) * 0.15;
    } else if (relX <= midMax) {
      // Middle third: 0.15 to 0.45
      danger = 0.15 + ((relX - defMax) / (midMax - defMax)) * 0.3;
    } else if (relX <= boxMinX) {
      // Attacking third: 0.45 to 0.75
      danger = 0.45 + ((relX - midMax) / (boxMinX - midMax)) * 0.3;
    } else {
      // Opponent penalty area zone (relX > 88.5)
      const inBox = ballY >= boxMinY && ballY <= boxMaxY;
      if (inBox) {
        // Deep inside box: 0.85 to 1.0
        const boxDepth = (relX - boxMinX) / (pLength - boxMinX);
        danger = 0.85 + boxDepth * 0.15;
      } else {
        // Wide area near box: 0.70 to 0.82
        danger = 0.7 + ((relX - boxMinX) / (pLength - boxMinX)) * 0.12;
      }
    }

    const clampedDanger = clamp(danger, 0, 1);
    const isHomeAttacking = attackingSide === 'home';

    return { danger: clampedDanger, isHomeAttacking };
  }

  /**
   * Updates ball position and updates crowd danger in audio engine
   */
  public updateBall(
    ballX: number,
    ballY: number,
    attackingSide: Side,
    userSide: Side = 'home',
  ): void {
    this.lastBallX = ballX;
    this.lastBallY = ballY;
    this.lastAttackingSide = attackingSide;

    const { danger, isHomeAttacking } = this.computeDanger(ballX, ballY, attackingSide);
    this.lastDanger = danger;

    this.engine.setMatchDanger(danger, isHomeAttacking);
  }

  /**
   * Processes a simulation match event into corresponding SFX and crowd audio cues
   */
  public onEvent(ev: MatchEvent, userSide: Side = 'home', cameraX = 52.5): void {
    const ballX = ev.from?.x ?? this.lastBallX;
    const pan = this.computeSpatialPan(ballX, cameraX);

    switch (ev.type) {
      case 'KICKOFF':
        this.engine.playSfx('whistle_short');
        break;

      case 'PASS':
        this.engine.playSfx('kick_pass', { pan, isShot: false });
        break;

      case 'CROSS':
        this.engine.playSfx('kick_pass', { pan, isShot: false, volume: 1.15 });
        break;

      case 'AERIAL_DUEL':
        this.engine.playSfx('header', { pan });
        break;

      case 'SHOT':
        if (ev.shot?.bodyPart === 'Head') {
          this.engine.playSfx('header', { pan });
        } else {
          this.engine.playSfx('kick_shot', { pan, isShot: true, volume: 1.25 });
        }
        break;

      case 'GOAL': {
        this.engine.playSfx('net');
        this.engine.playSfx('whistle_long');
        const isHome = ev.side === 'home';
        this.engine.playCrowd('goal_roar', { isHome });
        if (!isHome) {
          this.engine.playCrowd('away_cheer', { isHome: false });
        }
        break;
      }

      case 'POST':
        this.engine.playSfx('post', { pan });
        this.engine.playCrowd('groan_miss');
        break;

      case 'SAVE':
        this.engine.playCrowd('ooh_save');
        break;

      case 'MISS':
        this.engine.playCrowd('groan_miss');
        break;

      case 'FOUL':
        this.engine.playSfx('whistle_short');
        this.engine.playCrowd('boo_foul');
        break;

      case 'OFFSIDE':
        this.engine.playSfx('whistle_short');
        break;

      case 'YELLOW':
      case 'RED':
        this.engine.playSfx('whistle_short');
        break;

      case 'KNOCK':
      case 'INJURY':
        this.engine.playSfx('whistle_short');
        break;

      case 'HALF_TIME':
        this.engine.playSfx('whistle_long');
        break;

      case 'FULL_TIME':
        this.engine.playSfx('whistle_fulltime');
        break;

      default:
        break;
    }
  }

  public getLastDanger(): number {
    return this.lastDanger;
  }
}

export const matchAudio = new MatchAudioController();
