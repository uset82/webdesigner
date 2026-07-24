/**
 * Standalone studio viewer for the img2threejs v1.3 M9 Bayonet | Doppler Phase 2 build.
 * Quality bar: solid extruded geometry + projected reference crops — not a flat emboss plate.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createM9DopplerModel,
  createM9DopplerLookDevLights,
  makeM9DopplerBackground,
} from './createM9DopplerModel';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('#app missing');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeM9DopplerBackground();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 40);
const LOOK = new THREE.Vector3(0, 0, 0);
const DEFAULT_DIST = 5.2;
let targetDist = DEFAULT_DIST;
let dist = DEFAULT_DIST;

// Spherical orbit state (matches showcase framing)
let theta = 0.08; // yaw
let phi = 1.28; // polar
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

scene.add(createM9DopplerLookDevLights());
const knife = createM9DopplerModel({ shadows: true });
// Centre the model for orbit (blade runs along +X)
knife.position.set(-0.35, 0, 0);
scene.add(knife);

// Pointer orbit
let dragging = false;
let lastX = 0;
let lastY = 0;
const el = renderer.domElement;

el.addEventListener('pointerdown', (e) => {
  dragging = true;
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
});
el.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  targetTheta -= dx * 0.0055;
  targetPhi = THREE.MathUtils.clamp(targetPhi + dy * 0.0045, 0.25, Math.PI - 0.25);
});
el.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    targetDist = THREE.MathUtils.clamp(targetDist + e.deltaY * 0.0035, 1.8, 10);
  },
  { passive: false },
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  const dt = Math.min(clock.getDelta(), 0.05);

  // smooth orbit / zoom
  theta += (targetTheta - theta) * Math.min(1, dt * 10);
  phi += (targetPhi - phi) * Math.min(1, dt * 10);
  dist += (targetDist - dist) * Math.min(1, dt * 8);
  placeCamera();

  // Slow studio rock (showcase live behaviour)
  knife.rotation.y = Math.sin(t * 0.35) * 0.22;
  knife.rotation.z = Math.sin(t * 0.28) * 0.06;
  knife.rotation.x = Math.sin(t * 0.22) * 0.04;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
