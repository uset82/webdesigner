import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.argv[2] ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));

if (!existsSync(vsixPath)) throw new Error(`VSIX does not exist: ${vsixPath}`);

const entries = execFileSync("tar", ["-tf", vsixPath], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);
const entrySet = new Set(entries);

for (const required of [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/package.json",
  "extension/dist/extension.js",
  "extension/dist/vectorizeWorker.js",
  "extension/media/webview/index.html",
  "extension/media/webview/index.js",
  "extension/media/webview/index.css",
  "extension/media/webview/WebGLAvatarRenderer.js",
  "extension/media/webview/GLTFLoader.js",
  "extension/media/avatars/avatar.manifest.json",
  "extension/media/avatars/svg/placeholder-avatar.svg",
  "extension/media/avatars/pixi/placeholder-spritesheet.svg",
  "extension/media/avatars/pixi/placeholder-spritesheet.json",
  "extension/LICENSE.txt",
  "extension/THIRD_PARTY_NOTICES.md",
  "extension/changelog.md"
]) {
  assert.ok(entrySet.has(required), `VSIX contains ${required}`);
}

const forbiddenPatterns = [
  /(^|\/)src\//i,
  /(^|\/)test\//i,
  /(^|\/)node_modules\//i,
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)\.codex-avatar\//i,
  /cholita/i,
  /\.(?:blend|blend1|glb)$/i,
  /\.(?:ts|tsx|map|tsbuildinfo)$/i,
  /(^|\/)(?:research|fixtures|optional-sdk)\//i,
  /\.(?:moc3|model3\.json|cubism)$/i
];
for (const entry of entries) {
  assert.equal(
    forbiddenPatterns.some((pattern) => pattern.test(entry)),
    false,
    `VSIX excludes development or proprietary asset ${entry}`
  );
}

assert.ok(
  entries.some((entry) => entry.endsWith("/placeholder-avatar.svg")),
  "VSIX contains the clean-room SVG fallback"
);
assert.ok(
  entries.some((entry) => entry.endsWith("/import_svg_scene.py")),
  "VSIX contains the SVG curve handoff script"
);
assert.ok(
  entries.some((entry) => entry.endsWith("/placeholder-spritesheet.svg")),
  "VSIX contains the clean-room Pixi avatar"
);

const extensionBundle = execFileSync("tar", ["-xOf", vsixPath, "extension/dist/extension.js"], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024
});
assert.doesNotMatch(extensionBundle, /potrace/i, "VSIX does not contain the removed GPL-2.0 Potrace runtime");
for (const requiredBlenderFeature of [
  "--disable-autoexec",
  "taskkill.exe",
  "BLENDER_PATH",
  "blender:status",
  "blender:handoffStatus",
  "Blender version probe timed out"
]) {
  assert.ok(
    extensionBundle.includes(requiredBlenderFeature),
    `VSIX includes Blender safety feature: ${requiredBlenderFeature}`
  );
}

const webviewBundle = execFileSync("tar", ["-xOf", vsixPath, "extension/media/webview/index.js"], {
  encoding: "utf8",
  maxBuffer: 2 * 1024 * 1024
});
for (const label of [
  "Blender Tools",
  "Auto-detect",
  "Test Connection",
  "Open Output Folder",
  "Create Blender Scene from SVG"
]) {
  assert.ok(webviewBundle.includes(label), `VSIX Webview includes ${label}`);
}

console.log(`VSIX contents validated: ${path.basename(vsixPath)} (${entries.length} files)`);
