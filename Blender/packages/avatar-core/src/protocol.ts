import { z } from "zod";
import {
  avatarConfigSchema,
  avatarManifestSchema,
  avatarPoseInputSchema,
  avatarStateSchema,
  avatarTriggerSchema
} from "./manifest.js";

export const AVATAR_PROTOCOL_VERSION = 1 as const;

export type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const protocolVersionSchema = z.literal(AVATAR_PROTOCOL_VERSION);
const pictureJobIdSchema = z.string().uuid();
const blenderCapabilitySchema = z.enum(["svg", "glb", "png"]);
const blenderDiscoverySourceSchema = z.enum(["setting", "environment", "path", "platform"]);
const avatarLibraryIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
const pictureProgressStageSchema = z.enum(["selecting", "validating", "copying"]);
const vectorProgressStageSchema = z.enum([
  "validating",
  "decoding",
  "preprocessing",
  "tracing",
  "optimizing",
  "writing"
]);
export const vectorizeStudioOptionsSchema = z.object({
  preset: z.enum(["color-illustration", "clean-icon", "high-contrast-silhouette"]),
  grayscale: z.boolean(),
  colorCount: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
  threshold: z.number().int().min(0).max(255).nullable(),
  removeNearWhite: z.boolean(),
  noiseReduction: z.number().int().min(0).max(100),
  detail: z.enum(["low", "balanced", "high"])
});
export const generatedAvatarMetadataSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
  name: z.string().trim().min(1).max(160),
  author: z.string().trim().min(1).max(160),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  license: z.string().trim().min(1).max(160)
});
const pictureErrorCodeSchema = z.enum([
  "workspace-required",
  "workspace-untrusted",
  "busy",
  "unsupported-format",
  "invalid-image",
  "preview-failed",
  "unknown"
]);

