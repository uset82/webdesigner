import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCA2MonogramLogoModelAsync } from './createCA2MonogramLogoModel';

const canvasHost = document.querySelector<HTMLDivElement>('#app');
if (!canvasHost) {
  throw new Error('#app missing');
}

const zoomInBtn = document.querySelector<HTMLButtonElement>('#zoom-in');
const zoomOutBtn = document.querySelector<HTMLButtonElement>('#zoom-out');
const zoomResetBtn = document.querySelector<HTMLButtonElement>('#zoom-reset');
const zoomLevelEl = document.querySelector<HTMLElement>('#zoom-level');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050d1a);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 50);

// Dolly zoom along camera forward axis (Z)
const LOOK_AT = new THREE.Vector3(0, -0.05, 0);
const DEFAULT_DISTANCE = 4.1;
const MIN_DISTANCE = 1.55;
const MAX_DISTANCE = 8.5;
const ZOOM_STEP = 0.42;

let targetDistance = DEFAULT_DISTANCE;
let distance = DEFAULT_DISTANCE;

function applyCameraDistance(d: number) {
  // Keep camera on a fixed orbit shell offset; rotation is on the model
  camera.position.set(0, LOOK_AT.y, d);
  camera.lookAt(LOOK_AT);
}

applyCameraDistance(distance);

function setZoomDistance(next: number, immediate = false) {
  targetDistance = THREE.MathUtils.clamp(next, MIN_DISTANCE, MAX_DISTANCE);
  if (immediate) {
    distance = targetDistance;
    applyCameraDistance(distance);
  }
  updateZoomReadout();
}

function zoomBy(delta: number) {
  setZoomDistance(targetDistance + delta);
}

function zoomFactor(): number {
  // 100% at default; higher when closer
  return DEFAULT_DISTANCE / Math.max(targetDistance, 0.001);
}

function updateZoomReadout() {
  if (!zoomLevelEl) return;
  zoomLevelEl.textContent = `${Math.round(zoomFactor() * 100)}%`;
}

// Balanced studio lighting
const ambient = new THREE.AmbientLight(0x3a4560, 0.45);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xfff0d4, 0x0a1528, 0.7);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff2dc, 2.35);
key.position.set(2.6, 3.6, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const fill = new THREE.DirectionalLight(0x9eb0d8, 0.75);
fill.position.set(-3.5, 1.2, 2.8);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd89a, 1.35);
rim.position.set(-1.8, 2.0, -3.2);
scene.add(rim);

const point = new THREE.PointLight(0xffe4b0, 1.4, 10, 2);
point.position.set(0.5, 1.0, 2.0);
scene.add(point);

const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
const envRT = pmrem.fromScene(roomEnv, 0.04);
scene.environment = envRT.texture;
if ('environmentIntensity' in scene) {
  (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 1.05;
}

let model: THREE.Group = new THREE.Group();
scene.add(model);

createCA2MonogramLogoModelAsync(undefined, {
  castShadow: true,
  receiveShadow: true,
  showWordmark: true,
  qualityPriority: 'reference-fidelity',
}).then((built) => {
  scene.remove(model);
  model = built;
  scene.add(model);
  (window as unknown as { __ca2: unknown }).__ca2 = {
    scene,
    camera,
    model,
    renderer,
    zoomIn: () => zoomBy(-ZOOM_STEP),
    zoomOut: () => zoomBy(ZOOM_STEP),
    zoomReset: resetView,
  };
});

let targetRotY = 0.22;
let targetRotX = -0.06;
let rotY = targetRotY;
let rotX = targetRotX;
let dragging = false;
let lastX = 0;
let lastY = 0;

// ——— Orbit (pointer drag) ———
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && e.isPrimary === false) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointerup', (e) => {
  dragging = false;
  try {
    renderer.domElement.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
});
renderer.domElement.addEventListener('pointercancel', () => {
  dragging = false;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  // Don't orbit while pinching
  if (activePinch) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  targetRotY += dx * 0.005;
  targetRotX += dy * 0.0035;
  targetRotX = Math.max(-0.4, Math.min(0.4, targetRotX));
  targetRotY = Math.max(-0.85, Math.min(0.85, targetRotY));
});

// ——— Mouse wheel zoom ———
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    // Smooth, distance-proportional wheel zoom
    const dir = Math.sign(e.deltaY);
    const amount = Math.min(1.2, Math.abs(e.deltaY) / 100) * ZOOM_STEP * 0.85;
    zoomBy(dir * amount);
  },
  { passive: false },
);

// ——— Pinch zoom (touch) ———
let activePinch = false;
let pinchStartDist = 0;
let pinchStartZoom = DEFAULT_DISTANCE;

function touchDistance(a: Touch, b: Touch): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

renderer.domElement.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length === 2) {
      activePinch = true;
      dragging = false;
      pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
      pinchStartZoom = targetDistance;
      e.preventDefault();
    }
  },
  { passive: false },
);

renderer.domElement.addEventListener(
  'touchmove',
  (e) => {
    if (!activePinch || e.touches.length < 2) return;
    e.preventDefault();
    const dist = touchDistance(e.touches[0], e.touches[1]);
    if (pinchStartDist < 1) return;
    // Spread fingers → zoom in (smaller camera distance)
    const ratio = pinchStartDist / dist;
    setZoomDistance(pinchStartZoom * ratio);
  },
  { passive: false },
);

renderer.domElement.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) activePinch = false;
});
renderer.domElement.addEventListener('touchcancel', () => {
  activePinch = false;
});

// ——— UI buttons ———
function resetView() {
  targetRotY = 0.22;
  targetRotX = -0.06;
  setZoomDistance(DEFAULT_DISTANCE);
}

zoomInBtn?.addEventListener('click', () => zoomBy(-ZOOM_STEP));
zoomOutBtn?.addEventListener('click', () => zoomBy(ZOOM_STEP));
zoomResetBtn?.addEventListener('click', resetView);

// Keyboard: + / = zoom in, - zoom out, 0 reset
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    zoomBy(-ZOOM_STEP);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    zoomBy(ZOOM_STEP);
  } else if (e.key === '0') {
    e.preventDefault();
    resetView();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateZoomReadout();

const clock = new THREE.Clock();

function frame() {
  const t = clock.getElapsedTime();
  rotY += (targetRotY - rotY) * 0.1;
  rotX += (targetRotX - rotX) * 0.1;

  // Smooth dolly zoom
  distance += (targetDistance - distance) * 0.12;
  applyCameraDistance(distance);

  const idleY = dragging || activePinch ? 0 : Math.sin(t * 0.25) * 0.04;
  model.rotation.y = rotY + idleY;
  model.rotation.x = rotX;
  model.position.y = Math.sin(t * 0.7) * 0.01;

  key.intensity = 2.25 + Math.sin(t * 1.2) * 0.12;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

frame();

(window as unknown as { __ca2: unknown }).__ca2 = {
  scene,
  camera,
  model,
  renderer,
  zoomIn: () => zoomBy(-ZOOM_STEP),
  zoomOut: () => zoomBy(ZOOM_STEP),
  zoomReset: resetView,
};
