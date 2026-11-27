// SPEC §11.25.1-11.25.4 ClubScene and scene manager
import * as THREE from 'three';
import type { RoomId, FocusView, Hotspot } from './types';
import { ROOM_DEFINITIONS, buildRoomMesh, getRoomForScreen } from './rooms';
import { CoachWalkController } from './walk';
import { LookAroundController } from './lookAround';
import { PeopleManager } from './people';
import { TimeOfDayController } from './timeOfDay';
import { TalkSceneManager } from './talkScenes';
import { SurfaceManager } from './surfaces/SurfaceManager';
import { audioEngine } from '../audio';

export class ClubScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  private lastTime = 0;

  // Controllers
  public walkController: CoachWalkController;
  public lookAroundController: LookAroundController;
  public peopleManager: PeopleManager;
  public timeOfDayController: TimeOfDayController;
  public talkSceneManager: TalkSceneManager;
  public surfaceManager: SurfaceManager;

  // State
  private currentRoomId: RoomId = 'office';
  private loadedRooms: Map<RoomId, THREE.Group> = new Map();
  private isDisposed = false;
  private raycaster = new THREE.Raycaster();
  private onHotspotClick?: (hotspotId: string, screen?: string) => void;
  private onInteractionPromptChange?: (prompt: string | null) => void;
  private onFreeRoamChange?: (roaming: boolean) => void;
  private onFocusChange?: (focused: boolean, hotspot: Hotspot | null) => void;
  public isFreeRoam = true;

  // Focus camera state
  private focusTarget: FocusView | null = null;
  private focusHotspot: Hotspot | null = null;
  private isFocused = false;
  private focusLerp = 0;

  // Free Walking State (§24)
  private coachPerson: any = null;
  private currentPrompt: string | null = null;
  private nearestHotspot: any = null;
  private keysDown = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
  };
  // Free-roam follow camera (GTA-style): free 360° yaw, no spring-back
  private camYaw = 0; // radians; 0 = camera behind coach looking toward -Z
  private camPitch = 0.15; // radians
  private camDist = 3.2; // metres, mouse wheel zooms

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Three.js Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);

    const initialDef = ROOM_DEFINITIONS.office;
    this.camera = new THREE.PerspectiveCamera(
      initialDef.cameraRail.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    this.camera.position.set(...initialDef.cameraRail.position);
    this.camera.lookAt(new THREE.Vector3(...initialDef.cameraRail.target));

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 3. Lights & Time of Day
    const sun = new THREE.DirectionalLight(0xe6f0fa, 1.1);
    sun.position.set(-10, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    const ambient = new THREE.AmbientLight(0x90afcf, 0.4);
    this.scene.add(ambient);

    this.timeOfDayController = new TimeOfDayController();
    this.timeOfDayController.setLights(sun, ambient);

    // 4. Sub-controllers
    this.walkController = new CoachWalkController();
    this.lookAroundController = new LookAroundController();
    this.peopleManager = new PeopleManager();
    this.talkSceneManager = new TalkSceneManager();
    this.surfaceManager = new SurfaceManager();

    // 5. Initial Room setup
    this.loadRoom('office');
    this.lookAroundController.setRoom(ROOM_DEFINITIONS.office);
    audioEngine.setRoom('office');

    // Add 3D Coach to the world
    this.coachPerson = this.peopleManager.createPerson(
      'coach',
      'The Manager',
      'coach',
      [-12, 0, 5.8],
      0,
    );
    this.scene.add(this.coachPerson.group);

    // 6. Bind Input Events
    this.bindEvents();

    // 7. Start Render Loop
    this.lastTime = performance.now();
    this.renderLoop = this.renderLoop.bind(this);
    this.animFrameId = requestAnimationFrame(this.renderLoop);
  }

  public setOnHotspotClick(callback: (hotspotId: string, screen?: string) => void) {
    this.onHotspotClick = callback;
  }

  public setOnInteractionPromptChange(callback: (prompt: string | null) => void) {
    this.onInteractionPromptChange = callback;
  }

  public setOnFreeRoamChange(callback: (roaming: boolean) => void) {
    this.onFreeRoamChange = callback;
  }

  public setOnFocusChange(callback: (focused: boolean, hotspot: Hotspot | null) => void) {
    this.onFocusChange = callback;
  }

  public enterFocus(hotspot: Hotspot) {
    if (!hotspot.focusView) return;
    this.focusTarget = hotspot.focusView;
    this.focusHotspot = hotspot;
    this.isFocused = true;
    this.focusLerp = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    this.clearKeys();
    if (this.onFocusChange) this.onFocusChange(true, hotspot);
  }

  /** Focus a hotspot in the current room by id (used by ?focus= for captures). */
  public focusById(hotspotId: string) {
    const spot = ROOM_DEFINITIONS[this.currentRoomId]?.hotspots.find((h) => h.id === hotspotId);
    if (spot) this.enterFocus(spot);
  }

  public exitFocus() {
    this.focusTarget = null;
    this.focusHotspot = null;
    this.isFocused = false;
    this.focusLerp = 0;
    if (this.onFocusChange) this.onFocusChange(false, null);
  }

  public setFreeRoam(roaming: boolean) {
    this.isFreeRoam = roaming;
    if (this.onFreeRoamChange) {
      this.onFreeRoamChange(roaming);
    }
  }

  private loadRoom(roomId: RoomId) {
    // Only current room is visible (§11.25.1)
    for (const [id, grp] of this.loadedRooms.entries()) {
      grp.visible = id === roomId;
    }

    if (!this.loadedRooms.has(roomId)) {
      const roomMesh = buildRoomMesh(roomId);
      this.loadedRooms.set(roomId, roomMesh);
      this.scene.add(roomMesh);
    } else {
      const grp = this.loadedRooms.get(roomId);
      if (grp) grp.visible = true;
    }

    this.currentRoomId = roomId;
    const def = ROOM_DEFINITIONS[roomId];
    if (def) {
      this.lookAroundController.setRoom(def);
      if (this.coachPerson) {
        this.coachPerson.group.position.set(def.doorPosition[0], 0, def.doorPosition[2]);
      }
    }
    audioEngine.setRoom(roomId);

    const roomGroup = this.loadedRooms.get(roomId);
    if (roomGroup) {
      this.surfaceManager.bindToRoom(roomGroup);
    }
  }

  public goToRoom(targetRoomId: RoomId, walksEnabled = true) {
    if (this.currentRoomId === targetRoomId) return;

    if (!walksEnabled) {
      this.loadRoom(targetRoomId);
      return;
    }

    const started = this.walkController.startWalk(
      this.currentRoomId,
      targetRoomId,
      walksEnabled,
      () => {
        this.loadRoom(targetRoomId);
      },
    );

    if (!started) {
      this.loadRoom(targetRoomId);
    }
  }

  public goToScreen(screen: string, walksEnabled = true) {
    const targetRoom = getRoomForScreen(screen);
    this.goToRoom(targetRoom, walksEnabled);
  }

  private bindEvents() {
    const el = this.renderer.domElement;

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('mousedown', (e) => {
      this.lookAroundController.onMouseDown(e.button);
    });

    window.addEventListener('mouseup', (e) => {
      this.lookAroundController.onMouseUp(e.button);
    });

    el.addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === el;
      if (this.isFreeRoam && !this.isFocused && (locked || e.buttons === 2)) {
        this.camYaw -= e.movementX * 0.0035;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0025, -0.35, 0.9);
        return;
      }
      if (e.buttons === 2) {
        this.lookAroundController.onMouseMove(e.movementX, e.movementY);
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        if (this.isFreeRoam && !this.isFocused) {
          this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.003, 1.6, 6);
          return;
        }
        this.lookAroundController.onWheel(e.deltaY);
      },
      { passive: true },
    );

    // Releasing held keys when the tab loses focus avoids a stuck walk
    window.addEventListener('blur', this.clearKeys);

    window.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (this.walkController.isWalking()) {
        // Any click or key skips walk (§11.25.2)
        this.walkController.skip();
        return;
      }

      const key = e.key.toLowerCase();
      const move = ClubScene.moveKey(key);
      if (move) {
        this.keysDown[move] = true;
        if (key.startsWith('arrow')) e.preventDefault(); // no page scroll
      }
      if (e.shiftKey) this.keysDown.shift = true;

      if (key === 'e') {
        if (this.nearestHotspot && this.nearestHotspot.opens) {
          const opens = this.nearestHotspot.opens as any;
          if (opens.room) {
            this.goToRoom(opens.room, true);
          }
          if (this.nearestHotspot.focusView) {
            this.enterFocus(this.nearestHotspot);
          } else if (opens.screen && this.onHotspotClick) {
            this.onHotspotClick(this.nearestHotspot.id, opens.screen);
          }
        }
      }

      if (key === 'escape' && this.isFocused) {
        this.exitFocus();
      }

      this.lookAroundController.onKeyDown(e);
    });

    window.addEventListener('keyup', (e) => {
      const move = ClubScene.moveKey(e.key.toLowerCase());
      if (move) this.keysDown[move] = false;
      if (!e.shiftKey) this.keysDown.shift = false;
    });

    el.addEventListener('click', (e) => {
      if (this.walkController.isWalking()) {
        this.walkController.skip();
        return;
      }

      // Click the world to take mouse look (Esc gives the cursor back)
      if (this.isFreeRoam && !this.isFocused && document.pointerLockElement !== el) {
        el.requestPointerLock?.();
      }
    });

    window.addEventListener('resize', this.onResize);
  }

  private static moveKey(key: string): 'w' | 'a' | 's' | 'd' | null {
    if (key === 'w' || key === 'arrowup') return 'w';
    if (key === 's' || key === 'arrowdown') return 's';
    if (key === 'a' || key === 'arrowleft') return 'a';
    if (key === 'd' || key === 'arrowright') return 'd';
    return null;
  }

  private clearKeys = () => {
    this.keysDown.w = this.keysDown.a = this.keysDown.s = this.keysDown.d = false;
    this.keysDown.shift = false;
  };

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private renderLoop(now: number) {
    if (this.isDisposed) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // 1. Update Controllers
    this.timeOfDayController.update(dt);
    this.walkController.update(dt);

    // 1b. WASD Free Walking (§24) — disabled while focused on a surface
    if (this.coachPerson && !this.walkController.isWalking() && !this.isFocused) {
      // Move relative to where the camera faces
      const fwd = (this.keysDown.w ? 1 : 0) - (this.keysDown.s ? 1 : 0);
      const strafe = (this.keysDown.d ? 1 : 0) - (this.keysDown.a ? 1 : 0);
      const sy = Math.sin(this.camYaw);
      const cy = Math.cos(this.camYaw);
      const dx = -sy * fwd + cy * strafe;
      const dz = -cy * fwd - sy * strafe;

      const isMoving = dx !== 0 || dz !== 0;

      if (isMoving) {
        const moveVec = new THREE.Vector3(dx, 0, dz).normalize();
        const speed = this.keysDown.shift ? 5.8 : 3.4; // m/s
        const deltaPos = moveVec.clone().multiplyScalar(speed * dt);

        const curPos = this.coachPerson.group.position;
        const b = ROOM_DEFINITIONS[this.currentRoomId].bounds;
        const margin = 0.35;

        const nextX = THREE.MathUtils.clamp(
          curPos.x + deltaPos.x,
          b.min[0] + margin,
          b.max[0] - margin,
        );
        const nextZ = THREE.MathUtils.clamp(
          curPos.z + deltaPos.z,
          b.min[2] + margin,
          b.max[2] - margin,
        );

        this.coachPerson.group.position.x = nextX;
        this.coachPerson.group.position.z = nextZ;

        const facing = Math.atan2(moveVec.x, moveVec.z);
        this.coachPerson.group.rotation.y = facing;

        const targetClip = this.keysDown.shift ? 'Run' : 'Walk';
        if (this.coachPerson.currentClip !== targetClip) {
          this.peopleManager.playClip('coach', targetClip);
        }

      } else {
        if (this.coachPerson.currentClip === 'Walk' || this.coachPerson.currentClip === 'Run') {
          this.peopleManager.playClip('coach', 'Idle');
        }
      }

      // Check proximity to Hotspots for [E] prompt
      const def = ROOM_DEFINITIONS[this.currentRoomId];
      if (def) {
        let closest: any = null;
        let minDist = 2.0;

        for (const spot of def.hotspots) {
          const sPos = new THREE.Vector3(...spot.position);
          const dist = this.coachPerson.group.position.distanceTo(sPos);
          if (dist < minDist) {
            minDist = dist;
            closest = spot;
          }
        }

        this.nearestHotspot = closest;
        const prompt = closest ? `[E] · ${closest.name}` : null;
        if (prompt !== this.currentPrompt) {
          this.currentPrompt = prompt;
          if (this.onInteractionPromptChange) {
            this.onInteractionPromptChange(prompt);
          }
        }
      }
    }

    const headPositions = this.peopleManager.getAll().map((p) => {
      return [p.position[0], p.position[1] + 1.62, p.position[2]] as [number, number, number];
    });

    if (this.isFocused && this.focusTarget) {
      // Smoothly animate camera to the focus position
      this.focusLerp = Math.min(this.focusLerp + dt * 2.5, 1);
      const t = 1 - Math.pow(1 - this.focusLerp, 3); // ease-out cubic

      const targetPos = new THREE.Vector3(...this.focusTarget.position);
      const targetLook = new THREE.Vector3(...this.focusTarget.target);

      this.camera.position.lerp(targetPos, t * 0.12 + 0.02);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.focusTarget.fov, t * 0.1);
      this.camera.lookAt(targetLook);
      this.camera.updateProjectionMatrix();
    } else if (this.isFreeRoam && this.coachPerson) {
      const orbitYaw = this.camYaw;
      const orbitPitch = this.camPitch;

      const dist = this.camDist;
      const height = 1.4 + Math.sin(orbitPitch) * dist;
      const horizDist = dist * Math.cos(orbitPitch);

      const camOffset = new THREE.Vector3(
        Math.sin(orbitYaw) * horizDist,
        height,
        Math.cos(orbitYaw) * horizDist,
      );

      const coachPos = this.coachPerson.group.position;
      const camTarget = coachPos.clone().add(camOffset);

      const b = ROOM_DEFINITIONS[this.currentRoomId].bounds;
      const margin = 0.35;
      camTarget.x = THREE.MathUtils.clamp(camTarget.x, b.min[0] + margin, b.max[0] - margin);
      camTarget.y = THREE.MathUtils.clamp(camTarget.y, b.min[1] + margin, b.max[1] - margin);
      camTarget.z = THREE.MathUtils.clamp(camTarget.z, b.min[2] + margin, b.max[2] - margin);

      this.camera.position.lerp(camTarget, 0.15);
      this.camera.lookAt(coachPos.clone().add(new THREE.Vector3(0, 1.25, 0)));
      this.camera.updateProjectionMatrix();
    } else {
      this.lookAroundController.update(dt, this.camera, headPositions);
    }
    this.peopleManager.update(dt, null, null);

    // 2. Render Scene
    this.renderer.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.clearKeys);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.surfaceManager.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
