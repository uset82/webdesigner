import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  supportsWebGL2,
  type AvatarManifest,
  type AvatarPoseInput,
  type AvatarRuntimeKind,
  type AvatarState,
  type AvatarTrigger,
} from "@codex-avatar-studio/avatar-core";
import * as THREE from "three";

type GpuRuntime = Extract<AvatarRuntimeKind, "webgl" | "webgpu">;

export type WebGLAvatarRendererProps = {
  requestedRuntime: GpuRuntime;
  state: AvatarState;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  fallback: ReactNode;
  pageVisible: boolean;
  reducedMotion: boolean;
  focusMode: boolean;
  frameRate: 30 | 60;
};

type MorphBinding = {
  index: number;
  mesh: THREE.Mesh;
};

type BoneBinding = {
  baseQuaternion: THREE.Quaternion;
  object: THREE.Object3D;
};

type RuntimeController = {
  actionByName: Map<string, THREE.AnimationAction>;
  camera: THREE.PerspectiveCamera;
  currentAction: THREE.AnimationAction | null;
  currentState: AvatarState;
  currentTriggerAction: THREE.AnimationAction | null;
  elapsedSeconds: number;
  eyeLeft: BoneBinding | null;
  eyeRight: BoneBinding | null;
  head: BoneBinding | null;
  lastFrameAt: number;
  mixer: THREE.AnimationMixer;
  modelRoot: THREE.Group;
  modelScene: THREE.Object3D;
  morphs: Map<string, MorphBinding[]>;
  nextBlinkAt: number;
  blinkStartedAt: number | null;
  proceduralMotion: boolean;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};

type MotionSettings = {
  focusMode: boolean;
  frameRate: 30 | 60;
  pageVisible: boolean;
  reducedMotion: boolean;
};

const ONE_SHOT_STATES = new Set<AvatarState>(["welcome", "success", "error"]);
const PARTICLE_TRIGGERS = new Set<AvatarTrigger>(["show-particles", "clear-effects"]);
const MORPH_NAMES = ["Blink_L", "Blink_R", "Mouth_Open", "Smile", "Frown", "Brow_Up", "Brow_Down"] as const;

