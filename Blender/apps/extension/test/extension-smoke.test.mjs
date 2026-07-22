import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(extensionRoot, relativePath), "utf8"));
}

test("extension manifest activates every contributed command", async () => {
  const manifest = await readJson("package.json");
  const contributedCommands = manifest.contributes.commands.map((command) => command.command);
  const activationEvents = new Set(manifest.activationEvents);
  const requiredCommands = [
    "codexAvatar.openAssistant",
    "codexAvatar.toggleAssistant",
    "codexAvatar.resetSettings",
    "codexAvatar.openAssetsFolder",
    "codexAvatar.reloadAvatar",
    "codexAvatar.importAvatar",
    "codexAvatar.removeAvatar",
    "codexAvatar.deleteImportedAvatar",
    "codexAvatar.activateAvatar",
    "codexAvatar.clearCache",
    "codexAvatar.setState",
    "codexAvatar.startThinking",
    "codexAvatar.startSpeaking",
    "codexAvatar.emitEvent",
    "codexAvatar.markSuccess",
    "codexAvatar.markError",
    "codexAvatar.createFromPicture",
    "codexAvatar.vectorizeImage",
    "codexAvatar.exportBlenderScene"
  ];

  assert.ok(activationEvents.has("onView:codexAvatar.assistantView"));
  assert.equal(manifest.contributes.views.codexAvatar[0].id, "codexAvatar.assistantView");
  assert.equal(manifest.contributes.views.codexAvatar[0].type, "webview", "assistant view is contributed as a Webview");
  assert.deepEqual(manifest.contributes.configuration.properties["codexAvatar.runtime"].enum, ["svg", "pixi", "webgl"]);
  assert.equal(manifest.contributes.configuration.properties["codexAvatar.blenderPath"].restricted, true);
  assert.equal(manifest.contributes.configuration.properties["codexAvatar.blenderTimeoutSeconds"].default, 120);

  for (const command of requiredCommands) {
    assert.ok(contributedCommands.includes(command), `${command} is contributed`);
  }

  for (const command of contributedCommands) {
    assert.ok(activationEvents.has(`onCommand:${command}`), `${command} has an activation event`);
  }
});

test("compiled extension registers commands and keeps webview CSP strict", async () => {
  const extensionSource = await readFile(path.join(extensionRoot, "dist", "extension.js"), "utf8");
  const providerSource = await readFile(path.join(extensionRoot, "dist", "AvatarWebviewProvider.js"), "utf8");
  const blenderPlanSource = await readFile(path.join(extensionRoot, "dist", "blenderPlan.js"), "utf8");
  const blenderRunnerSource = await readFile(path.join(extensionRoot, "dist", "blenderRunner.js"), "utf8");
  const blenderProbeSource = await readFile(path.join(extensionRoot, "dist", "blenderProbe.js"), "utf8");

  for (const command of [
    "codexAvatar.openAssistant",
    "codexAvatar.toggleAssistant",
    "codexAvatar.resetSettings",
    "codexAvatar.openAssetsFolder",
    "codexAvatar.reloadAvatar",
    "codexAvatar.importAvatar",
    "codexAvatar.removeAvatar",
    "codexAvatar.deleteImportedAvatar",
    "codexAvatar.activateAvatar",
    "codexAvatar.clearCache",
    "codexAvatar.setState",
    "codexAvatar.startThinking",
    "codexAvatar.startSpeaking",
    "codexAvatar.emitEvent",
    "codexAvatar.markSuccess",
    "codexAvatar.markError",
    "codexAvatar.createFromPicture",
    "codexAvatar.vectorizeImage",
    "codexAvatar.exportBlenderScene"
  ]) {
    assert.ok(extensionSource.includes(command), `${command} is present in compiled activation code`);
  }

  assert.ok(providerSource.includes("Content-Security-Policy"), "webview has a CSP meta tag");
  assert.ok(providerSource.includes("default-src 'none'"), "webview denies default remote content");
  assert.ok(providerSource.includes("object-src 'none'"), "webview denies embedded objects");
  assert.doesNotMatch(providerSource, /script-src[^;]*(?:https?:|unsafe-eval)/i, "webview rejects remote scripts");
  assert.ok(extensionSource.includes("isTrusted"), "workspace operations are trust-gated");
  assert.ok(providerSource.includes("assets:manifestLoaded"), "asset reload message is compiled");
  assert.ok(providerSource.includes("asWebviewUri"), "local assets use VS Code webview URIs");
  assert.ok(providerSource.includes("codexAvatarAssetRevision"), "asset reload URIs are cache-versioned");
  assert.ok(providerSource.includes("blender:status"), "typed Blender status is compiled into the provider");
  assert.ok(blenderPlanSource.includes("--disable-autoexec"), "Blender disables scene auto-execution");
  assert.ok(blenderRunnerSource.includes("taskkill.exe"), "Windows Blender process-tree cleanup is compiled");
  assert.ok(blenderProbeSource.includes("BLENDER_PATH"), "Blender environment discovery is compiled");
});

test("extension lifecycle keeps reload cleanup under VS Code subscriptions", async () => {
  const extensionSource = await readFile(path.join(extensionRoot, "dist", "extension.js"), "utf8");

  assert.match(extensionSource, /context\.subscriptions\.push/);
  assert.match(extensionSource, /function deactivate\(\)/);
});
