// SPEC §11.25.1-11.25.4 ClubScene and scene manager
import * as THREE from 'three';
import type { RoomId } from './types';
import { ROOM_DEFINITIONS, buildRoomMesh, getRoomForScreen } from './rooms';
import { CoachWalkController } from './walk';
import { LookAroundController } from './lookAround';
import { PeopleManager } from './people';
import { TimeOfDayController } from './timeOfDay';
import { TalkSceneManager } from './talkScenes';
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

  // State
  private currentRoomId: RoomId = 'office';
  private loadedRooms: Map<RoomId, THREE.Group> = new Map();
  private isDisposed = false;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private onHotspotClick?: (hotspotId: string, screen?: string) => void;
  private onInteractionPromptChange?: (prompt: string | null) => void;

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
    this.lookAroundController.setRoom(ROOM_DEFINITIONS[roomId]);
    audioEngine.setRoom(roomId);
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
      if (e.buttons === 2) {
        this.lookAroundController.onMouseMove(e.movementX, e.movementY);
      }
    });

    el.addEventListener('wheel', (e) => {
      this.lookAroundController.onWheel(e.deltaY);
    });

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
      if (key === 'w') this.keysDown.w = true;
      if (key === 's') this.keysDown.s = true;
      if (key === 'a') this.keysDown.a = true;
      if (key === 'd') this.keysDown.d = true;
      if (e.shiftKey) this.keysDown.shift = true;

      if (key === 'e') {
        if (this.nearestHotspot && this.nearestHotspot.opens?.screen && this.onHotspotClick) {
          this.onHotspotClick(this.nearestHotspot.id, this.nearestHotspot.opens.screen);
        }
      }

      this.lookAroundController.onKeyDown(e);
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keysDown.w = false;
      if (key === 's') this.keysDown.s = false;
      if (key === 'a') this.keysDown.a = false;
      if (key === 'd') this.keysDown.d = false;
      if (!e.shiftKey) this.keysDown.shift = false;
    });

    el.addEventListener('click', (e) => {
      if (this.walkController.isWalking()) {
        this.walkController.skip();
        return;
      }

      // Check Hotspot click
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const def = ROOM_DEFINITIONS[this.currentRoomId];
      if (!def) return;

      const camPos = this.camera.position;
      for (const spot of def.hotspots) {
        const spotVec = new THREE.Vector3(...spot.position);
        if (camPos.distanceTo(spotVec) < spot.radius * 3) {
          if (spot.opens?.screen && this.onHotspotClick) {
            this.onHotspotClick(spot.id, spot.opens.screen);
          }
        }
      }
    });

    window.addEventListener('resize', this.onResize);
  }

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

    // 1b. WASD Free Walking (§24)
    if (this.coachPerson && !this.walkController.isWalking()) {
      let dx = 0;
      let dz = 0;
      if (this.keysDown.w) dz -= 1;
      if (this.keysDown.s) dz += 1;
      if (this.keysDown.a) dx -= 1;
      if (this.keysDown.d) dx += 1;

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

        // Camera smoothly follows behind coach in free walk
        const camOffset = new THREE.Vector3(0, 1.6, 2.8);
        const camTarget = this.coachPerson.group.position.clone().add(camOffset);
        this.camera.position.lerp(camTarget, 0.1);
        this.camera.lookAt(
          this.coachPerson.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
        );
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

    this.lookAroundController.update(dt, this.camera, headPositions);
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
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
