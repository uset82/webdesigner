import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(root, "apps", "webview", "dist");
const destination = path.join(root, "apps", "extension", "media", "webview");

if (!existsSync(source)) {
  throw new Error(`Webview build output does not exist: ${path.relative(root, source)}`);
}

assertInsideWorkspace(source);
assertInsideWorkspace(destination);

rmSync(destination, { force: true, recursive: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { dereference: true, recursive: true });

const forbiddenChunks = collectFiles(destination).filter((filePath) =>
  /rive|live2d|WebGPUAvatarRenderer/i.test(path.basename(filePath))
);
if (forbiddenChunks.length > 0) {
  const relativeChunks = forbiddenChunks.map((filePath) => path.relative(root, filePath)).join(", ");
  throw new Error(`Deferred optional runtime chunks must not enter the Webview bundle: ${relativeChunks}`);
}

console.log(`Copied Webview build to ${path.relative(root, destination)}`);

function assertInsideWorkspace(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify a path outside the workspace: ${target}`);
  }
}

function collectFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
