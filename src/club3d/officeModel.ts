// The manager's office (docs/design/office/README.md): office.glb built in Blender, placed on the club floor plan,
// lit by the time of day (§11.25.6), and dressed from the save: the room tells you how the season is going.
//
// Floor plan: the Blender room is 8 m (west-east) x 6.5 m (south-north); its door wall (east) faces the corridor
// (world -z). Blender (bx, by, bz) -> world (OFFICE_CX - by, bz, OFFICE_CZ - bx). Seated at the desk the coach
// faces the TV (world -x); the window (world +z) is on his left and the door (world -z) on his right.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { loadModelAsset, cloneModelScene } from '../render3d/modelLoader';
import { assetUrl } from '../assets/registry';
import type { GameState } from '../core/types';
import type { TimeOfDayBeat } from './types';

export const OFFICE_CX = -12;
export const OFFICE_CZ = 5.5;

/** Blender office coordinates -> world. */
export function officeToWorld(bx: number, by: number, bz: number): [number, number, number] {
  return [OFFICE_CX - by, bz, OFFICE_CZ - bx];
}

let rectAreaReady = false;

interface BeatLook {
  window: 'day' | 'night';
  windowLight: [string, number];
  down: number;
  lamp: number;
  sconce: number;
  table: number;
  clock: [number, number]; // hh, mm
}

const BEATS: Record<TimeOfDayBeat, BeatLook> = {
  monday_morning: {
    window: 'day',
    windowLight: ['#dfe9ff', 9],
    down: 2.4,
    lamp: 0.4,
    sconce: 0,
    table: 0.5,
    clock: [9, 10],
  },
  wednesday_afternoon: {
    window: 'day',
    windowLight: ['#ffe2bd', 7.5],
    down: 1.4,
    lamp: 0.7,
    sconce: 0.3,
    table: 0.6,
    clock: [15, 20],
  },
  friday_evening: {
    window: 'night',
    windowLight: ['#8fb0ff', 2.4],
    down: 0.55,
    lamp: 3.4,
    sconce: 2.2,
    table: 1.4,
    clock: [19, 45],
  },
  matchday: {
    window: 'night',
    windowLight: ['#a8c2ff', 3.2],
    down: 1.1,
    lamp: 2.4,
    sconce: 1.5,
    table: 1.1,
    clock: [14, 30],
  },
};

