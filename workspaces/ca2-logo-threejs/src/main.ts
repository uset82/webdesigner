/**
 * Full 3D CA² monogram viewer — free orbit + auto studio rock (M9 bayonet energy).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCA2MonogramLogoModel } from './createCA2MonogramLogoModel';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('#app missing');

const zoomInBtn = document.querySelector<HTMLButtonElement>('#zoom-in');
const zoomOutBtn = document.querySelector<HTMLButtonElement>('#zoom-out');
const zoomResetBtn = document.querySelector<HTMLButtonElement>('#zoom-reset');
const zoomLevelEl = document.querySelector<HTMLElement>('#zoom-level');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Near-black radial stage like the bayonet showcase
{
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(size * 0.5, size * 0.45, size * 0.05, size * 0.5, size * 0.5, size * 0.7);
  g.addColorStop(0, '#0c1428');
  g.addColorStop(1, '#03060e');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const bg = new THREE.CanvasTexture(cv);
  bg.colorSpace = THREE.SRGBColorSpace;
  scene.background = bg;
}

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 1.05;

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 60);
const LOOK = new THREE.Vector3(0, 0.05, 0);
const DEFAULT_DIST = 5.2;
const MIN_DIST = 1.8;
const MAX_DIST = 14;
let targetDist = DEFAULT_DIST;
let dist = DEFAULT_DIST;
// Start at a ¾ angle so thickness is obvious (full 3D read)
let theta = 0.55;
let phi = 1.15;
let targetTheta = theta;
let targetPhi = phi;

function placeCamera() {
  const x = dist * Math.sin(phi) * Math.sin(theta);
  const y = dist * Math.cos(phi);
  const z = dist * Math.sin(phi) * Math.cos(theta);
  camera.position.set(x + LOOK.x, y + LOOK.y, z + LOOK.z);
  camera.lookAt(LOOK);
}
placeCamera();

// Bayonet-style 3-point + warm gold key
const key = new THREE.DirectionalLight(0xfff0d8, 2.8);
key.position.set(3.2, 4.2, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 28;
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0004;
scene.add(key);

const fill = new THREE.DirectionalLight(0x8fb6ff, 0.85);
fill.position.set(-3.5, 1.2, 2.5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffc86a, 1.7);
rim.position.set(-1.5, 2.2, -4);
scene.add(rim);

scene.add(new THREE.AmbientLight(0x1a2238, 0.35));
scene.add(new THREE.HemisphereLight(0xffe8c0, 0x080e1a, 0.45));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.ShadowMaterial({ opacity: 0.48 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.65;
ground.receiveShadow = true;
scene.add(ground);

const model = createCA2MonogramLogoModel(undefined, {
  castShadow: true,
  receiveShadow: true,
});
// Pivot slightly so rock feels centered
model.position.y = 0.05;
scene.add(model);

// Free orbit (pointer)
let dragging = false;
let lastX = 0;
let lastY = 0;
let autoRock = true;
const el = renderer.domElement;

el.addEventListener('pointerdown', (e) => {
  dragging = true;
  autoRock = false; // user takes over
  lastX = e.clientX;
  lastY = e.clientY;
  el.setPointerCapture(e.pointerId);
});
el.addEventListener('pointerup', (e) => {
  dragging = false;
  try {
    el.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  // resume gentle rock after a pause
  window.setTimeout(() => {
    if (!dragging) autoRock = true;
  }, 2200);
});
el.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  targetTheta -= dx * 0.006;
  targetPhi = THREE.MathUtils.clamp(targetPhi + dy * 0.0045, 0.25, Math.PI - 0.25);
});
el.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    targetDist = THREE.MathUtils.clamp(targetDist + e.deltaY * 0.0038, MIN_DIST, MAX_DIST);
    updateZoomReadout();
  },
  { passive: false },
);

function setZoom(d: number) {
  targetDist = THREE.MathUtils.clamp(d, MIN_DIST, MAX_DIST);
  updateZoomReadout();
}
function updateZoomReadout() {
  if (!zoomLevelEl) return;
  zoomLevelEl.textContent = `${Math.round((DEFAULT_DIST / targetDist) * 100)}%`;
}
zoomInBtn?.addEventListener('click', () => setZoom(targetDist - 0.45));
zoomOutBtn?.addEventListener('click', () => setZoom(targetDist + 0.45));
zoomResetBtn?.addEventListener('click', () => {
  targetDist = DEFAULT_DIST;
  targetTheta = 0.55;
  targetPhi = 1.15;
  autoRock = true;
  updateZoomReadout();
});
updateZoomReadout();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Continuous Y spin option when idle + rock
let spinBoost = 0;
const clock = new THREE.Clock();
let rockT = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  rockT += dt;

  theta += (targetTheta - theta) * Math.min(1, dt * 10);
  phi += (targetPhi - phi) * Math.min(1, dt * 10);
  dist += (targetDist - dist) * Math.min(1, dt * 8);
  placeCamera();

  if (autoRock && !dragging) {
    // Slow continuous turntable + gentle rock (bayonet vibe)
    targetTheta += dt * 0.22;
    model.rotation.x = Math.sin(rockT * 0.55) * 0.12;
    model.rotation.z = Math.sin(rockT * 0.4) * 0.06;
    spinBoost = Math.min(1, spinBoost + dt * 0.5);
  } else {
    model.rotation.x *= 0.92;
    model.rotation.z *= 0.92;
    spinBoost *= 0.9;
  }
  model.rotation.y = 0; // yaw owned by camera orbit around model

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
