import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const node = process.execPath;
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const vite = path.join(root, "apps", "webview", "node_modules", "vite", "bin", "vite.js");

const command = process.argv[2];

switch (command) {
  case "build":
    build();
    break;
  case "typecheck":
  case "lint":
    typecheck();
    break;
  case "test":
    test();
    break;
  default:
    console.error("Usage: node scripts/workspace-checks.mjs <build|typecheck|lint|test>");
    process.exit(1);
}

function build() {
  runTsc("packages/avatar-core/tsconfig.json");
  runTsc("packages/asset-pipeline/tsconfig.json");
  runTsc("apps/extension/tsconfig.json");
  run(node, [vite, "build"], path.join(root, "apps", "webview"));
}

function typecheck() {
  runTsc("packages/avatar-core/tsconfig.json", "--noEmit");
  runTsc("packages/asset-pipeline/tsconfig.json", "--noEmit");
  runTsc("apps/extension/tsconfig.json", "--noEmit");
  runTsc("apps/webview/tsconfig.json", "--noEmit");
}

function test() {
  runTsc("packages/avatar-core/tsconfig.json");
  runNodeTests(path.join(root, "packages", "avatar-core", "dist", "test"));

  runTsc("packages/asset-pipeline/tsconfig.json");
  runNodeTests(path.join(root, "packages", "asset-pipeline", "dist", "test"));

  runTsc("apps/extension/tsconfig.json");
  runNodeTests(path.join(root, "apps", "extension", "test"));

  run(node, [vite, "build"], path.join(root, "apps", "webview"));
  runNodeTests(path.join(root, "apps", "webview", "test"));
}

function runTsc(project, ...extraArgs) {
  run(node, [tsc, "-p", path.join(root, project), ...extraArgs], root);
}

function runNodeTests(directory) {
  const testFiles = readdirSync(directory)
    .filter((fileName) => /\.(test|spec)\.(js|mjs)$/.test(fileName))
    .map((fileName) => path.join(directory, fileName));

  if (testFiles.length === 0) {
    throw new Error(`No test files found in ${directory}`);
  }

  run(node, ["--test", ...testFiles], root);
}

function run(executable, args, cwd) {
  execFileSync(executable, args, { cwd, stdio: "inherit" });
}