export class OfficeModel {
  public readonly ready: Promise<boolean>;
  private model: THREE.Object3D | null = null;
  private lights = new THREE.Group();
  private down: THREE.SpotLight[] = [];
  private sconces: THREE.PointLight[] = [];
  private lamp: THREE.PointLight | null = null;
  private windowLight: THREE.RectAreaLight | null = null;
  private tableLight: THREE.RectAreaLight | null = null;
  private windowMat: THREE.MeshBasicMaterial | null = null;
  private windowTex: { day?: THREE.Texture; night?: THREE.Texture } = {};
  private beat: TimeOfDayBeat | null = null;
  private byName = new Map<string, THREE.Object3D>();
  private clockPivots: { hour: THREE.Object3D; minute: THREE.Object3D } | null = null;
  private paper: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; headline: string } | null =
    null;
  private phoneLight: THREE.Object3D | null = null;
  private phoneBlink = false;
  private cat: THREE.Object3D | null = null;
  private t = 0;
  private pendingState: GameState | null = null;

  constructor(private group: THREE.Group) {
    this.ready = this.load();
  }

  private async load(): Promise<boolean> {
    const gltf = await loadModelAsset('models/office/office.glb');
    if (!gltf) return false; // the procedural box room stays
    if (!rectAreaReady) {
      RectAreaLightUniformsLib.init();
      rectAreaReady = true;
    }
    // Replace the procedural fallback room (and its ceiling lights).
    for (const child of [...this.group.children]) this.group.remove(child);

    const model = cloneModelScene(gltf);
    model.name = 'OfficeModel';
    model.rotation.y = Math.PI / 2;
    model.position.set(OFFICE_CX, 0, OFFICE_CZ);
    this.group.add(model);
    this.group.add(this.lights);
    this.model = model;
    model.updateMatrixWorld(true);

    const club = clubColors();
    model.traverse((o) => {
      this.byName.set(o.name, o);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const n = mesh.name;
      const glassy =
        /Glass|window_view|screen_|light_|Stain/.test(n) || /Glass/.test(materialName(mesh));
      mesh.castShadow = !glassy;
      mesh.receiveShadow = !n.startsWith('light_');
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat?.name === 'ClubPrimary') mat.color.set(club.primary);
      if (mat?.name === 'ClubSecondary') mat.color.set(club.secondary);
    });

    // Window: unlit picture of the stadium, swapped by time of day.
    const view = this.byName.get('window_view') as THREE.Mesh | undefined;
    if (view) {
      this.windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      view.material = this.windowMat;
      const loader = new THREE.TextureLoader();
      for (const k of ['day', 'night'] as const) {
        const url = assetUrl(`images/office/window_${k}.jpg`);
        if (!url) continue;
        loader.load(url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.windowTex[k] = tex;
          if (this.beat) this.applyBeat(this.beat, true);
        });
      }
    }

    this.buildLights();
    this.buildClock();
    this.buildPaper();
    this.phoneLight = this.byName.get('live_phone_light') ?? null;
    this.cat = this.byName.get('meshy_cat') ?? null;
    if (this.pendingState) this.applyState(this.pendingState);
    if (this.beat) this.applyBeat(this.beat, true);
    return true;
  }

  // --- Lights ---------------------------------------------------------------------------------------

  private buildLights() {
    const pos = (name: string) => {
      const o = this.byName.get(name);
      return o ? o.getWorldPosition(new THREE.Vector3()) : null;
    };
    for (let i = 0; i < 5; i++) {
      const p = pos(`light_downlight_${i}`);
      if (!p) continue;
      const l = new THREE.SpotLight('#ffe9cf', 1, 6, Math.PI / 3, 0.7, 1.5);
      l.position.copy(p).y -= 0.05;
      l.target.position.set(p.x, 0, p.z);
      this.lights.add(l, l.target);
      this.down.push(l);
    }
    for (let i = 0; i < 2; i++) {
      const p = pos(`light_sconce_${i}`);
      if (!p) continue;
      const l = new THREE.PointLight('#ffb36b', 1, 4, 1.6);
      l.position.copy(p);
      this.lights.add(l);
      this.sconces.push(l);
    }
    const bulb = pos('lamp_bulb');
    if (bulb) {
      this.lamp = new THREE.PointLight('#ffbe78', 1, 3.5, 1.5);
      this.lamp.position.copy(bulb).y += 0.05;
      this.lights.add(this.lamp);
    }
    // The window: light falling in across the room from world +z.
    const [wx, wy, wz] = officeToWorld(-3.85, 0, 1.75);
    this.windowLight = new THREE.RectAreaLight('#ffffff', 1, 4.2, 1.8);
    this.windowLight.position.set(wx, wy, wz);
    this.windowLight.lookAt(OFFICE_CX, 1.1, OFFICE_CZ);
    this.lights.add(this.windowLight);
    const table = pos('screen_table');
    if (table) {
      this.tableLight = new THREE.RectAreaLight('#6fe0b8', 1, 2.2, 1.3);
      this.tableLight.position.copy(table).y += 0.05;
      this.tableLight.lookAt(table.x, 3, table.z);
      this.lights.add(this.tableLight);
    }
  }

  private applyBeat(beat: TimeOfDayBeat, force = false) {
    if (!force && beat === this.beat) return;
    this.beat = beat;
    if (!this.model) return;
    const b = BEATS[beat];
    this.down.forEach((l) => (l.intensity = b.down));
    this.sconces.forEach((l) => (l.intensity = b.sconce));
    if (this.lamp) this.lamp.intensity = b.lamp;
    if (this.windowLight) {
      this.windowLight.color.set(b.windowLight[0]);
      this.windowLight.intensity = b.windowLight[1];
    }
    if (this.tableLight) this.tableLight.intensity = b.table;
    const tex = this.windowTex[b.window];
    if (this.windowMat && tex) {
      this.windowMat.map = tex;
      this.windowMat.color.set(b.window === 'night' ? '#ffffff' : '#f2f2f2');
      this.windowMat.needsUpdate = true;
    }
    // Emissive fittings follow their lights.
    this.setEmissive('WarmBulb', b.lamp > 1 ? 12 : 2);
    this.setEmissive('SconceGlow', b.sconce > 0.5 ? 5 : 0.2);
    this.setClock(...b.clock);
  }

  private setEmissive(materialName: string, strength: number) {
    this.model?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name === materialName) m.emissiveIntensity = strength;
    });
  }

  // --- The clock ---------------------------------------------------------------------------------------

  private buildClock() {
    const face = this.byName.get('screen_clock');
    const hour = this.byName.get('live_clock_hour');
    const minute = this.byName.get('live_clock_minute');
    if (!face || !hour || !minute) return;
    const c = face.getWorldPosition(new THREE.Vector3());
    const make = (hand: THREE.Object3D) => {
      const pivot = new THREE.Object3D();
      pivot.position.copy(c);
      this.group.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(hand);
      return pivot;
    };
    this.clockPivots = { hour: make(hour), minute: make(minute) };
  }

  private setClock(hh: number, mm: number) {
    if (!this.clockPivots) return;
    // The face looks toward world -x; clockwise seen from the front is +x rotation.
    this.clockPivots.minute.rotation.x = (mm / 60) * Math.PI * 2;
    this.clockPivots.hour.rotation.x = (((hh % 12) + mm / 60) / 12) * Math.PI * 2;
  }

  // --- The local paper ---------------------------------------------------------------------------------

  private buildPaper() {
    const mesh = this.byName.get('screen_paper') as THREE.Mesh | undefined;
    if (!mesh) return;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    this.paper = { canvas, tex, headline: '' };
  }

  private drawPaper(headline: string) {
    if (!this.paper || headline === this.paper.headline) return;
    this.paper.headline = headline;
    const ctx = this.paper.canvas.getContext('2d');
    if (!ctx) return;
    const w = 768;
    const h = 1024;
    ctx.fillStyle = '#e4ddcb';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d1c1a';
    ctx.font = '700 54px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE SALTMERE ECHO', w / 2, 82);
    ctx.fillRect(30, 102, w - 60, 4);
    ctx.font = '600 22px Georgia, serif';
    ctx.fillText('SPORT', w / 2, 140);
    // Headline, wrapped.
    ctx.textAlign = 'left';
    ctx.font = '800 64px Georgia, "Times New Roman", serif';
    const words = headline.toUpperCase().split(/\s+/);
    let line = '';
    let y = 230;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w - 70 && line) {
        ctx.fillText(line, 35, y);
        line = word;
        y += 70;
        if (y > 520) break;
      } else line = test;
    }
    if (line && y <= 520) ctx.fillText(line, 35, y);
    // Photo block and columns of body text (not meant to be read).
    ctx.fillStyle = '#8c877c';
    ctx.fillRect(35, y + 30, w * 0.58, 230);
    ctx.fillStyle = '#9b968b';
    for (let col = 0; col < 3; col++) {
      const x0 = 35 + col * ((w - 70) / 3);
      for (let yy = col < 2 ? y + 290 : y + 30; yy < h - 30; yy += 15) {
        const len = ((w - 70) / 3 - 18) * (0.7 + 0.3 * Math.abs(Math.sin(yy * 0.37 + col)));
        ctx.fillRect(x0, yy, len, 5);
      }
    }
    this.paper.tex.needsUpdate = true;
  }

  // --- Living pieces from the save ----------------------------------------------------------------------

  /** Dress the room from the save (folders, mugs, letter, results, trophies, phone, bucket, paper). */
  public applyState(gs: GameState) {
    if (!this.model) {
      this.pendingState = gs;
      return;
    }
    const club = gs.clubs[gs.userClubId];
    if (!club) return;
    const show = (prefix: string, on: boolean) =>
      this.model!.traverse((o) => {
        if (o.name.startsWith(prefix)) o.visible = on;
      });

    // Folder piles grow with the unread inbox.
    const unread = gs.inbox.filter((m) => !m.read).length;
    const folders = [...this.byName.keys()]
      .filter((n) => /^live_folder_\d+_\d+$/.test(n))
      .sort(folderOrder);
    const nFolders = Math.min(folders.length, 5 + Math.round(unread * 2.2));
    folders.forEach((n, i) => (this.byName.get(n)!.visible = i < nFolders));

    // Results, in order: cards for every fixture, a W/D/L sticker once played.
    const mine = gs.fixtures
      .filter((f) => f.homeId === gs.userClubId || f.awayId === gs.userClubId)
      .sort((a, b) => a.matchday - b.matchday);
    const outcome = mine.map((f) => {
      if (!f.result) return null;
      const home = f.homeId === gs.userClubId;
      const us = home ? f.result.homeGoals : f.result.awayGoals;
      const them = home ? f.result.awayGoals : f.result.homeGoals;
      return us > them ? 'W' : us === them ? 'D' : 'L';
    });
    const stickerMat = this.findMaterials(['StickerWin', 'StickerDraw', 'StickerLoss']);
    for (let i = 0; i < 24; i++) {
      const r = Math.floor(i / 4);
      const k = i % 4;
      const card = this.byName.get(`live_result_${r}_${k}`);
      const sticker = this.byName.get(`live_sticker_${r}_${k}`) as THREE.Mesh | undefined;
      if (card) card.visible = i < mine.length;
      if (sticker) {
        const o = outcome[i];
        sticker.visible = !!o;
        const m =
          o === 'W'
            ? stickerMat.StickerWin
            : o === 'D'
              ? stickerMat.StickerDraw
              : stickerMat.StickerLoss;
        if (o && m) sticker.material = m;
      }
    }

    // Coffee cups pile up through a losing run (and a heavy inbox).
    let losing = 0;
    for (let i = outcome.length - 1; i >= 0; i--) {
      const o = outcome[i];
      if (o === null) continue;
      if (o === 'L') losing++;
      else break;
    }
    const mugs = Math.min(5, 1 + losing + (unread > 6 ? 1 : 0));
    for (let i = 0; i < 5; i++) {
      show(`live_mug_${i}`, i < mugs);
    }

    // The chairman's sealed letter when the board is losing patience.
    show('live_letter', club.boardConfidence < 35);
    // A leak bucket while money is tight.
    const tight = club.balance < Math.max(0, club.wageBudget * 6);
    show('live_bucket', tight);
    show('live_leak_stain', tight);
    // The phone lights up when someone is waiting to talk.
    this.phoneBlink = !!gs.activeConversation || gs.inbox.some((m) => !m.read && m.requiresAction);
    if (this.phoneLight) this.phoneLight.visible = this.phoneBlink;

    // Trophies: the old cup is the club's; the shield is Manager of the Season; the ball is a hat-trick.
    show('live_trophy_shield', gs.awards?.managerOfTheSeason === gs.userClubId);
    const hatTrick = mine.some((f) => {
      if (!f.result) return false;
      const side = f.homeId === gs.userClubId ? 'home' : 'away';
      const counts = new Map<string, number>();
      for (const s of f.result.scorers) {
        if (s.side !== side || s.ownGoal) continue;
        counts.set(s.playerId, (counts.get(s.playerId) ?? 0) + 1);
      }
      return [...counts.values()].some((c) => c >= 3);
    });
    show('live_match_ball', hatTrick);

    // The back page: the latest story about us, else the latest story.
    const story =
      [...gs.news].reverse().find((n) => n.clubIds.includes(gs.userClubId)) ??
      gs.news[gs.news.length - 1];
    this.drawPaper(story?.headline ?? `${club.name} prepare for the new season`);
  }

  private findMaterials(names: string[]) {
    const out: Record<string, THREE.Material> = {};
    this.model?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && names.includes(m.name) && !out[m.name]) out[m.name] = m;
    });
    return out;
  }

  // --- Per frame -------------------------------------------------------------------------------------------

  public update(dt: number, beat: TimeOfDayBeat) {
    if (beat !== this.beat) this.applyBeat(beat);
    if (!this.model) return;
    this.t += dt;
    if (this.phoneLight && this.phoneBlink) this.phoneLight.visible = Math.sin(this.t * 6) > -0.2;
    if (this.cat) {
      // The cat breathes in its sleep.
      const s = 1 + Math.sin(this.t * 1.6) * 0.025;
      this.cat.scale.set(1, 1, s);
    }
  }
}

function materialName(mesh: THREE.Mesh): string {
  const m = mesh.material as THREE.Material | THREE.Material[];
  return Array.isArray(m) ? (m[0]?.name ?? '') : (m?.name ?? '');
}

/** Folders grow pile by pile: all first layers before any second layer. */
function folderOrder(a: string, b: string): number {
  const [, ai, ak] = a.match(/_(\d+)_(\d+)$/)!.map(Number) as [number, number, number];
  const [, bi, bk] = b.match(/_(\d+)_(\d+)$/)!.map(Number) as [number, number, number];
  return ak - bk || ai - bi;
}

function clubColors(): { primary: string; secondary: string } {
  if (typeof document === 'undefined') return { primary: '#8b1a1a', secondary: '#eeeae0' };
  const cs = getComputedStyle(document.documentElement);
  return {
    primary: cs.getPropertyValue('--club-primary').trim() || '#8b1a1a',
    secondary: cs.getPropertyValue('--club-secondary').trim() || '#eeeae0',
  };
}