export function WebGLAvatarRenderer({
  requestedRuntime,
  state,
  poseInput,
  manifest,
  triggerEvent,
  fallback,
  pageVisible,
  reducedMotion,
  focusMode,
  frameRate,
}: WebGLAvatarRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RuntimeController | null>(null);
  const stateRef = useRef(state);
  const poseInputRef = useRef(poseInput);
  const motionRef = useRef<MotionSettings>({ focusMode, frameRate, pageVisible, reducedMotion });
  const startLoopRef = useRef<(() => void) | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const webglSupported = useMemo(safeSupportsWebGL2, []);
  const glbAsset = useMemo(() => resolveGlbAsset(manifest, requestedRuntime), [manifest, requestedRuntime]);

  useEffect(() => {
    stateRef.current = state;
    const controller = controllerRef.current;
    if (controller) {
      playState(controller, manifest, state, reducedMotion);
      renderOnceRef.current?.();
    }
  }, [manifest, reducedMotion, state]);

  useEffect(() => {
    poseInputRef.current = poseInput;
    if (reducedMotion || focusMode) renderOnceRef.current?.();
  }, [focusMode, poseInput, reducedMotion]);

  useEffect(() => {
    motionRef.current = { focusMode, frameRate, pageVisible, reducedMotion };
    if (pageVisible && !focusMode && !reducedMotion) startLoopRef.current?.();
    else stopLoopRef.current?.();
    renderOnceRef.current?.();
  }, [focusMode, frameRate, pageVisible, reducedMotion]);

  useEffect(() => {
    if (!triggerEvent) return;
    const controller = controllerRef.current;
    if (!controller) return;
    playTrigger(controller, manifest, triggerEvent.trigger, reducedMotion);
    renderOnceRef.current?.();
  }, [manifest, reducedMotion, triggerEvent]);

  useEffect(() => {
    setRuntimeFailed(false);
    setLoaded(false);
  }, [glbAsset, requestedRuntime]);

  useEffect(() => {
    if (!webglSupported || !glbAsset || runtimeFailed) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let contextLossHandler: ((event: Event) => void) | null = null;
    let pendingRenderer: THREE.WebGLRenderer | null = null;
    let controller: RuntimeController | null = null;

    const stopLoop = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    const fail = (message: string, error?: unknown) => {
      if (cancelled) return;
      console.warn(`[Codex Avatar] ${message}`, error);
      stopLoop();
      setRuntimeFailed(true);
    };

    const renderOnce = () => {
      if (!controller || cancelled || !motionRef.current.pageVisible) return;
      const now = performance.now();
      const delta = Math.min(Math.max((now - controller.lastFrameAt) / 1000, 0), 0.1);
      controller.lastFrameAt = now;
      updateRuntime(controller, delta, now, stateRef.current, poseInputRef.current, motionRef.current.reducedMotion);
      try {
        controller.renderer.render(controller.scene, controller.camera);
      } catch (error) {
        fail("WebGL rendering failed; using SVG fallback.", error);
      }
    };

    const frame = (now: number) => {
      animationFrame = null;
      if (!controller || cancelled) return;
      const settings = motionRef.current;
      if (!settings.pageVisible || settings.focusMode || settings.reducedMotion) return;
      const minimumFrameMs = 1000 / settings.frameRate;
      if (now - controller.lastFrameAt >= minimumFrameMs - 1) renderOnce();
      animationFrame = requestAnimationFrame(frame);
    };

    const startLoop = () => {
      const settings = motionRef.current;
      if (animationFrame !== null || cancelled || !settings.pageVisible || settings.focusMode || settings.reducedMotion)
        return;
      if (controller) controller.lastFrameAt = performance.now();
      animationFrame = requestAnimationFrame(frame);
    };

    startLoopRef.current = startLoop;
    stopLoopRef.current = stopLoop;
    renderOnceRef.current = renderOnce;

    void (async () => {
      try {
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        pendingRenderer = renderer;
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.dataset.gpuRuntime = "webgl";

        contextLossHandler = (event: Event) => {
          event.preventDefault();
          fail("WebGL context was lost; using SVG fallback.");
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLossHandler);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        camera.position.set(0, 0.15, 5.4);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x293241, 2.15));
        const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
        keyLight.position.set(3.2, 4.4, 5.1);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xff304f, 1.15);
        rimLight.position.set(-3.4, 1.8, -2.2);
        scene.add(rimLight);

        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(glbAsset);
        if (cancelled) {
          disposeObject3D(gltf.scene);
          disposeRenderer(renderer, contextLossHandler);
          pendingRenderer = null;
          return;
        }

        const modelRoot = normalizeLoadedModel(gltf.scene);
        scene.add(modelRoot);
        const mixer = new THREE.AnimationMixer(gltf.scene);
        const actionByName = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
        const bindings = collectRigBindings(gltf.scene);
        controller = {
          actionByName,
          camera,
          currentAction: null,
          currentState: stateRef.current,
          currentTriggerAction: null,
          elapsedSeconds: 0,
          eyeLeft: bindings.eyeLeft,
          eyeRight: bindings.eyeRight,
          head: bindings.head,
          lastFrameAt: performance.now(),
          mixer,
          modelRoot,
          modelScene: gltf.scene,
          morphs: bindings.morphs,
          nextBlinkAt: performance.now() + 1800,
          blinkStartedAt: null,
          proceduralMotion: false,
          renderer,
          scene,
        };
        pendingRenderer = null;
        controllerRef.current = controller;

        mixer.addEventListener("finished", (event) => {
          if (!controller) return;
          const finishedAction = (event as { action: THREE.AnimationAction }).action;
          if (controller.currentTriggerAction === finishedAction) {
            controller.currentTriggerAction = null;
            playState(controller, manifest, controller.currentState, motionRef.current.reducedMotion);
          } else if (controller.currentAction === finishedAction) {
            playIdle(controller, manifest, motionRef.current.reducedMotion);
          }
        });

        const resize = () => {
          if (!controller) return;
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight || width, 1);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(width, height, false);
          renderOnce();
        };
        resizeHandler = resize;

        container.replaceChildren(renderer.domElement);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(container);
        } else {
          window.addEventListener("resize", resize);
        }
        resize();
        playState(controller, manifest, stateRef.current, motionRef.current.reducedMotion);
        renderOnce();
        setLoaded(true);
        startLoop();

      } catch (error) {
        if (controller) {
          if (contextLossHandler) {
            controller.renderer.domElement.removeEventListener("webglcontextlost", contextLossHandler);
          }
          disposeRuntime(controller);
          if (controllerRef.current === controller) controllerRef.current = null;
          controller = null;
        } else if (pendingRenderer) disposeRenderer(pendingRenderer, contextLossHandler);
        pendingRenderer = null;
        fail("GLB avatar failed to initialize; using SVG fallback.", error);
      }
    })();

    return () => {
      cancelled = true;
      stopLoop();
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      startLoopRef.current = null;
      stopLoopRef.current = null;
      renderOnceRef.current = null;
      if (controller) {
        if (contextLossHandler) {
          controller.renderer.domElement.removeEventListener("webglcontextlost", contextLossHandler);
        }
        disposeRuntime(controller);
      } else if (pendingRenderer) {
        disposeRenderer(pendingRenderer, contextLossHandler);
        pendingRenderer = null;
      }
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [glbAsset, manifest, runtimeFailed, webglSupported]);

  if (!webglSupported || !glbAsset || runtimeFailed) return fallback;

  return (
    <div className="webgl-runtime-stack">
      {!loaded ? <div className="webgl-runtime-fallback">{fallback}</div> : null}
      <div
        ref={containerRef}
        className="webgl-runtime"
        data-active-runtime="webgl"
        data-avatar-state={state}
        data-loaded={String(loaded)}
        data-requested-runtime={requestedRuntime}
      />
    </div>
  );
}

