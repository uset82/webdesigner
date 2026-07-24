/**
 * CA² monogram — full solid 3D (img2threejs-style).
 *
 * 1. Key gold from brand PNG
 * 2. Trace silhouette contours from alpha
 * 3. Extrude + bevel → real metal volume (orbit any angle like the M9 bayonet)
 * 4. Project reference gold shading onto front faces
 */
import * as THREE from 'three';

const logoUrl = `${import.meta.env.BASE_URL}ref/logo-reference.png`;

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

// ---------- image prep ----------

function processLogo(image: HTMLImageElement): {
  color: HTMLCanvasElement;
  alpha: Uint8ClampedArray;
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
  const alpha = new Uint8ClampedArray(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const warm = r + g * 0.55 - b * 0.85;
    const isGold = luma > 22 && warm > 4 && r + 14 >= b;

    let a = 0;
    if (isGold) {
      const edge = Math.min(1, Math.max(0, (luma - 14) / 40));
      a = Math.floor(40 + edge * 215);
      colorImg.data[i] = Math.min(255, Math.floor(r * 1.08 + 6));
      colorImg.data[i + 1] = Math.min(255, Math.floor(g * 1.05 + 4));
      colorImg.data[i + 2] = Math.min(255, Math.floor(b * 1.02 + 2));
      colorImg.data[i + 3] = 255;
    } else {
      colorImg.data[i] = 0;
      colorImg.data[i + 1] = 0;
      colorImg.data[i + 2] = 0;
      colorImg.data[i + 3] = 0;
    }
    alpha[p] = a > 40 ? 255 : 0;
  }
  cctx.putImageData(colorImg, 0, 0);
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

function downsampleAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  maxDim: number,
): { data: Uint8Array; width: number; height: number; scale: number } {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const nw = Math.max(8, Math.round(w * scale));
  const nh = Math.max(8, Math.round(h * scale));
  const data = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) * (w / nw)));
      const sy = Math.min(h - 1, Math.floor((y + 0.5) * (h / nh)));
      data[y * nw + x] = alpha[sy * w + sx] > 128 ? 1 : 0;
    }
  }
  return { data, width: nw, height: nh, scale };
}

// ---------- contour trace (Moore neighbor) ----------

type Pt = { x: number; y: number };

function extractContours(
  bin: Uint8Array,
  w: number,
  h: number,
): { outer: Pt[][]; holes: Pt[][] } {
  const visited = new Uint8Array(w * h);
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? bin[y * w + x] : 0;

  // 8-connected Moore: start looking from left of first solid
  const dirs: Pt[] = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ];

  function trace(sx: number, sy: number): Pt[] {
    const path: Pt[] = [];
    let x = sx;
    let y = sy;
    // entry direction: came from left
    let dir = 0; // start search from right of previous
    const maxSteps = w * h * 4;
    for (let step = 0; step < maxSteps; step++) {
      path.push({ x, y });
      visited[y * w + x] = 1;
      // start search from dir+6 (back-left relative) for Moore
      let found = false;
      for (let k = 0; k < 8; k++) {
        const nd = (dir + 6 + k) % 8;
        const nx = x + dirs[nd].x;
        const ny = y + dirs[nd].y;
        if (at(nx, ny)) {
          x = nx;
          y = ny;
          dir = nd;
          found = true;
          break;
        }
      }
      if (!found) break;
      if (x === sx && y === sy && path.length > 8) break;
    }
    return path;
  }

  // Flood-fill components, then trace boundary of each
  const components: { pixels: Pt[]; minX: number; maxX: number; minY: number; maxY: number; area: number }[] = [];
  const seen = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i] || seen[i]) continue;
      const q: Pt[] = [{ x, y }];
      seen[i] = 1;
      const pixels: Pt[] = [];
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      while (q.length) {
        const p = q.pop()!;
        pixels.push(p);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        for (const d of dirs) {
          const nx = p.x + d.x;
          const ny = p.y + d.y;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!bin[ni] || seen[ni]) continue;
          seen[ni] = 1;
          q.push({ x: nx, y: ny });
        }
      }
      if (pixels.length > 40) {
        components.push({ pixels, minX, maxX, minY, maxY, area: pixels.length });
      }
    }
  }

  components.sort((a, b) => b.area - a.area);

  // For each component, find leftmost boundary pixel and Moore-trace
  const contours: { path: Pt[]; area: number }[] = [];
  for (const c of components) {
    let start: Pt | null = null;
    for (let y = c.minY; y <= c.maxY && !start; y++) {
      for (let x = c.minX; x <= c.maxX; x++) {
        if (!at(x, y)) continue;
        // edge pixel
        if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) {
          start = { x, y };
          break;
        }
      }
    }
    if (!start) continue;
    const path = trace(start.x, start.y);
    if (path.length > 12) contours.push({ path, area: c.area });
  }

  if (!contours.length) return { outer: [], holes: [] };

  // Largest = outer; others that sit inside its bbox = holes (simplified)
  const main = contours[0];
  const outer = [simplify(main.path, 1.2)];
  const holes: Pt[][] = [];
  for (let i = 1; i < Math.min(contours.length, 12); i++) {
    const c = contours[i];
    if (c.area < main.area * 0.002) continue;
    if (c.area > main.area * 0.45) {
      // second large island (e.g. wordmark separate) — treat as another outer
      outer.push(simplify(c.path, 1.2));
    } else {
      holes.push(simplify(c.path, 1.0));
    }
  }
  return { outer, holes };
}

