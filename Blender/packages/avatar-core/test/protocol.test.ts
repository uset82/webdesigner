import assert from "node:assert/strict";
import { test } from "vitest";
import {
  AVATAR_PROTOCOL_VERSION,
  type AvatarConfig,
  type AvatarManifest,
  createExtensionToWebviewMessage,
  createWebviewToExtensionMessage,
  type ExtensionToWebviewMessageInput,
  isProtocolSerializable,
  parseExtensionToWebviewMessage,
  parseWebviewToExtensionMessage,
  type WebviewToExtensionMessageInput
} from "../src/index.js";

const config: AvatarConfig = {
  enabled: true,
  runtime: "svg",
  position: "activity-bar-view",
  character: "default",
  animationIntensity: "medium",
  frameRate: 30,
  particleEffects: true,
  soundEnabled: false,
  lipSyncEnabled: false,
  idleTimeout: 15,
  sleepTimeout: 300,
  debugOverlay: false,
  noAnimation: false,
  focusMode: false,
  showSpeechBubble: true,
  respectReducedMotion: true,
  blenderPath: "",
  assetWorkspace: ".codex-avatar"
};

const manifest: AvatarManifest = {
  schemaVersion: 1,
  id: "default-coder-orb",
  name: "Default Coder Orb",
  version: "0.1.0",
  author: "Codex Avatar Studio contributors",
  license: "UNLICENSED (original project work)",
  preferredRuntime: "svg",
  fallbackRuntime: "svg",
  entrypoints: { svg: "avatars/svg/placeholder-avatar.svg" },
  capabilities: ["state-animation", "reduced-motion"],
  states: { idle: "idle_loop" }
};

const pictureJobId = "00000000-0000-4000-8000-000000000001";

const extensionMessages: ExtensionToWebviewMessageInput[] = [
  { type: "avatar:initialize", config, manifest },
  { type: "avatar:setState", state: "thinking" },
  { type: "avatar:trigger", trigger: "blink" },
  { type: "avatar:setMessage", text: "Thinking." },
  { type: "avatar:setPoseInput", input: { speechLevel: 0.4 } },
  { type: "settings:update", config },
  {
    type: "blender:status",
    availability: "ready",
    busy: false,
    executablePath: "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe",
    source: "platform",
    version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3 LTS" },
    support: "supported",
    capabilities: ["svg", "glb", "png"],
    configuredPathInvalid: false,
    message: "Blender 4.5.3 is ready."
  },
  {
    type: "blender:operation",
    operation: "test",
    tone: "success",
    message: "Blender connection passed."
  },
  {
    type: "blender:exportResult",
    jobId: pictureJobId,
    sourceFile: "Mascot.blend",
    results: [
      {
        status: "success",
        mode: "svg",
        fileName: "Mascot.line-art.svg",
        reportFileName: "Mascot.svg.export-report.json"
      },
      { status: "failed", mode: "glb", message: "No exportable mesh." }
    ],
    canUseAsAvatar: true
  },
  {
    type: "blender:avatarSaveStatus",
    jobId: pictureJobId,
    tone: "success",
    message: "Mascot is active.",
    avatar: { id: "mascot", name: "Mascot", replacedExisting: false }
  },
  {
    type: "blender:handoffStatus",
    jobId: pictureJobId,
    revision: 1,
    tone: "success",
    message: "Editable Blender scene created.",
    sceneFileName: "Mascot.working.blend",
    reportFileName: "Mascot.scene.export-report.json"
  },
  { type: "assets:manifestLoaded", manifest },
  { type: "studio:imageProgress", stage: "validating", message: "Checking picture.", progress: 0.4 },
  {
    type: "studio:imageSelected",
    selection: {
      jobId: pictureJobId,
      previewUri: "vscode-webview://avatar/preview.png",
      fileName: "avatar.png",
      width: 512,
      height: 512,
      fileSize: 4096,
      format: "png",
      hasAlpha: true,
      sourceKind: "external"
    }
  },
  { type: "studio:imageCancelled", reason: "picker" },
  {
    type: "studio:imageError",
    code: "invalid-image",
    message: "The picture could not be read.",
    recoverable: true
  },
  {
    type: "studio:vectorProgress",
    jobId: pictureJobId,
    revision: 1,
    stage: "tracing",
    message: "Tracing picture shapes.",
    progress: 0.55
  },
  {
    type: "studio:vectorPreview",
    jobId: pictureJobId,
    revision: 1,
    previewUri: "vscode-webview://avatar/optimized.svg",
    metrics: {
      rawByteSize: 2048,
      optimizedByteSize: 1024,
      pathCount: 12,
      groupCount: 1,
      tinyPathCount: 2,
      missingLayers: ["avatar/head"],
      warnings: ["Static trace only."]
    }
  },
  { type: "studio:vectorCancelled", jobId: pictureJobId, revision: 2 },
  {
    type: "studio:vectorError",
    jobId: pictureJobId,
    revision: 3,
    code: "output-limit",
    message: "Generated SVG exceeds the path limit.",
    recoverable: true
  },
  {
    type: "studio:packageProgress",
    jobId: pictureJobId,
    revision: 1,
    stage: "installing",
    message: "Installing avatar package.",
    progress: 0.62
  },
  {
    type: "studio:packageCollision",
    jobId: pictureJobId,
    revision: 1,
    id: "my-avatar",
    suggestedCopyId: "my-avatar-2"
  },
  {
    type: "studio:packageSaved",
    jobId: pictureJobId,
    revision: 1,
    avatar: { id: "my-avatar", name: "My Avatar", replacedExisting: false }
  },
  {
    type: "studio:packageError",
    jobId: pictureJobId,
    revision: 1,
    code: "validation-failed",
    message: "Generated package is invalid.",
    recoverable: true
  },
  {
    type: "library:updated",
    workspaceAvailable: true,
    workspaceTrusted: true,
    activeId: "my-avatar",
    avatars: [
      {
        id: "my-avatar",
        name: "My Avatar",
        author: "Test Artist",
        license: "UNLICENSED",
        version: "1.0.0",
        runtime: "webgl",
        active: true,
        builtIn: false,
        valid: true,
        errorCount: 0,
        warningCount: 1
      }
    ]
  },
  {
    type: "library:validationResult",
    id: "my-avatar",
    valid: false,
    errors: ["Checksum mismatch."],
    warnings: ["Optional preview is missing."]
  },
  { type: "library:status", operation: "validate", tone: "success", message: "Validation finished." },
  { type: "library:status", operation: "export", tone: "success", message: "Avatar package exported." },
  { type: "debug:event", event: "test", payload: { ok: true } }
];