export function resolveGlbAsset(manifest: AvatarManifest, requestedRuntime: GpuRuntime = "webgl"): string | null {
  const requested = normalizeAssetPath(manifest.entrypoints[requestedRuntime] ?? manifest.assets?.[requestedRuntime]);
  if (requested) return requested;
  if (requestedRuntime === "webgpu") {
    return normalizeAssetPath(manifest.entrypoints.webgl ?? manifest.assets?.webgl);
  }
  return null;
}

export function resolveStateClipName(manifest: AvatarManifest, state: AvatarState): string | null {
  return normalizeAssetPath(manifest.states[state]) ?? (state === "idle" ? "idle_loop" : null);
}

export function isOneShotState(state: AvatarState, clipName: string): boolean {
  return ONE_SHOT_STATES.has(state) || /(?:^|_)once$/i.test(clipName);
}

function safeSupportsWebGL2(): boolean {
  try {
    return supportsWebGL2();
  } catch {
    return false;
  }
}

function normalizeAssetPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRigName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function collectRigBindings(root: THREE.Object3D): {
  eyeLeft: BoneBinding | null;
  eyeRight: BoneBinding | null;
  head: BoneBinding | null;
  morphs: Map<string, MorphBinding[]>;
} {
  const morphs = new Map<string, MorphBinding[]>();
  let eyeLeft: BoneBinding | null = null;
  let eyeRight: BoneBinding | null = null;
  let head: BoneBinding | null = null;

  root.traverse((object) => {
    const normalizedName = normalizeRigName(object.name);
    const binding = { baseQuaternion: object.quaternion.clone(), object };
    if (!head && normalizedName === "head") head = binding;
    if (!eyeLeft && ["eyel", "lefteye", "eyeleft"].includes(normalizedName)) eyeLeft = binding;
    if (!eyeRight && ["eyer", "righteye", "eyeright"].includes(normalizedName)) eyeRight = binding;

    const mesh = object as THREE.Mesh;
    const dictionary = mesh.morphTargetDictionary;
    if (!dictionary) return;
    for (const [name, index] of Object.entries(dictionary)) {
      const canonical = MORPH_NAMES.find((candidate) => normalizeRigName(candidate) === normalizeRigName(name));
      if (!canonical) continue;
      const bindings = morphs.get(canonical) ?? [];
      bindings.push({ index, mesh });
      morphs.set(canonical, bindings);
    }
  });

  return { eyeLeft, eyeRight, head, morphs };
}

