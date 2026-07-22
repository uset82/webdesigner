import type { AvatarState, AvatarTrigger } from "@codex-avatar-studio/avatar-core";

export type SpriteClip = {
  name: string;
  frames: readonly number[];
  fps?: number | undefined;
  loop?: boolean | undefined;
  priority?: number | undefined;
};

export type SpriteSheetManifest = {
  schemaVersion: 1;
  image: string;
  frameWidth: number;
  frameHeight: number;
  clips: Readonly<Record<string, SpriteClip>>;
};

export type SpriteSheetValidation = { valid: boolean; errors: string[] };

export const MAX_SPRITESHEET_TEXTURE_DIMENSION = 4096;
export const MAX_SPRITESHEET_FRAME_COUNT = 4096;
export const MAX_SPRITESHEET_CLIP_FRAME_REFERENCES = 16_384;

const stateClipMap: Record<AvatarState, string> = {
  idle: "idle_loop",
  welcome: "greet_once",
  listening: "listen_loop",
  thinking: "think_loop",
  speaking: "talk_loop",
  coding: "type_loop",
  reviewing: "inspect_loop",
  debugging: "debug_loop",
  building: "scan_loop",
  success: "celebrate_once",
  warning: "concerned_loop",
  error: "error_once",
  sleeping: "sleep_loop"
};

const triggerClipMap: Partial<Record<AvatarTrigger, string>> = {
  blink: "blink_once",
  "look-left": "look_left_once",
  "look-right": "look_right_once",
  nod: "nod_once",
  shake: "shake_once",
  celebrate: "celebrate_once",
  point: "point_once",
  "start-speaking": "talk_start",
  "stop-speaking": "talk_stop",
  "show-particles": "particles_success",
  "clear-effects": "clear_effects"
};

export function validateSpriteSheetManifest(value: unknown): SpriteSheetValidation {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return { valid: false, errors: ["Manifest must be an object."] };
  const manifest = value as Partial<SpriteSheetManifest>;
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (typeof manifest.image !== "string" || manifest.image.length === 0) {
    errors.push("image is required.");
  } else if (!isSafeLocalPath(manifest.image)) {
    errors.push("image must be a safe local relative path.");
  }
  if (
    typeof manifest.frameWidth !== "number" ||
    !Number.isInteger(manifest.frameWidth) ||
    manifest.frameWidth <= 0 ||
    manifest.frameWidth > MAX_SPRITESHEET_TEXTURE_DIMENSION
  ) {
    errors.push("frameWidth must be positive.");
  }
  if (
    typeof manifest.frameHeight !== "number" ||
    !Number.isInteger(manifest.frameHeight) ||
    manifest.frameHeight <= 0 ||
    manifest.frameHeight > MAX_SPRITESHEET_TEXTURE_DIMENSION
  ) {
    errors.push("frameHeight must be positive.");
  }
  if (!manifest.clips || typeof manifest.clips !== "object" || Array.isArray(manifest.clips)) {
    errors.push("clips are required.");
  }

  let frameReferences = 0;
  const frameIndexes = new Set<number>();
  for (const [name, clip] of Object.entries(manifest.clips ?? {})) {
    if (
      !clip ||
      typeof clip !== "object" ||
      Array.isArray(clip) ||
      typeof clip.name !== "string" ||
      clip.name.trim().length === 0 ||
      !Array.isArray(clip.frames) ||
      clip.frames.length === 0 ||
      clip.frames.length > MAX_SPRITESHEET_CLIP_FRAME_REFERENCES ||
      clip.frames.some((frame) => !Number.isInteger(frame) || frame < 0 || frame >= MAX_SPRITESHEET_FRAME_COUNT)
    ) {
      errors.push(`Clip "${name}" must contain bounded non-negative integer frames.`);
      continue;
    }
    if (
      (clip.fps !== undefined &&
        (typeof clip.fps !== "number" || !Number.isFinite(clip.fps) || clip.fps <= 0 || clip.fps > 240)) ||
      (clip.loop !== undefined && typeof clip.loop !== "boolean") ||
      (clip.priority !== undefined &&
        (typeof clip.priority !== "number" || !Number.isInteger(clip.priority) || !Number.isFinite(clip.priority)))
    ) {
      errors.push(`Clip "${name}" has invalid playback options.`);
    }
    frameReferences += clip.frames.length;
    for (const frame of clip.frames) frameIndexes.add(frame);
  }
  if (frameReferences > MAX_SPRITESHEET_CLIP_FRAME_REFERENCES) {
    errors.push(`Spritesheet clips exceed the ${MAX_SPRITESHEET_CLIP_FRAME_REFERENCES}-reference limit.`);
  }
  if (frameIndexes.size > MAX_SPRITESHEET_FRAME_COUNT) {
    errors.push(`Spritesheet exceeds the ${MAX_SPRITESHEET_FRAME_COUNT}-frame limit.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateSpriteSheetTextureDimensions(
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number
): SpriteSheetValidation {
  const errors: string[] = [];
  if (!Number.isInteger(width) || width <= 0 || width > MAX_SPRITESHEET_TEXTURE_DIMENSION) {
    errors.push(`Spritesheet width must be between 1 and ${MAX_SPRITESHEET_TEXTURE_DIMENSION}.`);
  }
  if (!Number.isInteger(height) || height <= 0 || height > MAX_SPRITESHEET_TEXTURE_DIMENSION) {
    errors.push(`Spritesheet height must be between 1 and ${MAX_SPRITESHEET_TEXTURE_DIMENSION}.`);
  }
  if (Number.isInteger(width) && Number.isInteger(frameWidth) && width > 0 && frameWidth > 0) {
    if (Math.floor(width / frameWidth) <= 0) errors.push("Spritesheet width is smaller than one frame.");
  }
  if (Number.isInteger(height) && Number.isInteger(frameHeight) && height > 0 && frameHeight > 0) {
    if (Math.floor(height / frameHeight) <= 0) errors.push("Spritesheet height is smaller than one frame.");
  }
  return { valid: errors.length === 0, errors };
}

export function clipForState(manifest: SpriteSheetManifest, state: AvatarState): SpriteClip {
  return (
    manifest.clips[stateClipMap[state]] ?? manifest.clips.idle_loop ?? { name: "fallback", frames: [0], loop: true }
  );
}

export function clipForTrigger(manifest: SpriteSheetManifest, trigger: AvatarTrigger): SpriteClip | undefined {
  const name = triggerClipMap[trigger];
  return name ? manifest.clips[name] : undefined;
}

function isSafeLocalPath(value: string): boolean {
  return (
    value.trim().length > 0 &&
    !value.includes("\0") &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !/^[a-z][a-z\d+.-]*:/i.test(value) &&
    !value.split(/[\\/]+/).some((segment) => segment === "..")
  );
}
