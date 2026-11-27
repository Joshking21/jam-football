// Local model viewer for reviewing Meshy / Blender models and recording turntables. Not part of the build.
//   npx vite --port 5199, then open http://localhost:5199/dev/model.html
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const FILES: [string, string][] = [
  ['Office · Friday evening (Blender)', '/assets/models/office/office.glb#evening'],
  ['Office · Monday morning (Blender)', '/assets/models/office/office.glb#morning'],
  ['Coach (game build)', '/assets/models/coach.glb'],
  ['Coach · walking (Meshy, rigged)', '/tests-ai/M-coach/coach_walking.glb'],
  ['Coach · running (Meshy, rigged)', '/tests-ai/M-coach/coach_running.glb'],
  ['Coach · rigged, A-pose', '/tests-ai/M-coach/coach_rigged.glb'],
  ['Coach · raw model', '/tests-ai/M-coach/coach.glb'],
  ['Player body (Blender)', '/assets/models/player.glb'],
];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1d21');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const key = new THREE.DirectionalLight('#fff1de', 2.4);
key.position.set(2.5, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2;
key.shadow.camera.right = 2;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -1;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight('#cfe0ff', 1.2);
rim.position.set(-3, 3, -3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4, 64),
  new THREE.MeshStandardMaterial({ color: '#2b2c2f', roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.3, 4.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 2.2;
controls.update();

const loader = new GLTFLoader();
const turn = new THREE.Group();
scene.add(turn);
let mixer: THREE.AnimationMixer | null = null;
let gltf: GLTF | null = null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileSel = $<HTMLSelectElement>('file');
const clipSel = $<HTMLSelectElement>('clip');
for (const [label, url] of FILES) fileSel.add(new Option(label, url));

// Rooms are shown at real size from inside, lit for a time of day; characters are normalised on the turntable.
const roomLights = new THREE.Group();
scene.add(roomLights);
let isRoom = false;
let roomMood: 'evening' | 'morning' = 'evening';

function lightRoom(root: THREE.Object3D) {
  roomLights.clear();
  const evening = roomMood === 'evening';
  scene.background = new THREE.Color(evening ? '#05070c' : '#9fb2c8');
  scene.environmentIntensity = evening ? 0.12 : 0.45;
  key.visible = rim.visible = floor.visible = false;
  // Window (west wall, x = -4): cool light coming in.
  const win = new THREE.RectAreaLight(evening ? '#8fb0ff' : '#dfe9ff', evening ? 2.2 : 9, 4.2, 1.8);
  win.position.set(-3.9, 1.75, 0);
  win.lookAt(0, 1.2, 0);
  roomLights.add(win);
  if (!evening) {
    const sun = new THREE.DirectionalLight('#fff4e6', 1.6);
    sun.position.set(-6, 5, 2);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    roomLights.add(sun, sun.target);
  }
  // Fittings in the model: light_* positions get real lights.
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const p = o.getWorldPosition(new THREE.Vector3());
    if (o.name.startsWith('light_downlight')) {
      const l = new THREE.SpotLight('#ffe9cf', evening ? 1.2 : 4, 6, Math.PI / 3, 0.7, 1.5);
      l.position.copy(p).y -= 0.05;
      l.target.position.set(p.x, 0, p.z);
      roomLights.add(l, l.target);
    } else if (o.name.startsWith('light_sconce_') && !o.name.includes('plate')) {
      const l = new THREE.PointLight('#ffb36b', evening ? 2.2 : 0, 4, 1.6);
      l.position.copy(p);
      roomLights.add(l);
    } else if (o.name === 'lamp_bulb') {
      const l = new THREE.PointLight('#ffbe78', evening ? 3.5 : 0.6, 3.5, 1.5);
      l.position.copy(p).y += 0.05;
      l.castShadow = true;
      roomLights.add(l);
    } else if (o.name === 'screen_table') {
      const l = new THREE.RectAreaLight('#6fe0b8', evening ? 1.4 : 0.6, 2.2, 1.3);
      l.position.copy(p).y += 0.05;
      l.lookAt(p.x, 3, p.z);
      roomLights.add(l);
    }
  });
  camera.fov = 62;
  camera.updateProjectionMatrix();
  camera.position.set(0, 2.3, -3.05);
  controls.target.set(0, 0.9, 1.7);
  controls.autoRotate = false;
  spin.classList.toggle('on', false);
  controls.update();
}

function show(g: GLTF) {
  turn.clear();
  gltf = g;
  const root = g.scene;
  if (isRoom) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = !/^(static_Glass|window_view|screen_)/.test(m.name);
        m.receiveShadow = true;
      }
    });
    turn.add(root);
    lightRoom(root);
    mixer = null;
    clipSel.innerHTML = '';
    clipSel.add(new Option('No clips', ''));
    return;
  }
  key.visible = rim.visible = true;
  floor.visible = groundBtn.classList.contains('on');
  roomLights.clear();
  scene.environmentIntensity = 0.55;
  scene.background = new THREE.Color($<HTMLSelectElement>('bg').value);
  camera.fov = 32;
  camera.updateProjectionMatrix();
  camera.position.set(0, 1.3, 4.6);
  controls.target.set(0, 0.95, 0);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      (m as THREE.SkinnedMesh).frustumCulled = false;
    }
  });
  // Normalise to 1.8 m tall, feet on the floor, centred.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = 1.8 / Math.max(size.y, 1e-3);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= b2.min.y;
  turn.add(root);

  mixer = new THREE.AnimationMixer(root);
  clipSel.innerHTML = '';
  clipSel.add(new Option(g.animations.length ? 'Pose (no clip)' : 'No clips', ''));
  g.animations.forEach((a, i) =>
    clipSel.add(new Option(a.name.replace(/^Armature\|/, ''), String(i))),
  );
  if (g.animations.length) {
    clipSel.value = '0';
    playClip(0);
  }
}