function normalizeLoadedModel(scene: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
  const root = new THREE.Group();
  root.name = "CodexAvatarModelRoot";
  scene.position.sub(center);
  root.scale.setScalar(3.4 / maxAxis);
  root.add(scene);
  root.traverse((object) => {
    object.frustumCulled = false;
  });
  return root;
}

function playState(
  controller: RuntimeController,
  manifest: AvatarManifest,
  state: AvatarState,
  reducedMotion: boolean,
): void {
  controller.currentState = state;
  controller.currentTriggerAction?.stop();
  controller.currentTriggerAction = null;
  const clipName = resolveStateClipName(manifest, state);
  const action = clipName ? controller.actionByName.get(clipName) : undefined;
  if (!clipName || !action) {
    controller.proceduralMotion = true;
    playIdle(controller, manifest, reducedMotion);
    return;
  }

  controller.proceduralMotion = false;
  transitionToAction(controller, action, isOneShotState(state, clipName), reducedMotion);
}

function playIdle(controller: RuntimeController, manifest: AvatarManifest, reducedMotion: boolean): void {
  const idleName = resolveStateClipName(manifest, "idle");
  const idleAction = idleName ? controller.actionByName.get(idleName) : undefined;
  if (!idleAction) {
    controller.currentAction?.stop();
    controller.currentAction = null;
    controller.proceduralMotion = true;
    return;
  }
  transitionToAction(controller, idleAction, false, reducedMotion);
}

function transitionToAction(
  controller: RuntimeController,
  action: THREE.AnimationAction,
  oneShot: boolean,
  reducedMotion: boolean,
): void {
  if (controller.currentAction === action && action.isRunning()) {
    action.setEffectiveTimeScale(reducedMotion ? 0 : 1);
    if (reducedMotion) action.time = 0;
    return;
  }
  const previous = controller.currentAction;
  action.reset();
  action.enabled = true;
  action.clampWhenFinished = oneShot;
  action.setEffectiveTimeScale(reducedMotion ? 0 : 1);
  action.setEffectiveWeight(1);
  action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Number.POSITIVE_INFINITY);
  action.play();
  if (reducedMotion) action.time = 0;
  if (previous && previous !== action) previous.crossFadeTo(action, reducedMotion ? 0 : 0.22, true);
  controller.currentAction = action;
}

function playTrigger(
  controller: RuntimeController,
  manifest: AvatarManifest,
  trigger: AvatarTrigger,
  reducedMotion: boolean,
): void {
  if (PARTICLE_TRIGGERS.has(trigger)) return;
  if (trigger === "blink") controller.blinkStartedAt = performance.now();
  const clipName = normalizeAssetPath(manifest.triggers?.[trigger]);
  const action = clipName ? controller.actionByName.get(clipName) : undefined;
  if (!action || reducedMotion) return;
  controller.currentAction?.fadeOut(0.1);
  controller.currentTriggerAction?.stop();
  action.reset();
  action.enabled = true;
  action.clampWhenFinished = false;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.setLoop(THREE.LoopOnce, 1);
  action.fadeIn(0.1).play();
  controller.currentTriggerAction = action;
}

function updateRuntime(
  controller: RuntimeController,
  delta: number,
  now: number,
  state: AvatarState,
  poseInput: AvatarPoseInput,
  reducedMotion: boolean,
): void {
  controller.elapsedSeconds += delta;
  if (!reducedMotion) controller.mixer.update(delta);
  updateMorphs(controller, now, state, poseInput, reducedMotion);
  updateGaze(controller, poseInput, reducedMotion);

  const shouldUseProceduralIdle = controller.proceduralMotion && !reducedMotion;
  controller.modelRoot.position.y = shouldUseProceduralIdle ? Math.sin(controller.elapsedSeconds * 1.7) * 0.018 : 0;
  controller.modelRoot.rotation.z =
    shouldUseProceduralIdle && state === "error" ? Math.sin(controller.elapsedSeconds * 24) * 0.018 : 0;
}