const webviewMessages: WebviewToExtensionMessageInput[] = [
  { type: "webview:ready" },
  { type: "command:toggleAssistant" },
  { type: "command:resetSettings" },
  { type: "command:openAssetsFolder" },
  { type: "command:reloadAvatar" },
  { type: "command:vectorizeImage" },
  { type: "command:exportBlender" },
  { type: "studio:chooseImage" },
  { type: "studio:cancelImageJob", jobId: pictureJobId },
  {
    type: "studio:vectorizeImage",
    jobId: pictureJobId,
    revision: 1,
    options: {
      preset: "color-illustration",
      grayscale: false,
      colorCount: 16,
      threshold: null,
      removeNearWhite: true,
      noiseReduction: 10,
      detail: "balanced"
    }
  },
  { type: "studio:cancelVectorization", jobId: pictureJobId, revision: 1 },
  {
    type: "studio:saveAvatar",
    jobId: pictureJobId,
    revision: 1,
    metadata: {
      id: "my-avatar",
      name: "My Avatar",
      author: "Test Artist",
      version: "1.0.0",
      license: "UNLICENSED"
    },
    collisionAction: "reject"
  },
  { type: "studio:revealAvatar", id: "my-avatar" },
  { type: "studio:copyAvatarPath", id: "my-avatar" },
  { type: "library:refresh" },
  { type: "library:import" },
  { type: "library:activate", id: "my-avatar" },
  { type: "library:activate", id: null },
  { type: "library:validate", id: "my-avatar" },
  { type: "library:validate", id: null },
  { type: "library:reload" },
  { type: "library:reveal", id: "my-avatar" },
  { type: "library:reveal", id: null },
  { type: "library:export", id: "my-avatar" },
  { type: "library:remove", id: "my-avatar" },
  { type: "library:openWorkspace" },
  { type: "blender:refresh" },
  { type: "blender:browse" },
  { type: "blender:autoDetect" },
  { type: "blender:test" },
  { type: "blender:cancel" },
  { type: "blender:openLog" },
  { type: "blender:openOutput" },
  {
    type: "blender:saveAvatar",
    jobId: pictureJobId,
    metadata: { id: "mascot", name: "Mascot", author: "Test Artist", version: "1.0.0", license: "UNLICENSED" },
    collisionAction: "reject"
  },
  { type: "blender:createSceneFromSvg", jobId: pictureJobId, revision: 1 },
  { type: "settings:update", config: { focusMode: true } },
  { type: "debug:log", message: "test", payload: ["ok"] }
];

