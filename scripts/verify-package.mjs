import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error.message}`);
    return {};
  }
}

function validateSkill(skillName) {
  const relativePath = path.join("skills", skillName, "SKILL.md");
  const source = read(relativePath);
  const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!frontmatter) {
    fail(`Invalid frontmatter in ${relativePath}`);
    return;
  }
  const declaredName = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (declaredName !== skillName) fail(`${relativePath} declares name '${declaredName}'`);
  if (!description || description.includes("TODO")) fail(`${relativePath} has no usable description`);

  for (const match of source.matchAll(/\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g)) {
    const referenced = match[1].split("#")[0];
    if (!referenced) continue;
    const absoluteReference = path.resolve(root, "skills", skillName, referenced);
    if (!existsSync(absoluteReference)) fail(`${relativePath} references missing ${referenced}`);
  }
}

const plugin = readJson(".codex-plugin/plugin.json");
if (plugin.name !== "webdesigner") fail("Plugin name must be webdesigner");
if (plugin.version !== "1.1.0") fail("Plugin version must be 1.1.0");
if (plugin.mcpServers !== "./.mcp.json") fail("Plugin must reference ./.mcp.json");
if (plugin.skills !== "./skills/") fail("Plugin must reference the bundled skills directory");

const mcp = readJson(".mcp.json");
const server = mcp.mcpServers?.webdesigner;
if (!server || server.command !== "node") fail("WebDesigner MCP server is not configured");
const serverEntry = server?.args?.[0];
if (!serverEntry || !existsSync(path.resolve(root, serverEntry))) fail("Bundled MCP entry point is missing");

const marketplace = readJson(".agents/plugins/marketplace.json");
const legacyMarketplace = readJson("marketplace.json");
if (JSON.stringify(marketplace) !== JSON.stringify(legacyMarketplace)) fail("Marketplace files differ");
const entry = marketplace.plugins?.find((candidate) => candidate.name === "webdesigner");
if (!entry) fail("Marketplace does not expose webdesigner");
if (entry?.source?.path !== "./") fail("Marketplace source must resolve to the repository root");
if (entry?.policy?.installation !== "AVAILABLE") fail("Marketplace installation policy must be AVAILABLE");

const requiredSkills = [
  "animation-quality-gate",
  "blender-animation",
  "blender-export",
  "blender-materials",
  "blender-modeling",
  "blender-motion-state-inspection",
  "blender-technical-artist",
  "rigging-animation",
  "webdesigner-design-system"
];
const discoveredSkills = readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(root, "skills", entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .sort();
for (const skillName of requiredSkills) {
  if (!discoveredSkills.includes(skillName)) fail(`Required skill missing: ${skillName}`);
}
for (const skillName of discoveredSkills) validateSkill(skillName);

const tokensSource = read("skills/webdesigner-design-system/assets/tokens.css");
const tailwindSource = read("skills/webdesigner-design-system/assets/tailwind-v4.css");
const tokenNames = [...tokensSource.matchAll(/^\s*(--ng-[a-z0-9-]+)\s*:/gm)].map((match) => match[1]);
const tailwindReferences = [...tailwindSource.matchAll(/var\((--ng-[a-z0-9-]+)\)/g)].map((match) => match[1]);
if (new Set(tokenNames).size !== 86) fail("Nightglass must define exactly 86 unique tokens");
if (tailwindReferences.length !== 86 || new Set(tailwindReferences).size !== 86) fail("Tailwind must map exactly 86 unique tokens");
for (const tokenName of tokenNames) {
  if (!tailwindReferences.includes(tokenName)) fail(`Tailwind mapping missing ${tokenName}`);
}

const notices = read("THIRD_PARTY_NOTICES.md");
for (const pin of [
  "44b6ac731e4b7a5c213951f0b970234ff20b8845",
  "11016c9a5847897491dde935c346571bd7548e3d",
  "e8dcf4e8737921a10088bd5c9eb65e81f74c051f",
  "ed387446052dfbc6b52de149406b70efa65edc59",
  "6641189231caf3752302ae20591bc87fda85fc4e"
]) {
  if (!notices.includes(pin)) fail(`Third-party notice missing ${pin}`);
}

for (const installer of ["install.sh", "install.ps1"]) {
  const source = read(installer);
  if (!source.includes("codex plugin marketplace")) fail(`${installer} does not configure the marketplace`);
  if (!source.includes("codex plugin add")) fail(`${installer} does not install the plugin`);
}

if (failures.length > 0) {
  console.error(failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log(`Verified WebDesigner ${plugin.version}: ${discoveredSkills.length} skills, 86 Nightglass tokens, installers, marketplace, and MCP bundle.`);