function playClip(i: number) {
  if (!mixer || !gltf) return;
  mixer.stopAllAction();
  const clip = gltf.animations[i];
  if (!clip) return;
  // Walk/run clips move forward: keep him in place so the turntable stays centred.
  const c = clip.clone();
  c.tracks.forEach((t) => {
    if (/Hips\.position$/.test(t.name)) {
      const v = t.values;
      for (let k = 0; k < v.length; k += 3) {
        v[k] = v[0]!;
        v[k + 2] = v[2]!;
      }
    }
  });
  mixer.clipAction(c).play();
}

function load(entry: string) {
  const [url, mood] = entry.split('#');
  isRoom = url!.includes('/office/');
  roomMood = mood === 'morning' ? 'morning' : 'evening';
  loader.load(url!, show, undefined, (e) => alert('Could not load ' + url + '\n' + e));
}

fileSel.onchange = () => load(fileSel.value);
clipSel.onchange = () => {
  if (clipSel.value === '') mixer?.stopAllAction();
  else playClip(Number(clipSel.value));
};
const spin = $<HTMLButtonElement>('spin');
spin.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  spin.classList.toggle('on', controls.autoRotate);
};
const groundBtn = $<HTMLButtonElement>('ground');
groundBtn.onclick = () => {
  floor.visible = !floor.visible;
  groundBtn.classList.toggle('on', floor.visible);
};
$<HTMLSelectElement>('bg').onchange = (e) => {
  scene.background = new THREE.Color((e.target as HTMLSelectElement).value);
};
addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    $('ui').classList.toggle('hidden');
    $('hint').classList.toggle('hidden');
  }
  if (e.key === ' ') spin.click();
});

// Drag and drop any .glb
const drop = $('drop');
addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.style.display = 'grid';
});
addEventListener('dragleave', () => (drop.style.display = 'none'));
addEventListener('drop', (e) => {
  e.preventDefault();
  drop.style.display = 'none';
  const f = e.dataTransfer?.files[0];
  if (!f) return;
  f.arrayBuffer().then((buf) => loader.parse(buf, '', show));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  mixer?.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

const startFile = new URLSearchParams(location.search).get('f') ?? FILES[0]![1];
fileSel.value = startFile;
load(startFile);
