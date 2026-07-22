import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const generatedDirectories = [
  "dist",
  "apps/extension/dist",
  "apps/extension/media/webview",
  "apps/webview/dist",
  "packages/avatar-core/dist",
  "packages/asset-pipeline/dist",
  "packages/runtime-pixi/dist"
].map((relativePath) => path.join(root, relativePath));

for (const directory of generatedDirectories) {
  assertInsideWorkspace(directory);
  if (existsSync(directory)) {
    rmSync(directory, { force: true, recursive: true });
    console.log(`Removed ${path.relative(root, directory)}`);
  }
}

console.log("Clean completed without touching user avatar assets.");

function assertInsideWorkspace(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove a path outside the workspace: ${target}`);
  }
}
