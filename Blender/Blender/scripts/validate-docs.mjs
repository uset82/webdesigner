import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownFiles = [
  "README.md",
  ...(await listMarkdownFiles(path.join(root, "docs"))).filter((file) => file !== "docs/PLAN_CHECKLIST.md")
];
const contents = new Map();

for (const relativeFile of markdownFiles) {
  contents.set(relativeFile, await readFile(path.join(root, relativeFile), "utf8"));
}

for (const [relativeFile, content] of contents) {
  for (const target of extractMarkdownTargets(content)) {
    if (target.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    const [fileTarget] = target.split("#", 1);
    if (!fileTarget) continue;
    const resolved = path.resolve(root, path.dirname(relativeFile), fileTarget);
    assert.equal(isInside(root, resolved), true, `${relativeFile} links outside the repository: ${target}`);
    await readFile(resolved);
  }
}

const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const rootScripts = new Set(Object.keys(rootPackage.scripts));
const documentedPnpmCommands = new Set();
for (const content of contents.values()) {
  for (const match of content.matchAll(/\bpnpm\s+(?:(?:run)\s+)?([a-z][a-z\d:_-]*)/g)) {
    const command = match[1];
    if (!new Set(["install", "add", "update", "list", "exec", "dlx"]).has(command)) documentedPnpmCommands.add(command);
  }
}
for (const command of documentedPnpmCommands) {
  assert.equal(rootScripts.has(command), true, `Documented pnpm command is not a root script: pnpm ${command}`);
}

const extensionPackage = JSON.parse(await readFile(path.join(root, "apps", "extension", "package.json"), "utf8"));
const commandTitles = new Set(extensionPackage.contributes.commands.map((command) => command.title));
for (const content of contents.values()) {
  for (const match of content.matchAll(/`(Codex Avatar: [^`]+)`/g)) {
    assert.equal(commandTitles.has(match[1]), true, `Documented VS Code command is not registered: ${match[1]}`);
  }
}

for (const required of [
  "docs/USER_GUIDE.md",
  "docs/DEVELOPER_SETUP.md",
  "docs/SPRITESHEET_GUIDE.md",
  "docs/RUNTIME_ADAPTERS.md",
  "docs/TROUBLESHOOTING.md",
  "docs/DEMO.md",
  "docs/ARCHITECTURE.md",
  "docs/SECURITY_PRIVACY.md",
  "docs/PERFORMANCE.md",
  "docs/LICENSING.md"
]) {
  assert.equal(contents.has(required), true, `Required documentation is missing: ${required}`);
}

console.log(
  `Documentation validation passed: ${markdownFiles.length} Markdown files, ${documentedPnpmCommands.size} pnpm commands.`
);

async function listMarkdownFiles(directory) {
  const entries = await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = toPosix(path.relative(root, path.join(directory, entry.name)));
    if (entry.isDirectory()) files.push(...(await listMarkdownFiles(path.join(directory, entry.name))));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative);
  }
  return files;
}

function toPosix(value) {
  return value.replaceAll(path.sep, "/");
}

function extractMarkdownTargets(content) {
  return [...content.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1]);
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