function updateMorphs(
  controller: RuntimeController,
  now: number,
  state: AvatarState,
  poseInput: AvatarPoseInput,
  reducedMotion: boolean,
): void {
  if (!reducedMotion && controller.blinkStartedAt === null && now >= controller.nextBlinkAt) {
    controller.blinkStartedAt = now;
  }
  let blink = state === "sleeping" ? 1 : 0;
  if (controller.blinkStartedAt !== null) {
    const progress = Math.min((now - controller.blinkStartedAt) / 180, 1);
    blink = Math.sin(progress * Math.PI);
    if (progress >= 1) {
      controller.blinkStartedAt = null;
      controller.nextBlinkAt = now + 2200 + Math.random() * 2600;
    }
  }

  const speechInput = poseInput.mouthOpen ?? poseInput.speechLevel ?? poseInput.audioLevel;
  const proceduralSpeech =
    state === "speaking" && !reducedMotion ? 0.42 + Math.sin(controller.elapsedSeconds * 11.5) * 0.24 : 0;
  const mouthOpen = THREE.MathUtils.clamp(speechInput ?? proceduralSpeech, 0, 1);
  setMorph(controller, "Blink_L", blink);
  setMorph(controller, "Blink_R", blink);
  setMorph(controller, "Mouth_Open", state === "speaking" ? mouthOpen : 0);
  setMorph(controller, "Smile", state === "success" || state === "welcome" ? 0.78 : 0);
  setMorph(controller, "Frown", state === "error" || state === "warning" ? 0.72 : 0);
  setMorph(controller, "Brow_Up", state === "thinking" || state === "listening" ? 0.48 : 0);
  setMorph(controller, "Brow_Down", state === "debugging" || state === "error" ? 0.52 : 0);
}

function setMorph(controller: RuntimeController, name: string, value: number): void {
  for (const binding of controller.morphs.get(name) ?? []) {
    if (binding.mesh.morphTargetInfluences) binding.mesh.morphTargetInfluences[binding.index] = value;
  }
}

function updateGaze(controller: RuntimeController, poseInput: AvatarPoseInput, reducedMotion: boolean): void {
  const x = THREE.MathUtils.clamp((poseInput.cursorX ?? 0.5) - 0.5, -0.5, 0.5);
  const y = THREE.MathUtils.clamp((poseInput.cursorY ?? 0.5) - 0.5, -0.5, 0.5);
  const strength = reducedMotion ? 0.16 : 0.34;
  applyGaze(controller.eyeLeft, x * strength, -y * strength);
  applyGaze(controller.eyeRight, x * strength, -y * strength);
  if (controller.proceduralMotion) applyGaze(controller.head, x * strength * 0.34, -y * strength * 0.25);
}

function applyGaze(binding: BoneBinding | null, yaw: number, pitch: number): void {
  if (!binding) return;
  const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  binding.object.quaternion.copy(binding.baseQuaternion).multiply(offset);
}

function disposeRuntime(controller: RuntimeController): void {
  controller.mixer.stopAllAction();
  controller.mixer.uncacheRoot(controller.modelScene);
  controller.scene.remove(controller.modelRoot);
  disposeObject3D(controller.modelRoot);
  controller.renderer.domElement.remove();
  controller.renderer.renderLists.dispose();
  controller.renderer.dispose();
  controller.renderer.forceContextLoss();
}

function disposeRenderer(renderer: THREE.WebGLRenderer, contextLossHandler: ((event: Event) => void) | null): void {
  if (contextLossHandler) renderer.domElement.removeEventListener("webglcontextlost", contextLossHandler);
  renderer.domElement.remove();
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
}

function disposeObject3D(root: THREE.Object3D): void {
  const disposedTextures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
          value.dispose();
          disposedTextures.add(value);
        }
      }
      material.dispose();
    }
  });
}