export const extensionToWebviewMessageSchema = z.discriminatedUnion("type", [
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:initialize"),
    config: avatarConfigSchema,
    manifest: avatarManifestSchema
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("avatar:setState"), state: avatarStateSchema }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("avatar:trigger"), trigger: avatarTriggerSchema }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:setMessage"),
    text: z.string().nullable()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:setPoseInput"),
    input: avatarPoseInputSchema
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("settings:update"), config: avatarConfigSchema }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:status"),
    availability: z.enum(["checking", "ready", "missing", "invalid", "unsupported", "error"]),
    busy: z.boolean(),
    executablePath: z.string().trim().min(1).max(4096).nullable(),
    source: blenderDiscoverySourceSchema.nullable(),
    version: z
      .object({
        major: z.number().int().min(0).max(999),
        minor: z.number().int().min(0).max(999),
        patch: z.number().int().min(0).max(999),
        label: z.string().trim().min(1).max(160)
      })
      .nullable(),
    support: z.enum(["supported", "unsupported", "unknown"]),
    capabilities: z.array(blenderCapabilitySchema).max(3),
    configuredPathInvalid: z.boolean(),
    message: z.string().trim().min(1).max(500)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:exportResult"),
    jobId: pictureJobIdSchema,
    sourceFile: z.string().trim().min(1).max(255),
    results: z
      .array(
        z.discriminatedUnion("status", [
          z.object({
            status: z.literal("success"),
            mode: blenderCapabilitySchema,
            fileName: z.string().trim().min(1).max(255),
            reportFileName: z.string().trim().min(1).max(255)
          }),
          z.object({
            status: z.literal("failed"),
            mode: blenderCapabilitySchema,
            message: z.string().trim().min(1).max(500)
          })
        ])
      )
      .min(1)
      .max(3),
    canUseAsAvatar: z.boolean()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:avatarSaveStatus"),
    jobId: pictureJobIdSchema,
    tone: z.enum(["working", "success", "warning", "error"]),
    message: z.string().trim().min(1).max(500),
    avatar: z
      .object({ id: avatarLibraryIdSchema, name: z.string().trim().min(1).max(160), replacedExisting: z.boolean() })
      .optional(),
    suggestedCopyId: avatarLibraryIdSchema.optional()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:handoffStatus"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    tone: z.enum(["working", "success", "warning", "error"]),
    message: z.string().trim().min(1).max(500),
    sceneFileName: z.string().trim().min(1).max(255).optional(),
    reportFileName: z.string().trim().min(1).max(255).optional()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:operation"),
    operation: z.enum(["browse", "detect", "test", "cancel", "openLog", "openOutput"]),
    tone: z.enum(["working", "success", "warning", "error"]),
    message: z.string().trim().min(1).max(500)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("assets:manifestLoaded"),
    manifest: avatarManifestSchema
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:imageProgress"),
    jobId: pictureJobIdSchema.optional(),
    stage: pictureProgressStageSchema,
    message: z.string().trim().min(1).max(240),
    progress: z.number().finite().min(0).max(1)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:imageSelected"),
    selection: z.object({
      jobId: pictureJobIdSchema,
      previewUri: z.string().trim().min(1).max(4096),
      fileName: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine((value) => !/[\\/]/.test(value), "Picture filename must not contain path separators."),
      width: z.number().int().min(1).max(16_384),
      height: z.number().int().min(1).max(16_384),
      fileSize: z
        .number()
        .int()
        .min(1)
        .max(32 * 1024 * 1024),
      format: z.enum(["png", "jpg"]),
      hasAlpha: z.boolean().nullable(),
      sourceKind: z.enum(["workspace", "external"])
    })
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:imageCancelled"),
    jobId: pictureJobIdSchema.optional(),
    reason: z.enum(["picker", "user", "disposed", "replaced"])
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:imageError"),
    jobId: pictureJobIdSchema.optional(),
    code: pictureErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    recoverable: z.boolean()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:packageProgress"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    stage: z.enum(["staging", "validating", "installing", "activating", "reloading"]),
    message: z.string().trim().min(1).max(240),
    progress: z.number().finite().min(0).max(1)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:packageCollision"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    suggestedCopyId: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:packageSaved"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    avatar: z.object({
      id: z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
      name: z.string().trim().min(1).max(160),
      replacedExisting: z.boolean()
    })
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:packageError"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    code: z.enum([
      "metadata-invalid",
      "validation-failed",
      "install-failed",
      "activation-failed",
      "reload-failed",
      "unknown"
    ]),
    message: z.string().trim().min(1).max(500),
    recoverable: z.boolean()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:vectorProgress"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    stage: vectorProgressStageSchema,
    message: z.string().trim().min(1).max(240),
    progress: z.number().finite().min(0).max(1)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:vectorPreview"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    previewUri: z.string().trim().min(1).max(4096),
    metrics: z.object({
      rawByteSize: z.number().int().min(1).max(5_000_000),
      optimizedByteSize: z.number().int().min(1).max(1_000_000),
      pathCount: z.number().int().min(0).max(20_000),
      groupCount: z.number().int().min(0).max(20_000),
      tinyPathCount: z.number().int().min(0).max(20_000),
      missingLayers: z.array(z.string().trim().min(1).max(120)).max(64),
      warnings: z.array(z.string().trim().min(1).max(500)).max(64)
    })
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:vectorCancelled"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:vectorError"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    code: z.enum(["invalid-options", "trace-failed", "output-limit", "worker-failed"]),
    message: z.string().trim().min(1).max(500),
    recoverable: z.boolean()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:updated"),
    workspaceAvailable: z.boolean(),
    workspaceTrusted: z.boolean(),
    activeId: avatarLibraryIdSchema.nullable(),
    avatars: z
      .array(
        z.object({
          id: avatarLibraryIdSchema,
          name: z.string().trim().min(1).max(255),
          author: z.string().trim().min(1).max(255),
          license: z.string().trim().min(1).max(255),
          version: z.string().trim().min(1).max(160),
          runtime: z.enum(["svg", "pixi", "webgl"]),
          active: z.boolean(),
          builtIn: z.boolean(),
          valid: z.boolean(),
          errorCount: z.number().int().min(0).max(128),
          warningCount: z.number().int().min(0).max(128)
        })
      )
      .max(256)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:validationResult"),
    id: avatarLibraryIdSchema,
    valid: z.boolean(),
    errors: z.array(z.string().trim().min(1).max(500)).max(128),
    warnings: z.array(z.string().trim().min(1).max(500)).max(128)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:status"),
    operation: z.enum(["refresh", "import", "activate", "validate", "reload", "reveal", "export", "remove"]),
    tone: z.enum(["working", "success", "warning", "error"]),
    message: z.string().trim().min(1).max(500)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("debug:event"),
    event: z.string().trim().min(1),
    payload: jsonValueSchema.optional()
  })
]);

