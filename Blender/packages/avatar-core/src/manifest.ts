import { z } from "zod";
import {
  avatarCapabilities,
  avatarRuntimeKinds,
  avatarStates,
  avatarTriggers,
  isAvatarRuntime,
  isAvatarState,
  isAvatarTrigger,
  live2dParameterChannels,
  type AvatarManifest,
  type AvatarManifestValidationResult
} from "./types.js";

export const avatarRuntimeKindSchema = z.enum(avatarRuntimeKinds);
export const avatarStateSchema = z.enum(avatarStates);
export const avatarTriggerSchema = z.enum(avatarTriggers);
export const avatarCapabilitySchema = z.enum(avatarCapabilities);

const nonEmptyString = z.string().trim().min(1);
const sha256Checksum = z.string().regex(/^[a-f\d]{64}$/i, "Checksums must be SHA-256 hex strings.");
const runtimePathMapSchema = z
  .record(z.string(), nonEmptyString)
  .refine(
    (entries) => Object.keys(entries).every(isAvatarRuntime),
    "Entrypoint and asset keys must be known avatar runtime kinds."
  );
const stateClipMapSchema = z
  .record(z.string(), nonEmptyString)
  .refine((entries) => Object.keys(entries).every(isAvatarState), "State mapping keys must be known avatar states.");
const triggerClipMapSchema = z
  .record(z.string(), nonEmptyString)
  .refine(
    (entries) => Object.keys(entries).every(isAvatarTrigger),
    "Trigger mapping keys must be known avatar triggers."
  );

export const avatarConfigSchema = z.object({
  enabled: z.boolean(),
  runtime: avatarRuntimeKindSchema,
  position: z.enum(["activity-bar-view", "side-panel", "bottom-right", "bottom-left"]),
  character: nonEmptyString,
  animationIntensity: z.enum(["low", "medium", "high"]),
  frameRate: z.union([z.literal(30), z.literal(60)]),
  particleEffects: z.boolean(),
  soundEnabled: z.boolean(),
  lipSyncEnabled: z.boolean(),
  idleTimeout: z.number().finite().min(0),
  sleepTimeout: z.number().finite().min(0),
  debugOverlay: z.boolean(),
  noAnimation: z.boolean(),
  focusMode: z.boolean(),
  showSpeechBubble: z.boolean(),
  respectReducedMotion: z.boolean(),
  blenderPath: z.string(),
  assetWorkspace: nonEmptyString
});

export const avatarPoseInputSchema = z.object({
  cursorX: z.number().finite().min(0).max(1).optional(),
  cursorY: z.number().finite().min(0).max(1).optional(),
  mouthOpen: z.number().finite().min(0).max(1).optional(),
  scrollProgress: z.number().finite().min(0).max(1).optional(),
  audioLevel: z.number().finite().min(0).max(1).optional(),
  speechLevel: z.number().finite().min(0).max(1).optional()
});

export const avatarManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: nonEmptyString,
  name: nonEmptyString,
  version: nonEmptyString,
  author: nonEmptyString,
  license: nonEmptyString,
  preferredRuntime: avatarRuntimeKindSchema,
  fallbackRuntime: avatarRuntimeKindSchema,
  entrypoints: runtimePathMapSchema,
  capabilities: z
    .array(avatarCapabilitySchema)
    .refine((values) => new Set(values).size === values.length, "Capabilities must not contain duplicates."),
  states: stateClipMapSchema,
  triggers: triggerClipMapSchema.optional(),
  previewImage: nonEmptyString.optional(),
  checksums: z.record(z.string(), sha256Checksum).optional(),

  // Compatibility fields are intentionally optional and are removed only after
  // their preserved optional adapters receive a dedicated migration phase.
  runtimePriority: z.array(avatarRuntimeKindSchema).min(1).optional(),
  assets: runtimePathMapSchema.optional(),
  rive: z
    .object({
      stateMachine: nonEmptyString,
      inputs: z.record(z.string(), nonEmptyString)
    })
    .optional(),
  live2d: z
    .object({
      model3: nonEmptyString,
      model: nonEmptyString.optional(),
      parameters: z
        .record(z.string(), nonEmptyString)
        .refine(
          (entries) =>
            Object.keys(entries).every((key) => (live2dParameterChannels as readonly string[]).includes(key)),
          "Live2D parameters must use known channel names."
        )
        .optional(),
      motions: stateClipMapSchema.optional(),
      expressions: stateClipMapSchema.optional()
    })
    .optional()
});

export function validateAvatarManifest(input: unknown): AvatarManifestValidationResult {
  const result = avatarManifestSchema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`),
      warnings: []
    };
  }

  const manifest = result.data as AvatarManifest;
  const warnings: string[] = [];

  if (!manifest.entrypoints.svg) {
    warnings.push("SVG entrypoint is not declared. The extension may use its built-in fallback.");
  }
  if (!manifest.states.idle) {
    warnings.push('No "idle" state clip is declared. Runtimes must fall back safely.');
  }
  if (!manifest.entrypoints[manifest.preferredRuntime]) {
    warnings.push(`Preferred runtime "${manifest.preferredRuntime}" has no declared entrypoint.`);
  }

  return { valid: true, manifest, errors: [], warnings };
}
