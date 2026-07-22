import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const webviewRoot = fileURLToPath(new URL("..", import.meta.url));
const webviewOutput = path.resolve(webviewRoot, "..", "extension", "media", "webview");

test("webview build emits the base entry and keeps WebGL in lazy chunks", async () => {
  const files = await readdir(webviewOutput);

  assert.ok(files.includes("index.html"), "index.html is emitted");
  assert.ok(files.includes("index.js"), "index.js is emitted");
  assert.ok(files.includes("index.css"), "index.css is emitted");
  assert.ok(files.includes("WebGLAvatarRenderer.js"), "WebGL renderer is emitted as a lazy chunk");
  assert.ok(files.includes("GLTFLoader.js"), "GLTFLoader is emitted separately for deferred GLB loading");
  const deferredRuntimeChunks = files.filter((fileName) => /rive|live2d|WebGPUAvatarRenderer/i.test(fileName));
  assert.deepEqual(deferredRuntimeChunks, [], "unimplemented optional runtime chunks stay out of the Webview bundle");
});

test("webview bundle includes the Studio and avatar-library bridge actions", async () => {
  const html = await readFile(path.join(webviewOutput, "index.html"), "utf8");
  const script = await readFile(path.join(webviewOutput, "index.js"), "utf8");
  const styles = await readFile(path.join(webviewOutput, "index.css"), "utf8");

  assert.ok(html.includes('<div id="root"></div>'), "React root is present");
  assert.ok(styles.includes(".asset-manager-panel"), "asset manager styles are bundled");
  assert.ok(styles.includes(".avatar-library-panel"), "avatar library styles are bundled");
  assert.ok(styles.includes(".picture-studio-panel"), "picture Studio styles are bundled");
  assert.match(styles, /pointer-events:\s*none/, "avatar surfaces do not capture pointer input");

  for (const command of [
    "studio:chooseImage",
    "studio:cancelImageJob",
    "studio:vectorizeImage",
    "studio:cancelVectorization",
    "studio:saveAvatar",
    "studio:revealAvatar",
    "studio:copyAvatarPath",
    "library:import",
    "library:activate",
    "library:validate",
    "library:reload",
    "library:reveal",
    "library:export",
    "library:remove",
    "library:openWorkspace",
    "blender:refresh",
    "blender:browse",
    "blender:autoDetect",
    "blender:test",
    "blender:cancel",
    "blender:openLog",
    "blender:openOutput"
  ]) {
    assert.ok(script.includes(command), `${command} is wired into the bundle`);
  }

  assert.ok(script.includes("assets:manifestLoaded"), "manifest reload message is handled");
  assert.ok(script.includes("library:validationResult"), "structured package validation is handled");
  assert.ok(script.includes("blender:status"), "typed Blender connection status is handled");
  assert.ok(styles.includes(".blender-tools-panel"), "Blender Tools styles are bundled");
  assert.ok(script.includes("License"), "license metadata is visible in the asset manager");
  assert.ok(script.includes("noAnimation"), "no-animation setting is wired into the Webview");
  assert.match(styles, /forced-colors:\s*active/, "high-contrast styles are bundled");
});

test("primary actions are unique and technical settings stay out of the initial flow", async () => {
  const panelSource = await readFile(path.join(webviewRoot, "src", "components", "AvatarPanel.tsx"), "utf8");
  const settingsSource = await readFile(path.join(webviewRoot, "src", "components", "SettingsPanel.tsx"), "utf8");

  for (const label of ["Create from Picture", "Import Avatar", "Blender Tools"]) {
    assert.equal(panelSource.split(label).length - 1, 1, `${label} has one primary action`);
  }
  assert.doesNotMatch(panelSource, /command:toggleAssistant|command:vectorizeImage/);
  assert.match(settingsSource, /<details className="advanced-settings">/);
  assert.doesNotMatch(settingsSource, /config:\s*\{\s*character:|>Avatar</);
});

test("webview source does not call remote network APIs", async () => {
  const sourceFiles = await readSourceFiles(path.join(webviewRoot, "src"));
  const bannedTokens = [
    "fetch(",
    "new WebSocket",
    "XMLHttpRequest",
    "EventSource",
    "navigator.sendBeacon",
    "getUserMedia"
  ];

  for (const filePath of sourceFiles) {
    const source = await readFile(filePath, "utf8");
    for (const token of bannedTokens) {
      assert.equal(source.includes(token), false, `${path.relative(webviewRoot, filePath)} uses ${token}`);
    }
  }
});

test("webview pauses optional runtimes and recovers to SVG after initialization failure", async () => {
  const stageSource = await readFile(path.join(webviewRoot, "src", "components", "AvatarStage.tsx"), "utf8");
  const svgSource = await readFile(path.join(webviewRoot, "src", "renderers", "SvgAvatarRenderer.tsx"), "utf8");
  const layeredSource = await readFile(path.join(webviewRoot, "src", "renderers", "LayeredMascotRenderer.tsx"), "utf8");
  const settingsSource = await readFile(path.join(webviewRoot, "src", "components", "SettingsPanel.tsx"), "utf8");
  const pixiSource = await readFile(path.join(webviewRoot, "src", "renderers", "PixiAvatarRenderer.tsx"), "utf8");
  const visibilityHook = await readFile(path.join(webviewRoot, "src", "hooks", "usePageVisibility.ts"), "utf8");
  const pictureStudioSource = await readFile(
    path.join(webviewRoot, "src", "components", "PictureStudioPanel.tsx"),
    "utf8"
  );

  assert.match(stageSource, /RuntimeBoundary/);
  assert.match(stageSource, /usePageVisibility/);
  assert.match(stageSource, /supportsWebGL2/);
  assert.match(stageSource, /Boolean\(webglAssetUri\) && webglSupported/);
  assert.match(stageSource, /resolveManifestSvgUri\(manifest\)/);
  assert.match(stageSource, /shouldUseLayeredMascot\(manifest\)/);
  assert.match(stageSource, /<LayeredMascotRenderer/);
  assert.match(svgSource, /<img/);
  assert.match(svgSource, /onError=/);
  assert.match(svgSource, /avatar-svg-builtin/);
  assert.doesNotMatch(svgSource, /dangerouslySetInnerHTML|<object|<iframe|<embed/);
  assert.match(layeredSource, /data-layer="avatar\/eyes\/left"/);
  assert.match(layeredSource, /data-layer="avatar\/mouth"/);
  assert.match(layeredSource, /data-layer="avatar\/reactions"/);
  assert.doesNotMatch(layeredSource, /dangerouslySetInnerHTML|<object|<iframe|<embed/);
  assert.match(pictureStudioSource, /preview\.previewUri/);
  assert.doesNotMatch(pictureStudioSource, /dangerouslySetInnerHTML|<object|<iframe|<embed/);
  assert.match(settingsSource, /value="webgl"/);
  assert.doesNotMatch(settingsSource, /value="(?:rive|live2d|webgpu|vrm|inochi2d)"/);
  assert.match(pixiSource, /initializeTimeoutMs/);
  assert.match(pixiSource, /setVisible\(pageVisible\)/);
  assert.match(visibilityHook, /visibilitychange/);
});

async function readSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readSourceFiles(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}
