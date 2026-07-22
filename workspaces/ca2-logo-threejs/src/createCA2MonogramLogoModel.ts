/**
 * CA² monogram — embossed gold from brand PNG.
 * Preserves original highlight/shadow in the texture (not flat yellow).
 */
import * as THREE from 'three';
import logoUrl from '../ref/logo-reference.png';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  showWordmark?: boolean;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

const NAVY = 0x050d1a;

function processLogoToCanvas(image: HTMLImageElement): {
  color: HTMLCanvasElement;
  alpha: HTMLCanvasElement;
  width: number;
  height: number;
} {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(image, 0, 0);
  const { data } = sctx.getImageData(0, 0, width, height);

  const color = document.createElement('canvas');
  color.width = width;
  color.height = height;
  const cctx = color.getContext('2d')!;
  const colorImg = cctx.createImageData(width, height);

  const alpha = document.createElement('canvas');
  alpha.width = width;
  alpha.height = height;
  const actx = alpha.getContext('2d')!;
  const alphaImg = actx.createImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const warm = r + g * 0.55 - b * 0.85;
    // Keep soft AA edges of the gold emboss; reject navy field
    const isGold = luma > 26 && warm > 6 && r + 10 >= b;

    let a = 0;
    let outR = r;
    let outG = g;
    let outB = b;

    if (isGold) {
      // Smooth alpha from edge fringes → solid gold
      const edge = Math.min(1, Math.max(0, (luma - 18) / 40));
      a = Math.floor(30 + edge * 225);

      // Mild lift only — preserve emboss shading from the render
      outR = Math.min(255, Math.floor(r * 1.12 + 10));
      outG = Math.min(255, Math.floor(g * 1.08 + 6));
      outB = Math.min(255, Math.floor(b * 1.02 + 2));
    }

    colorImg.data[i] = outR;
    colorImg.data[i + 1] = outG;
    colorImg.data[i + 2] = outB;
    colorImg.data[i + 3] = a;

    alphaImg.data[i] = a;
    alphaImg.data[i + 1] = a;
    alphaImg.data[i + 2] = a;
    alphaImg.data[i + 3] = 255;
  }

  cctx.putImageData(colorImg, 0, 0);
  actx.putImageData(alphaImg, 0, 0);
  return { color, alpha, width, height };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function makeCanvasTexture(canvas: HTMLCanvasElement, colorSpace?: THREE.ColorSpace): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace ?? THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function cropRegion(
  image: HTMLImageElement,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
): HTMLCanvasElement {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const cropX = Math.floor(w * nx);
  const cropY = Math.floor(h * ny);
  const cropW = Math.floor(w * nw);
  const cropH = Math.floor(h * nh);
  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas;
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
  });
}

/**
 * Single-plane emboss card: keeps original gold shading, metal response via IBL.
 * One layer avoids ghost doubles from stacked transparent planes.
 */
function createEmbossedPlate(
  processed: { color: HTMLCanvasElement; alpha: HTMLCanvasElement; width: number; height: number },
  worldWidth: number,
  options?: ProceduralModelOptions,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'embossed-plate';

  const aspect = processed.width / Math.max(1, processed.height);
  const worldHeight = worldWidth / aspect;

  const colorMap = makeCanvasTexture(processed.color);
  const alphaMap = makeCanvasTexture(processed.alpha, THREE.NoColorSpace);

  // Primary face — standard material reads textured gold reliably
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: colorMap,
    alphaMap,
    transparent: true,
    alphaTest: 0.04,
    metalness: 0.72,
    roughness: 0.32,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.65,
    // Subtle warm self-illumination so recesses still read without going flat yellow
    emissive: 0xffffff,
    emissiveMap: colorMap,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: true,
    wireframe: options?.wireframe ?? false,
  });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), mat);
  face.name = 'emboss-face';
  face.castShadow = options?.castShadow ?? true;
  face.receiveShadow = options?.receiveShadow ?? true;
  group.add(face);

  // Thin dark-gold backplane slightly larger — edge rim when orbiting (no ghost body)
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a18,
    metalness: 0.85,
    roughness: 0.4,
    envMapIntensity: 1.2,
    alphaMap,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    wireframe: options?.wireframe ?? false,
  });
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth * 1.008, worldHeight * 1.008),
    rimMat,
  );
  rim.position.z = -0.028;
  rim.name = 'emboss-rim';
  rim.castShadow = options?.castShadow ?? true;
  group.add(rim);

  group.userData.plateSize = { width: worldWidth, height: worldHeight };
  return group;
}

