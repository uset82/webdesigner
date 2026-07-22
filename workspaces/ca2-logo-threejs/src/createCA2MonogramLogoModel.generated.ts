import * as THREE from 'three';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      const paletteValue = clamp01(
        0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
      );
      const color = mixPalette(colors, paletteValue);
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: CA2MonogramLogo
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createCA2MonogramLogoModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "CA2MonogramLogo";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["polished-gold"] = createSculptMaterial(
    "polished-gold",
    {"id": "polished-gold", "name": "PolishedGold", "baseColor": "#D4AF37", "albedo": {"dominant": "#D4AF37", "secondary": ["#F0D78C", "#B8860B"]}, "colorVariation": {"palette": ["#F5E6A3", "#D4AF37", "#C9A227", "#A67C00"]}, "metalness": {"base": 1.0}, "roughness": {"base": 0.28}, "clearcoat": {"base": 0.35}, "localOverrides": [{"id": "edge-bevel", "kind": "edge-wear", "params": {"roughness": 0.18}}, {"id": "cavity-shade", "kind": "ao", "params": {"intensity": 0.35}}, {"id": "brush", "kind": "scratches", "params": {"anisotropy": 0.2}}], "referencePbr": {"source": "logo-reference.png", "confidence": 0.82, "maps": {"albedo": "ref/logo-reference.png", "roughness": "inferred", "normal": "inferred", "ao": "inferred", "height": "inferred"}, "notes": "Warm gold emboss from reference midtones/highlights"}},
    options
  );
  materialMap["gold-highlight"] = createSculptMaterial(
    "gold-highlight",
    {"id": "gold-highlight", "name": "GoldHighlight", "baseColor": "#F5E6A3", "metalness": {"base": 1.0}, "roughness": {"base": 0.16}, "localOverrides": [{"id": "specular-rim", "kind": "gloss", "params": {"roughness": 0.12}}], "referencePbr": {"source": "logo-reference.png", "confidence": 0.75, "maps": {"albedo": "ref/logo-reference.png"}, "notes": "highlight gold"}},
    options
  );
  materialMap["navy-plate"] = createSculptMaterial(
    "navy-plate",
    {"id": "navy-plate", "name": "NavyPlate", "baseColor": "#071028", "albedo": {"dominant": "#071028", "secondary": ["#0B1836"]}, "metalness": {"base": 0.05}, "roughness": {"base": 0.88}, "localOverrides": [{"id": "vignette", "kind": "stain", "params": {"darken": 0.15}}], "referencePbr": {"source": "logo-reference.png", "confidence": 0.9, "maps": {"albedo": "ref/logo-reference.png"}, "notes": "navy field"}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "CA2MonogramLogo__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "CA2MonogramLogo", "level": "macro", "role": "root", "importance": 0.9, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.1, "height": 0.1, "depth": 0.1, "units": "relative", "confidence": 1}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "navy-plate", "materialLayers": ["navy-plate"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pivot"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["navy-plate"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "CA2MonogramLogo";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "CA2MonogramLogo", "level": "macro", "role": "root", "importance": 0.9, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.1, "height": 0.1, "depth": 0.1, "units": "relative", "confidence": 1}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "navy-plate", "materialLayers": ["navy-plate"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pivot"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_backdrop_plate_1 = null;
  const endpoint_backdrop_plate_1 = makeAttachmentEndpoint(attachment_backdrop_plate_1);
  const node_backdrop_plate_1 = new THREE.Group();
  node_backdrop_plate_1.name = "NavyBackdrop__pivot";
  if (endpoint_backdrop_plate_1) {
    node_backdrop_plate_1.position.copy(endpoint_backdrop_plate_1.start);
    node_backdrop_plate_1.rotation.set(0, 0, 0);
    node_backdrop_plate_1.scale.set(1, 1, 1);
  } else {
    node_backdrop_plate_1.position.set(0.0, 0.0, -0.08);
    node_backdrop_plate_1.rotation.set(0.0, 0.0, 0.0);
    node_backdrop_plate_1.scale.set(1.0, 1.0, 1.0);
  }
  node_backdrop_plate_1.userData.sculptComponent = {"id": "backdrop-plate", "name": "NavyBackdrop", "level": "macro", "role": "backdrop", "importance": 0.9, "confidence": 0.9, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 4.2, "height": 3.2, "depth": 0.02, "units": "relative", "confidence": 0.95}, "transform": {"position": [0, 0, -0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "backdrop-plate", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "navy-plate", "materialLayers": ["navy-plate"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["matte-field"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_backdrop_plate_1.userData.actionProfile = {"animationRole": "backdrop-plate", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}};
  (nodes["root"] ?? root).add(node_backdrop_plate_1);
  nodes["backdrop-plate"] = node_backdrop_plate_1;
  const mesh_backdrop_plate_1Geometry = endpoint_backdrop_plate_1
    ? new THREE.CylinderGeometry(endpoint_backdrop_plate_1.endRadius, endpoint_backdrop_plate_1.baseRadius, endpoint_backdrop_plate_1.length, 32, 12)
    : new THREE.PlaneGeometry(1, 1, 24, 24);
  const mesh_backdrop_plate_1 = new THREE.Mesh(
    mesh_backdrop_plate_1Geometry,
    materialMap["navy-plate"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_backdrop_plate_1.name = "NavyBackdrop";
  if (endpoint_backdrop_plate_1) {
    mesh_backdrop_plate_1.position.copy(endpoint_backdrop_plate_1.midpoint);
    mesh_backdrop_plate_1.quaternion.copy(endpoint_backdrop_plate_1.quaternion);
  }
  mesh_backdrop_plate_1.castShadow = options.castShadow ?? true;
  mesh_backdrop_plate_1.receiveShadow = options.receiveShadow ?? true;
  mesh_backdrop_plate_1.userData.sculptComponent = {"id": "backdrop-plate", "name": "NavyBackdrop", "level": "macro", "role": "backdrop", "importance": 0.9, "confidence": 0.9, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 4.2, "height": 3.2, "depth": 0.02, "units": "relative", "confidence": 0.95}, "transform": {"position": [0, 0, -0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "backdrop-plate", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "navy-plate", "materialLayers": ["navy-plate"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["matte-field"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_backdrop_plate_1.add(mesh_backdrop_plate_1);
  meshes["backdrop-plate"] = mesh_backdrop_plate_1;
  colliders["backdrop-plate"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_backdrop_plate_1);

  const attachment_crescent_c_2 = null;
  const endpoint_crescent_c_2 = makeAttachmentEndpoint(attachment_crescent_c_2);
  const node_crescent_c_2 = new THREE.Group();
  node_crescent_c_2.name = "CrescentC__pivot";
  if (endpoint_crescent_c_2) {
    node_crescent_c_2.position.copy(endpoint_crescent_c_2.start);
    node_crescent_c_2.rotation.set(0, 0, 0);
    node_crescent_c_2.scale.set(1, 1, 1);
  } else {
    node_crescent_c_2.position.set(-0.05, 0.1, 0.0);
    node_crescent_c_2.rotation.set(0.0, 0.0, 0.0);
    node_crescent_c_2.scale.set(1.0, 1.0, 1.0);
  }
  node_crescent_c_2.userData.sculptComponent = {"id": "crescent-c", "name": "CrescentC", "level": "macro", "role": "letterform", "importance": 0.9, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.6, "height": 1.9, "depth": 0.12, "units": "relative", "confidence": 0.9}, "transform": {"position": [-0.05, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "crescent-c", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["open-crescent", "relief-depth"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_crescent_c_2.userData.actionProfile = {"animationRole": "crescent-c", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}};
  (nodes["root"] ?? root).add(node_crescent_c_2);
  nodes["crescent-c"] = node_crescent_c_2;
  const mesh_crescent_c_2Geometry = endpoint_crescent_c_2
    ? new THREE.CylinderGeometry(endpoint_crescent_c_2.endRadius, endpoint_crescent_c_2.baseRadius, endpoint_crescent_c_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_crescent_c_2 = new THREE.Mesh(
    mesh_crescent_c_2Geometry,
    materialMap["polished-gold"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crescent_c_2.name = "CrescentC";
  if (endpoint_crescent_c_2) {
    mesh_crescent_c_2.position.copy(endpoint_crescent_c_2.midpoint);
    mesh_crescent_c_2.quaternion.copy(endpoint_crescent_c_2.quaternion);
  }
  mesh_crescent_c_2.castShadow = options.castShadow ?? true;
  mesh_crescent_c_2.receiveShadow = options.receiveShadow ?? true;
  mesh_crescent_c_2.userData.sculptComponent = {"id": "crescent-c", "name": "CrescentC", "level": "macro", "role": "letterform", "importance": 0.9, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.6, "height": 1.9, "depth": 0.12, "units": "relative", "confidence": 0.9}, "transform": {"position": [-0.05, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "crescent-c", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["open-crescent", "relief-depth"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_crescent_c_2.add(mesh_crescent_c_2);
  meshes["crescent-c"] = mesh_crescent_c_2;
  colliders["crescent-c"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_crescent_c_2);
  // TODO: replace 'crescent-c' box fallback with extrude procedural geometry.

  const attachment_letter_a_3 = null;
  const endpoint_letter_a_3 = makeAttachmentEndpoint(attachment_letter_a_3);
  const node_letter_a_3 = new THREE.Group();
  node_letter_a_3.name = "LetterA__pivot";
  if (endpoint_letter_a_3) {
    node_letter_a_3.position.copy(endpoint_letter_a_3.start);
    node_letter_a_3.rotation.set(0, 0, 0);
    node_letter_a_3.scale.set(1, 1, 1);
  } else {
    node_letter_a_3.position.set(0.02, 0.02, 0.01);
    node_letter_a_3.rotation.set(0.0, 0.0, 0.0);
    node_letter_a_3.scale.set(1.0, 1.0, 1.0);
  }
  node_letter_a_3.userData.sculptComponent = {"id": "letter-a", "name": "LetterA", "level": "macro", "role": "letterform", "importance": 0.9, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.35, "height": 1.85, "depth": 0.13, "units": "relative", "confidence": 0.92}, "transform": {"position": [0.02, 0.02, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "letter-a", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["serif-a", "relief-depth"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_letter_a_3.userData.actionProfile = {"animationRole": "letter-a", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}};
  (nodes["root"] ?? root).add(node_letter_a_3);
  nodes["letter-a"] = node_letter_a_3;
  const mesh_letter_a_3Geometry = endpoint_letter_a_3
    ? new THREE.CylinderGeometry(endpoint_letter_a_3.endRadius, endpoint_letter_a_3.baseRadius, endpoint_letter_a_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_letter_a_3 = new THREE.Mesh(
    mesh_letter_a_3Geometry,
    materialMap["polished-gold"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_letter_a_3.name = "LetterA";
  if (endpoint_letter_a_3) {
    mesh_letter_a_3.position.copy(endpoint_letter_a_3.midpoint);
    mesh_letter_a_3.quaternion.copy(endpoint_letter_a_3.quaternion);
  }
  mesh_letter_a_3.castShadow = options.castShadow ?? true;
  mesh_letter_a_3.receiveShadow = options.receiveShadow ?? true;
  mesh_letter_a_3.userData.sculptComponent = {"id": "letter-a", "name": "LetterA", "level": "macro", "role": "letterform", "importance": 0.9, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.35, "height": 1.85, "depth": 0.13, "units": "relative", "confidence": 0.92}, "transform": {"position": [0.02, 0.02, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "letter-a", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["serif-a", "relief-depth"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_letter_a_3.add(mesh_letter_a_3);
  meshes["letter-a"] = mesh_letter_a_3;
  colliders["letter-a"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_letter_a_3);
  // TODO: replace 'letter-a' box fallback with extrude procedural geometry.

  const attachment_numeral_2_4 = null;
  const endpoint_numeral_2_4 = makeAttachmentEndpoint(attachment_numeral_2_4);
  const node_numeral_2_4 = new THREE.Group();
  node_numeral_2_4.name = "Superscript2__pivot";
  if (endpoint_numeral_2_4) {
    node_numeral_2_4.position.copy(endpoint_numeral_2_4.start);
    node_numeral_2_4.rotation.set(0, 0, 0);
    node_numeral_2_4.scale.set(1, 1, 1);
  } else {
    node_numeral_2_4.position.set(0.78, 0.72, 0.02);
    node_numeral_2_4.rotation.set(0.0, 0.0, 0.0);
    node_numeral_2_4.scale.set(1.0, 1.0, 1.0);
  }
  node_numeral_2_4.userData.sculptComponent = {"id": "numeral-2", "name": "Superscript2", "level": "meso", "role": "letterform", "importance": 0.7, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.36, "depth": 0.1, "units": "relative", "confidence": 0.92}, "transform": {"position": [0.78, 0.72, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "numeral-2", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised-2"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_numeral_2_4.userData.actionProfile = {"animationRole": "numeral-2", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}};
  (nodes["root"] ?? root).add(node_numeral_2_4);
  nodes["numeral-2"] = node_numeral_2_4;
  const mesh_numeral_2_4Geometry = endpoint_numeral_2_4
    ? new THREE.CylinderGeometry(endpoint_numeral_2_4.endRadius, endpoint_numeral_2_4.baseRadius, endpoint_numeral_2_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_numeral_2_4 = new THREE.Mesh(
    mesh_numeral_2_4Geometry,
    materialMap["polished-gold"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_numeral_2_4.name = "Superscript2";
  if (endpoint_numeral_2_4) {
    mesh_numeral_2_4.position.copy(endpoint_numeral_2_4.midpoint);
    mesh_numeral_2_4.quaternion.copy(endpoint_numeral_2_4.quaternion);
  }
  mesh_numeral_2_4.castShadow = options.castShadow ?? true;
  mesh_numeral_2_4.receiveShadow = options.receiveShadow ?? true;
  mesh_numeral_2_4.userData.sculptComponent = {"id": "numeral-2", "name": "Superscript2", "level": "meso", "role": "letterform", "importance": 0.7, "confidence": 0.9, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "extruded letterform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.36, "depth": 0.1, "units": "relative", "confidence": 0.92}, "transform": {"position": [0.78, 0.72, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "numeral-2", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "polished-gold"}}, "material": "polished-gold", "materialLayers": ["polished-gold"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised-2"], "surfaceDetail": {"macroRoughness": 0.28, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "brushed-metal", "displacementPattern": "", "occlusionPattern": "cavity", "edgeWearPattern": "soft-bevel", "notes": "gold relief"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form-refinement"};
  node_numeral_2_4.add(mesh_numeral_2_4);
  meshes["numeral-2"] = mesh_numeral_2_4;
  colliders["numeral-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_numeral_2_4);
  // TODO: replace 'numeral-2' box fallback with extrude procedural geometry.

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."], "reviewViewpoints": [{"name": "hero-front", "position": [0, 0.1, 3.2], "target": [0, 0, 0]}, {"name": "three-quarter", "position": [1.6, 0.6, 2.6], "target": [0, 0, 0]}, {"name": "top-glint", "position": [0.3, 2.2, 1.8], "target": [0, 0, 0]}, {"name": "side-relief", "position": [2.4, 0.2, 1.2], "target": [0, 0, 0]}]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createCA2MonogramLogoLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "CA2MonogramLogo look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "role": "key", "direction": [0.55, 0.75, 0.9], "intensity": 2.2, "color": "#fff2d6"}, {"id": "fill", "type": "directional", "role": "fill", "direction": [-0.7, 0.2, 0.5], "intensity": 0.55, "color": "#9bb4ff"}, {"id": "rim", "type": "directional", "role": "rim", "direction": [-0.4, 0.3, -0.8], "intensity": 1.1, "color": "#ffd27a"}, {"id": "ambient", "type": "ambient", "role": "ambient", "intensity": 0.35, "color": "#1a2744"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."], "reviewViewpoints": [{"name": "hero-front", "position": [0, 0.1, 3.2], "target": [0, 0, 0]}, {"name": "three-quarter", "position": [1.6, 0.6, 2.6], "target": [0, 0, 0]}, {"name": "top-glint", "position": [0.3, 2.2, 1.8], "target": [0, 0, 0]}, {"name": "side-relief", "position": [2.4, 0.2, 1.2], "target": [0, 0, 0]}]};
  return lights;
}