export const webviewToExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("webview:ready") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:toggleAssistant") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:resetSettings") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:openAssetsFolder") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:reloadAvatar") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:vectorizeImage") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:exportBlender") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("studio:chooseImage") }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:cancelImageJob"),
    jobId: pictureJobIdSchema.optional()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:vectorizeImage"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    options: vectorizeStudioOptionsSchema
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:cancelVectorization"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:saveAvatar"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000),
    metadata: generatedAvatarMetadataSchema,
    collisionAction: z.enum(["reject", "replace", "copy"])
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:revealAvatar"),
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("studio:copyAvatarPath"),
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("library:refresh") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("library:import") }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:activate"),
    id: avatarLibraryIdSchema.nullable()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:validate"),
    id: avatarLibraryIdSchema.nullable()
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("library:reload") }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:reveal"),
    id: avatarLibraryIdSchema.nullable()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:export"),
    id: avatarLibraryIdSchema
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("library:remove"),
    id: avatarLibraryIdSchema
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("library:openWorkspace") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:refresh") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:browse") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:autoDetect") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:test") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:cancel") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:openLog") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("blender:openOutput") }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:saveAvatar"),
    jobId: pictureJobIdSchema,
    metadata: generatedAvatarMetadataSchema,
    collisionAction: z.enum(["reject", "replace", "copy"])
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("blender:createSceneFromSvg"),
    jobId: pictureJobIdSchema,
    revision: z.number().int().min(1).max(1_000_000)
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("settings:update"),
    config: avatarConfigSchema.partial()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("debug:log"),
    message: z.string().trim().min(1),
    payload: jsonValueSchema.optional()
  })
]);

export type ExtensionToWebviewMessage = z.infer<typeof extensionToWebviewMessageSchema>;
export type WebviewToExtensionMessage = z.infer<typeof webviewToExtensionMessageSchema>;
export type VectorizeStudioOptions = z.infer<typeof vectorizeStudioOptionsSchema>;
export type GeneratedAvatarMetadata = z.infer<typeof generatedAvatarMetadataSchema>;
type WithoutProtocolVersion<T> = T extends { protocolVersion: number } ? Omit<T, "protocolVersion"> : never;
export type ExtensionToWebviewMessageInput = WithoutProtocolVersion<ExtensionToWebviewMessage>;
export type WebviewToExtensionMessageInput = WithoutProtocolVersion<WebviewToExtensionMessage>;

export function createExtensionToWebviewMessage(message: ExtensionToWebviewMessageInput): ExtensionToWebviewMessage {
  return { protocolVersion: AVATAR_PROTOCOL_VERSION, ...message } as ExtensionToWebviewMessage;
}

export function createWebviewToExtensionMessage(message: WebviewToExtensionMessageInput): WebviewToExtensionMessage {
  return { protocolVersion: AVATAR_PROTOCOL_VERSION, ...message } as WebviewToExtensionMessage;
}

export function parseExtensionToWebviewMessage(input: unknown) {
  return extensionToWebviewMessageSchema.safeParse(input);
}

export function parseWebviewToExtensionMessage(input: unknown) {
  return webviewToExtensionMessageSchema.safeParse(input);
}

export function isProtocolSerializable(message: ExtensionToWebviewMessage | WebviewToExtensionMessage): boolean {
  try {
    const serialized = JSON.stringify(message);
    if (serialized === undefined) {
      return false;
    }

    const parsed = JSON.parse(serialized) as unknown;
    return (
      extensionToWebviewMessageSchema.safeParse(parsed).success ||
      webviewToExtensionMessageSchema.safeParse(parsed).success
    );
  } catch {
    return false;
  }
}