function createProceduralFallback(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'procedural-fallback';
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    metalness: 0.85,
    roughness: 0.3,
    envMapIntensity: 1.8,
  });
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 24, 96, Math.PI * 1.45), gold);
  crescent.rotation.z = Math.PI * 0.28;
  g.add(crescent);
  return g;
}

export async function createCA2MonogramLogoModelAsync(
  _spec?: unknown,
  options: ProceduralModelOptions = {},
): Promise<THREE.Group> {
  const root = new THREE.Group();
  root.name = 'CA2MonogramLogo';

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};

  // Deep navy field matching brand sheet (not flat mid-blue)
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshStandardMaterial({
      color: NAVY,
      metalness: 0,
      roughness: 1,
      emissive: 0x06101c,
      emissiveIntensity: 0.35,
    }),
  );
  backdrop.position.set(0, 0, -0.2);
  backdrop.name = 'backdrop-plate';
  backdrop.receiveShadow = true;
  root.add(backdrop);
  nodes[backdrop.name] = backdrop;
  meshes[backdrop.name] = backdrop;

  // Subtle center spotlight on the field (vignette feel without a gray oval prop)
  const wash = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0x1a2d52,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  wash.position.set(0, 0.15, -0.18);
  wash.name = 'field-wash';
  root.add(wash);

  const monogram = new THREE.Group();
  monogram.name = 'monogram-group';
  monogram.position.set(0, 0.38, 0);
  root.add(monogram);
  nodes[monogram.name] = monogram;

  try {
    const image = await loadImage(logoUrl);

    // Hero monogram only (upper artboard)
    const heroCanvas = cropRegion(image, 0.12, 0.09, 0.78, 0.57);
    const heroImg = await canvasToImage(heroCanvas);
    const processed = processLogoToCanvas(heroImg);
    const plate = createEmbossedPlate(processed, 2.7, options);
    plate.name = 'hero-monogram';
    monogram.add(plate);
    nodes[plate.name] = plate;
    plate.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        meshes[obj.name || `m-${Object.keys(meshes).length}`] = obj as THREE.Mesh;
      }
    });

    if (options.showWordmark !== false) {
      const lockupCanvas = cropRegion(image, 0.08, 0.74, 0.84, 0.22);
      const lockupImg = await canvasToImage(lockupCanvas);
      const lockupProcessed = processLogoToCanvas(lockupImg);
      const lockup = createEmbossedPlate(lockupProcessed, 3.55, options);
      lockup.name = 'lockup';
      lockup.position.set(0, -1.55, 0.02);
      root.add(lockup);
      nodes[lockup.name] = lockup;
    }
  } catch (err) {
    console.warn('[CA2] Reference emboss failed', err);
    monogram.add(createProceduralFallback());
  }

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets: { orbitPivot: root, monogramCenter: monogram },
    colliders: { root: { type: 'box', size: [2.8, 2.8, 0.35] } },
    destructionGroups: { monogram: [monogram] },
  } satisfies ProceduralModelRuntime;
  root.userData.modelId = 'CA2MonogramLogo';
  root.userData.source = 'img2threejs-reference-emboss';

  return root;
}

export function createCA2MonogramLogoModel(
  _spec?: unknown,
  options: ProceduralModelOptions = {},
): THREE.Group {
  const placeholder = new THREE.Group();
  placeholder.name = 'CA2MonogramLogo';
  placeholder.userData.loading = true;

  createCA2MonogramLogoModelAsync(_spec, options)
    .then((model) => {
      while (model.children.length > 0) {
        placeholder.add(model.children[0]);
      }
      placeholder.userData = { ...model.userData, loading: false };
      placeholder.name = model.name;
    })
    .catch((err) => {
      console.error(err);
      placeholder.add(createProceduralFallback());
      placeholder.userData.loading = false;
    });

  return placeholder;
}

export default createCA2MonogramLogoModel;