function simplify(path: Pt[], eps: number): Pt[] {
  if (path.length < 4) return path;
  // Ramer-Douglas-Peucker-ish on closed path
  const pts = path.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let maxI = a;
    const ax = pts[a].x,
      ay = pts[a].y,
      bx = pts[b].x,
      by = pts[b].y;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d =
        Math.abs((by - ay) * pts[i].x - (bx - ax) * pts[i].y + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > eps) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : path;
}

function pixelToWorld(
  p: Pt,
  imgW: number,
  imgH: number,
  worldW: number,
): THREE.Vector2 {
  const aspect = imgW / imgH;
  const worldH = worldW / aspect;
  // Image Y down → world Y up; center origin
  const x = (p.x / imgW - 0.5) * worldW;
  const y = (0.5 - p.y / imgH) * worldH;
  return new THREE.Vector2(x, y);
}

function contoursToShapes(
  contours: { outer: Pt[][]; holes: Pt[][] },
  maskW: number,
  maskH: number,
  fullW: number,
  fullH: number,
  worldW: number,
): THREE.Shape[] {
  const sx = fullW / maskW;
  const sy = fullH / maskH;
  const shapes: THREE.Shape[] = [];

  for (const ring of contours.outer) {
    if (ring.length < 3) continue;
    const shape = new THREE.Shape();
    const w0 = pixelToWorld(
      { x: ring[0].x * sx, y: ring[0].y * sy },
      fullW,
      fullH,
      worldW,
    );
    shape.moveTo(w0.x, w0.y);
    for (let i = 1; i < ring.length; i++) {
      const w = pixelToWorld(
        { x: ring[i].x * sx, y: ring[i].y * sy },
        fullW,
        fullH,
        worldW,
      );
      shape.lineTo(w.x, w.y);
    }
    shape.closePath();

    // Holes that fall inside this outer bbox
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    for (const hole of contours.holes) {
      const cx = hole.reduce((s, p) => s + p.x, 0) / hole.length;
      const cy = hole.reduce((s, p) => s + p.y, 0) / hole.length;
      if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue;
      const path = new THREE.Path();
      const h0 = pixelToWorld(
        { x: hole[0].x * sx, y: hole[0].y * sy },
        fullW,
        fullH,
        worldW,
      );
      path.moveTo(h0.x, h0.y);
      for (let i = 1; i < hole.length; i++) {
        const hw = pixelToWorld(
          { x: hole[i].x * sx, y: hole[i].y * sy },
          fullW,
          fullH,
          worldW,
        );
        path.lineTo(hw.x, hw.y);
      }
      path.closePath();
      shape.holes.push(path);
    }
    shapes.push(shape);
  }
  return shapes;
}

function makeFrontTexture(color: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(color);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

function assignPlanarUVs(geo: THREE.BufferGeometry, worldW: number, worldH: number) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  // Prefer full logo UV space centered
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv[i * 2] = x / worldW + 0.5;
    uv[i * 2 + 1] = y / worldH + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  void bb;
}

// ---------- model ----------

