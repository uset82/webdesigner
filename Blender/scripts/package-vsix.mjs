import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensionRoot = path.join(root, "apps", "extension");
const dist = path.join(root, "dist");
const stage = path.join(dist, `vsix-stage-${process.pid}`);
const extensionPackage = JSON.parse(readFileSync(path.join(extensionRoot, "package.json"), "utf8"));
const baseVersion = extensionPackage.version;
const version =
  process.env.VSIX_VERSION ?? (process.argv.includes("--pre-release") ? `${baseVersion}-pre.1` : baseVersion);
const packageName = `codex-avatar-studio-${version}.vsix`;
const output = path.join(dist, packageName);
const vsceExecutable = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vsce.CMD" : "vsce");
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

mkdirSync(dist, { recursive: true });
cleanupOldStages();
mkdirSync(stage, { recursive: true });

run(pnpmExecutable, ["run", "build"], root);

for (const fileName of ["README.md", "CHANGELOG.md", "LICENSE", "THIRD_PARTY_NOTICES.md"]) {
  copyFileSync(path.join(root, fileName), path.join(stage, fileName));
}

copyFileSync(path.join(extensionRoot, "package.json"), path.join(stage, "package.json"));
copyFileSync(path.join(extensionRoot, ".vscodeignore"), path.join(stage, ".vscodeignore"));
cpSync(path.join(extensionRoot, "media"), path.join(stage, "media"), {
  dereference: true,
  recursive: true
});
cpSync(path.join(root, "scripts", "blender"), path.join(stage, "media", "blender"), {
  dereference: true,
  filter: (source) => !source.endsWith("AGENTS.md") && !source.endsWith("create_smoke_fixture.py"),
  recursive: true
});
mkdirSync(path.join(stage, "dist"), { recursive: true });

const bundleCssTreeDataPlugin = {
  name: "bundle-css-tree-data",
  setup(build) {
    build.onLoad({ filter: /[\\/](?:css-tree|csso)[\\/](?:lib|dist)[\\/](?:data|data-patch|version)\.js$/ }, (args) => {
      const contents = readFileSync(args.path, "utf8")
        .replace(/import\s+\{\s*createRequire\s*\}\s+from\s+["']module["'];\s*/g, "")
        .replace(/const\s+require\s*=\s*createRequire\(import\.meta\.url\);\s*/g, "");
      return { contents, loader: "js" };
    });
  }
};

await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [path.join(root, "apps", "extension", "src", "extension.ts")],
  external: ["vscode"],
  format: "cjs",
  logLevel: "silent",
  outfile: path.join(stage, "dist", "extension.js"),
  platform: "node",
  sourcemap: true,
  target: "node20",
  plugins: [bundleCssTreeDataPlugin]
});

await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [path.join(root, "apps", "extension", "src", "vectorizeWorker.ts")],
  format: "cjs",
  logLevel: "silent",
  outfile: path.join(stage, "dist", "vectorizeWorker.js"),
  platform: "node",
  sourcemap: true,
  target: "node20",
  plugins: [bundleCssTreeDataPlugin]
});

const manifestPath = path.join(stage, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
manifest.private = false;
manifest.scripts = {};
delete manifest.dependencies;
delete manifest.devDependencies;
delete manifest.packageManager;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

rmSync(output, { force: true });
run(vsceExecutable, ["package", "--allow-missing-repository", "--no-dependencies", "--out", output], stage);
run(process.execPath, [path.join(root, "scripts", "validate-vsix.mjs"), output], root);
rmSync(stage, { force: true, recursive: true });

console.log(`Created ${path.relative(root, output)}`);

function cleanupOldStages() {
  for (const entry of readdirSync(dist, { withFileTypes: true })) {
    if (entry.isDirectory() && /^vsix-stage(?:-\d+)?$/.test(entry.name)) {
      rmSync(path.join(dist, entry.name), { force: true, recursive: true });
    }
  }
}

function run(command, args, cwd) {
  const useShell = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  execFileSync(command, args, { cwd, shell: useShell, stdio: "inherit" });
}
