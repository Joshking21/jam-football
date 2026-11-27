// Local model viewer for reviewing Meshy / Blender models and recording turntables. Not part of the build.
//   npx vite --port 5199, then open http://localhost:5199/dev/model.html
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FILES: [string, string][] = [
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

function show(g: GLTF) {
  turn.clear();
  gltf = g;
  const root = g.scene;
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

function load(url: string) {
  loader.load(url, show, undefined, (e) => alert('Could not load ' + url + '\n' + e));
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
