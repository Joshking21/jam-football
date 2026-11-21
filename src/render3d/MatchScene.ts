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
import { RENDER_CONFIG } from '../config/balance';

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

  private container: HTMLElement;
  private animFrameId: number | null = null;
  private clock: THREE.Clock;
  private isDisposed = false;
  private isPaused = false;
  private quality: QualityPreset;

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
    this.stadium = createStadium(ctx.homeClub, this.quality);
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

    // 10. Lighting & Atmosphere
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

    // 11. Event listeners
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

    // Update scene dynamic parts
    this.goals.update(delta);
    this.crowd.update(delta);
    this.players.update(delta);
    this.lights.update(delta);

    // Update camera target tracking
    const ballPos = this.ball.getPosition();
    this.cameras.update(delta, ballPos);

    // Render frame
    this.renderer.render(this.scene, this.cameras.camera);
  };

  private onWindowResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.cameras.handleResize(width, height);
    this.renderer.setSize(width, height);
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

  public setCameraMode(mode: CameraMode) {
    this.cameras.setMode(mode);
  }

  public getCameraMode(): CameraMode {
    return this.cameras.getMode();
  }

  public setBallPosition(x: number, y: number, z: number) {
    this.ball.setPosition(x, y, z);
  }

  public triggerGoalEvent(scoringSide: 'home' | 'away') {
    this.goals.triggerRipple(scoringSide);
    this.crowd.triggerGoal(scoringSide);
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