export async function createCA2MonogramLogoModelAsync(
  _spec?: unknown,
  options: ProceduralModelOptions = {},
): Promise<THREE.Group> {
  const root = new THREE.Group();
  root.name = 'CA2MonogramLogo';
  const cast = options.castShadow ?? true;
  const receive = options.receiveShadow ?? true;
  const wire = options.wireframe ?? false;

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};

  const image = await loadImage(logoUrl);
  const { color, alpha, width, height } = processLogo(image);

  // Solid extrude resolution
  const mask = downsampleAlpha(alpha, width, height, 360);
  const contours = extractContours(mask.data, mask.width, mask.height);
  const worldW = 3.8;
  const aspect = width / height;
  const worldH = worldW / aspect;

  const shapes = contoursToShapes(
    contours,
    mask.width,
    mask.height,
    width,
    height,
    worldW,
  );

  if (!shapes.length) {
    throw new Error('No silhouette contours found in logo reference');
  }

  const depth = 0.16; // real thickness like a metal badge
  const frontMap = makeFrontTexture(color);

  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: frontMap,
    metalness: 0.82,
    roughness: 0.26,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.75,
    emissive: 0xffffff,
    emissiveMap: frontMap,
    emissiveIntensity: 0.08,
    side: THREE.FrontSide,
    wireframe: wire,
  });

  const sideMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8922a,
    metalness: 0.95,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.45,
    wireframe: wire,
  });

  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a6a18,
    metalness: 0.9,
    roughness: 0.4,
    envMapIntensity: 1.2,
    wireframe: wire,
  });

  const solid = new THREE.Group();
  solid.name = 'solid-logo';

  shapes.forEach((shape, idx) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelOffset: 0,
      bevelSegments: 3,
      curveSegments: 8,
      steps: 1,
    });
    geo.translate(0, 0, -depth / 2);
    assignPlanarUVs(geo, worldW, worldH);
    geo.computeVertexNormals();

    // Front uses textured gold; sides/back use solid metal via groups if possible
    // ExtrudeGeometry: use multi-material groups (front / side / back)
    // three.js sets groups: 0 = lid, 1 = sides often — not always reliable.
    // Simpler: single faceMat for whole mesh (texture on sides stretches ok enough)
    // Plus a darker back plane slightly behind for read under orbit
    const mesh = new THREE.Mesh(geo, faceMat);
    mesh.name = `extrude-${idx}`;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    solid.add(mesh);
    meshes[mesh.name] = mesh;

    // Side shell: slightly larger dark-gold extrude behind for rim catch
    const rimShape = shape.clone();
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: depth * 0.92,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 6,
      steps: 1,
    });
    rimGeo.translate(0, 0, -depth / 2 - 0.012);
    const rim = new THREE.Mesh(rimGeo, sideMat);
    rim.name = `rim-${idx}`;
    rim.castShadow = cast;
    solid.add(rim);
    meshes[rim.name] = rim;
  });

  // Back cap (reads as solid metal from behind)
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW * 0.98, worldH * 0.98),
    backMat,
  );
  back.position.z = -depth / 2 - 0.02;
  back.rotation.y = Math.PI;
  back.name = 'back-plate';
  // Only slightly smaller — masked feel via dark gold
  solid.add(back);
  meshes.back = back;

  root.add(solid);
  nodes.solid = solid;

  // Soft navy stage disc (not a huge wall)
  const stage = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 64),
    new THREE.MeshStandardMaterial({
      color: NAVY,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x07101c,
      emissiveIntensity: 0.22,
    }),
  );
  stage.position.z = -0.22;
  stage.name = 'stage';
  stage.receiveShadow = true;
  root.add(stage);
  nodes.stage = stage;
  meshes.stage = stage;

  // Contact shadow blob
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 48),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  blob.position.set(0, 0, -0.2);
  blob.name = 'contact-shadow';
  root.add(blob);

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets: {
      orbitPivot: root,
      front: (() => {
        const o = new THREE.Object3D();
        o.position.set(0, 0, depth / 2);
        root.add(o);
        return o;
      })(),
    },
    colliders: { logo: { type: 'box', size: [worldW, worldH, depth] } },
    destructionGroups: { logo: [solid] },
  } satisfies ProceduralModelRuntime;
  root.userData.modelId = 'CA2MonogramLogo';
  root.userData.source = 'img2threejs-v1.3-solid-extrude-from-alpha';
  root.userData.reconstructionPass = 'v4-full-3d-extrude';
  root.userData.dimensions = { worldW, worldH, depth };

  return root;
}

export function createCA2MonogramLogoModel(
  _spec?: unknown,
  options: ProceduralModelOptions = {},
): THREE.Group {
  const holder = new THREE.Group();
  holder.name = 'CA2MonogramLogo';
  holder.userData.loading = true;

  createCA2MonogramLogoModelAsync(_spec, options)
    .then((model) => {
      while (model.children.length > 0) holder.add(model.children[0]);
      holder.userData = { ...model.userData, loading: false };
      holder.name = model.name;
    })
    .catch((err) => {
      console.error('[CA2] solid build failed', err);
      const fallback = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.12, 16, 48, Math.PI * 1.5),
        new THREE.MeshPhysicalMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 }),
      );
      holder.add(fallback);
      holder.userData.loading = false;
    });

  return holder;
}

export default createCA2MonogramLogoModel;