test("all extension-to-Webview message variants are versioned, serializable, and parseable", () => {
  for (const input of extensionMessages) {
    const message = createExtensionToWebviewMessage(input);
    assert.equal(message.protocolVersion, AVATAR_PROTOCOL_VERSION);
    assert.equal(parseExtensionToWebviewMessage(JSON.parse(JSON.stringify(message))).success, true);
    assert.equal(isProtocolSerializable(message), true);
  }
});

test("all Webview-to-extension message variants are versioned, serializable, and parseable", () => {
  for (const input of webviewMessages) {
    const message = createWebviewToExtensionMessage(input);
    assert.equal(message.protocolVersion, AVATAR_PROTOCOL_VERSION);
    assert.equal(parseWebviewToExtensionMessage(JSON.parse(JSON.stringify(message))).success, true);
    assert.equal(isProtocolSerializable(message), true);
  }
});

test("unknown types and protocol versions are rejected without throwing", () => {
  assert.doesNotThrow(() => {
    const unknown = parseWebviewToExtensionMessage({ protocolVersion: AVATAR_PROTOCOL_VERSION, type: "unknown:event" });
    const wrongVersion = parseWebviewToExtensionMessage({ protocolVersion: 999, type: "webview:ready" });
    assert.equal(unknown.success, false);
    assert.equal(wrongVersion.success, false);
  });
});

test("malformed payloads are rejected at the runtime boundary", () => {
  const result = parseExtensionToWebviewMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "avatar:setPoseInput",
    input: { speechLevel: 2 }
  });

  assert.equal(result.success, false);

  const invalidVectorOptions = parseWebviewToExtensionMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "studio:vectorizeImage",
    jobId: pictureJobId,
    revision: 1,
    options: {
      preset: "color-illustration",
      grayscale: false,
      colorCount: 32,
      threshold: 999,
      removeNearWhite: true,
      noiseReduction: -1,
      detail: "unbounded"
    }
  });
  assert.equal(invalidVectorOptions.success, false);

  const missingRightsStatement = parseWebviewToExtensionMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "studio:saveAvatar",
    jobId: pictureJobId,
    revision: 1,
    metadata: {
      id: "my-avatar",
      name: "My Avatar",
      author: "Test Artist",
      version: "1.0.0",
      license: ""
    },
    collisionAction: "reject"
  });
  assert.equal(missingRightsStatement.success, false);

  const unsafeLibraryId = parseWebviewToExtensionMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "library:remove",
    id: "../outside"
  });
  assert.equal(unsafeLibraryId.success, false);

  const oversizedLibraryId = parseExtensionToWebviewMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "library:updated",
    workspaceAvailable: true,
    workspaceTrusted: true,
    activeId: null,
    avatars: [
      {
        id: "a".repeat(81),
        name: "Too long",
        author: "Test",
        license: "Test",
        version: "1.0.0",
        runtime: "svg",
        active: false,
        builtIn: false,
        valid: false,
        errorCount: 1,
        warningCount: 0
      }
    ]
  });
  assert.equal(oversizedLibraryId.success, false);

  const invalidBlenderCapability = parseExtensionToWebviewMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "blender:status",
    availability: "ready",
    busy: false,
    executablePath: "blender",
    source: "path",
    version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3" },
    support: "supported",
    capabilities: ["arbitrary-code"],
    configuredPathInvalid: false,
    message: "Ready."
  });
  assert.equal(invalidBlenderCapability.success, false);
});
