// Implements SPEC §14.2, §14.8, §14.10 Master Three.js Match Scene Orchestrator
import * as THREE from 'three';
import { Match3DContext, QualityPreset, CameraMode } from './types';
import { createPitch, PitchMeshBundle } from './pitch';
import { createGoals, GoalsBundle } from './goals';
import { createStadium, StadiumBundle } from './stadium';
import { createCrowd, CrowdBundle } from './crowd';
import { createBall, BallBundle } from './ball';
import { createPlayers, PlayersBundle } from './players';
import { createCameras, CameraBundle } from './cameras';
import { createLights, LightsBundle } from './lights';
import { Choreographer, PlayerPaceMap } from './choreographer';
import { createPostPipeline, PostPipeline } from './post';
import { createStadiumEnvironment, StadiumEnvironment } from './environment';
import { createFloodlightBeams, FloodlightBeams } from './beams';
import { RENDER_CONFIG } from '../config/balance';
import { MatchEvent } from '../core/types';
import { MatchPhysics } from '../physics/matchPhysics';

export class MatchScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public cameras: CameraBundle;
  public pitch: PitchMeshBundle;
  public goals: GoalsBundle;
  public stadium: StadiumBundle;
  public crowd: CrowdBundle;
  public ball: BallBundle;
  public players: PlayersBundle;
  public lights: LightsBundle;
  public choreographer: Choreographer;

  private postPipeline: PostPipeline | null = null;
  private environment: StadiumEnvironment | null = null;
  private beams: FloodlightBeams | null = null;

  private container: HTMLElement;
  private animFrameId: number | null = null;
  private clock: THREE.Clock;
  private isDisposed = false;
  private isPaused = false;
  private quality: QualityPreset;

  private currentPt = 0;
  private currentEvent: MatchEvent | null = null;
  private currentHalf: 1 | 2 = 1;
  private lastTriggeredGoalSeq = -1;
  private ballInNet = false;
  /** §14.12 physics; null until Rapier has loaded (or if it can't), then the director drives. */
  private physics: MatchPhysics | null = null;
  private tmpQ = new THREE.Quaternion();
  private yawQ = new THREE.Quaternion();
  private upAxis = new THREE.Vector3(0, 1, 0);
  private pendingGoalSide: 'home' | 'away' | null = null;

  constructor(ctx: Match3DContext) {
    this.container = ctx.container;
    this.quality = ctx.quality || 'Medium';
    this.clock = new THREE.Clock();

    // 1. Scene setup
    this.scene = new THREE.Scene();
    const timeSlot = ctx.timeSlot || 'night';
    const skyCfg = RENDER_CONFIG.timeSlots[timeSlot];
    this.scene.background = new THREE.Color(skyCfg.skyTop);

    // 2. Renderer setup (SPEC §14.2, §21.2)
    const qualityCfg = RENDER_CONFIG.quality[this.quality];
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'Low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityCfg.pixelRatio));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

    if (qualityCfg.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.container.appendChild(this.renderer.domElement);

    // 3. Cameras
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.cameras = createCameras(this.renderer.domElement, aspect);

    // 4. Pitch
    this.pitch = createPitch(ctx.weather, this.quality);
    this.scene.add(this.pitch.mesh);

    // 5. Goals
    this.goals = createGoals();
    this.scene.add(this.goals.group);

    // 6. Stadium (Stands, Floodlights, Sponsors)
    this.stadium = createStadium(ctx.homeClub, this.quality, ctx.awayClub);
    this.scene.add(this.stadium.group);

    // 7. Crowd
    this.crowd = createCrowd(ctx.homeClub, ctx.awayClub, this.quality);
    this.scene.add(this.crowd.group);

    // 8. Ball
    this.ball = createBall();
    this.scene.add(this.ball.mesh);
    this.scene.add(this.ball.shadow);

    // 9. Players
    this.players = createPlayers(
      ctx.homeClub,
      ctx.awayClub,
      ctx.homePlayers,
      ctx.awayPlayers,
      this.quality,
    );
    this.scene.add(this.players.group);

    // 10. Choreographer initialization
    if (ctx.choreographer) {
      this.choreographer = ctx.choreographer;
    } else {
      const paces: PlayerPaceMap = {};
      [...ctx.homePlayers, ...ctx.awayPlayers].forEach((p) => {
        paces[p.id] = p.attributes.pace;
      });

      const homeLineup =
        (ctx.homeClub.tactics.lineup.filter(Boolean) as string[]).length === 11
          ? (ctx.homeClub.tactics.lineup as string[])
          : ctx.homeClub.squad.slice(0, 11);
      const awayLineup =
        (ctx.awayClub.tactics.lineup.filter(Boolean) as string[]).length === 11
          ? (ctx.awayClub.tactics.lineup as string[])
          : ctx.awayClub.squad.slice(0, 11);

      this.choreographer = new Choreographer(
        {
          formation: ctx.homeClub.tactics.formation,
          mentality: ctx.homeClub.tactics.instructions.mentality,
          passing: ctx.homeClub.tactics.instructions.passing,
          pressing: ctx.homeClub.tactics.instructions.pressing,
          width: ctx.homeClub.tactics.instructions.width,
          line: ctx.homeClub.tactics.instructions.line,
          lineup: homeLineup,
        },
        {
          formation: ctx.awayClub.tactics.formation,
          mentality: ctx.awayClub.tactics.instructions.mentality,
          passing: ctx.awayClub.tactics.instructions.passing,
          pressing: ctx.awayClub.tactics.instructions.pressing,
          width: ctx.awayClub.tactics.instructions.width,
          line: ctx.awayClub.tactics.instructions.line,
          lineup: awayLineup,
        },
        paces,
      );
    }

    // 10b. Physics (§14.12): loads lazily; the director's motion is used until it's ready.
    {
      const ids = [...this.choreographerLineups()];
      const strength: Record<string, number> = {};
      [...ctx.homePlayers, ...ctx.awayPlayers].forEach(
        (p) => (strength[p.id] = p.attributes.strength),
      );
      void MatchPhysics.create(this.choreographer, ids, strength, ctx.weather === 'rain').then(
        (p) => {
          if (this.isDisposed) p?.dispose();
          else this.physics = p;
        },
      );
    }

    // 11. Lighting & Atmosphere
    this.lights = createLights(
      timeSlot,
      ctx.weather,
      this.stadium.floodlightPositions,
      this.quality,
    );
    this.scene.add(this.lights.group);
    if (this.lights.fog) {
      this.scene.fog = this.lights.fog;
    }

    // 12. Realism Pass: Volumetric Floodlight Beams (§14.10)
    if (this.quality !== 'Low' && (timeSlot === 'night' || timeSlot === 'evening')) {
      try {
        this.beams = createFloodlightBeams(this.stadium.floodlightPositions, ctx.weather);
        this.scene.add(this.beams.group);
      } catch (e) {
        console.warn('Floodlight beams creation skipped:', e);
      }
    }

    // 13. Realism Pass: Stadium PMREM Environment Map (§14.10)
    try {
      this.environment = createStadiumEnvironment(
        this.renderer,
        timeSlot,
        this.stadium.floodlightPositions,
      );
      this.scene.environment = this.environment.envMap.texture;
    } catch (e) {
      console.warn('Stadium environment creation skipped:', e);
    }

    // 14. Realism Pass: Post-Processing Pipeline (§14.10)
    const width = this.container.clientWidth || 1280;
    const height = this.container.clientHeight || 720;
    try {
      this.postPipeline = createPostPipeline(
        this.renderer,
        this.scene,
        this.cameras.camera,
        width,
        height,
        this.quality,
      );
    } catch (e) {
      console.warn('Post pipeline creation skipped:', e);
    }

    // 15. Event listeners
    window.addEventListener('resize', this.onWindowResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('keydown', this.onKeyDown);

    // Start render loop
    this.clock.start();
    this.animate();
  }

  private animate = () => {
    if (this.isDisposed) return;

    this.animFrameId = requestAnimationFrame(this.animate);

    if (this.isPaused) return;

    const delta = Math.min(0.08, this.clock.getDelta());

    // Update choreographer physics, steering and ball flight
    this.choreographer.update(delta, this.currentPt, this.currentEvent, this.currentHalf);

    // Physics acts the plan out (players' true positions are written back into the director).
    this.physics?.step(delta, this.currentPt);

    // Update 3D ball
    const bPos = this.physics ? this.physics.ballPos : this.choreographer.ballPos;
    this.ball.setPosition(bPos.x, bPos.y, bPos.z);
    this.ball.updateRotation(
      this.physics ? this.physics.ballVel : this.choreographer.ballVelocity,
      delta,
    );

    // The net bulges and the crowd goes up when the ball actually crosses the line.
    const inNet = Math.abs(bPos.x) > 52.7 && Math.abs(bPos.z) < 3.66 && bPos.y < 2.44;
    if (inNet && !this.ballInNet) {
      this.goals.hitNet(
        Math.sign(bPos.x) * 52.5,
        bPos.z,
        bPos.y,
        (this.physics ? this.physics.ballVel : this.choreographer.ballVelocity).length(),
      );
      if (this.pendingGoalSide) this.crowd.triggerGoal(this.pendingGoalSide);
      this.pendingGoalSide = null;
    }
    this.ballInNet = inNet;

    // Update 3D player figures from steering states
    this.players.allPlayers.forEach((visual, pid) => {
      const state = this.choreographer.getPlayerState(pid);
      if (state) {
        visual.group.position.copy(state.currentPos);
        visual.group.rotation.y = state.facingAngle;
        visual.currentSpeed = state.speed;
        visual.isKicking = state.isKicking;
        visual.isTackling = state.isTackling;
        visual.isDiving = state.isDiving;
      }
    });

    // Update scene dynamic parts
    this.goals.update(delta);
    this.crowd.update(delta);
    this.players.update(delta);

    // Falls (§14.12.4): a knocked-down player follows his body's real rotation.
    if (this.physics) {
      const ph = this.physics;
      this.players.allPlayers.forEach((visual, pid) => {
        if (!ph.isFallen(pid)) return;
        const state = this.choreographer.getPlayerState(pid);
        this.yawQ.setFromAxisAngle(this.upAxis, state ? state.facingAngle : 0);
        visual.group.quaternion.copy(ph.rotationOf(pid, this.tmpQ)).multiply(this.yawQ);
        visual.group.position.y = Math.max(-0.75, ph.heightOf(pid));
      });
    }
    this.lights.update(delta);

    // Update camera target tracking
    const ballPos = this.ball.getPosition();
    this.cameras.update(delta, ballPos);

    // Render frame (via Post-processing composer or standard renderer)
    if (this.postPipeline) {
      this.postPipeline.render();
    } else {
      this.renderer.render(this.scene, this.cameras.camera);
    }
  };

  private onWindowResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.cameras.handleResize(width, height);
    this.renderer.setSize(width, height);
    this.postPipeline?.setSize(width, height);
  };

  private onVisibilityChange = () => {
    this.isPaused = document.hidden;
    if (!document.hidden) {
      this.clock.getDelta(); // reset delta step to avoid huge jump
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'c' || e.key === 'C') {
      this.cameras.cycleMode();
    }
  };

  /** The full event list so far; the director builds one continuous ball timeline from it. */
  private *choreographerLineups(): Generator<string> {
    for (const pid of this.players.allPlayers.keys()) {
      if (this.choreographer.getPlayerState(pid)) yield pid;
    }
  }

  public setEvents(events: MatchEvent[]) {
    this.choreographer.setEvents(events);
  }

  /** Replays use the behind-goal camera (§14.7). */
  public setReplay(on: boolean, attackingGoalX: number) {
    this.cameras.setReplay(on, attackingGoalX);
  }

  public updatePlayback(pt: number, event: MatchEvent | null, half: 1 | 2) {
    this.currentPt = pt;
    this.currentEvent = event;
    this.currentHalf = half;

    if (event && event.type === 'GOAL' && event.seq !== this.lastTriggeredGoalSeq) {
      this.lastTriggeredGoalSeq = event.seq;
      this.triggerGoalEvent(event.side);
    }
  }

  public setCameraMode(mode: CameraMode) {
    this.cameras.setMode(mode);
  }

  public getCameraMode(): CameraMode {
    return this.cameras.getMode();
  }

  public updateNameTags(carrierId: string | null, commentaryId: string | null, showAll: boolean) {
    // Label whoever really has the ball, and never two tags on top of each other (REVIEW-M4 T10).
    const carrier = this.choreographer.carrierId ?? carrierId;
    let second = commentaryId && commentaryId !== carrier ? commentaryId : null;
    if (carrier && second) {
      const a = this.choreographer.getPlayerState(carrier);
      const b = this.choreographer.getPlayerState(second);
      if (a && b && a.currentPos.distanceTo(b.currentPos) < 10) second = null;
    }
    this.players.updateNameTags(carrier, second, showAll);
  }

  public setBallPosition(x: number, y: number, z: number) {
    this.ball.setPosition(x, y, z);
  }

  public triggerGoalEvent(scoringSide: 'home' | 'away') {
    // The net and the crowd react when the ball crosses the line (see animate).
    this.pendingGoalSide = scoringSide;
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('keydown', this.onKeyDown);

    // Dispose all sub-bundles
    this.pitch.dispose();
    this.goals.dispose();
    this.stadium.dispose();
    this.crowd.dispose();
    this.ball.dispose();
    this.players.dispose();
    this.cameras.dispose();
    this.lights.dispose();
    this.beams?.dispose();
    this.physics?.dispose();
    this.physics = null;
    this.environment?.dispose();
    this.postPipeline?.dispose();

    // Clean up Three.js scene
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
