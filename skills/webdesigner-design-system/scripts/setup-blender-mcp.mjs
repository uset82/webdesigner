import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BLENDER_MCP_VERSION = "1.6.4";
export const BLENDER_MCP_ADDON_COMMIT = "6641189231caf3752302ae20591bc87fda85fc4e";
export const BLENDER_MCP_ADDON_SHA256 = "bba60831f5f89a74deda0294b131668a086cf46eb35a6a01abbd0d21d9e92630";
export const BLENDER_MCP_ADDON_URL = `https://raw.githubusercontent.com/ahujasid/blender-mcp/${BLENDER_MCP_ADDON_COMMIT}/addon.py`;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function decideAddonInstall(currentHash, expectedHash = BLENDER_MCP_ADDON_SHA256, replace = false) {
  if (currentHash === expectedHash) return "already-installed";
  if (currentHash && !replace) return "refuse-unexpected-existing-addon";
  return currentHash ? "replace" : "install";
}

export function parseArgs(argv) {
  const options = { blenderPath: undefined, replace: false, verifyOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--blender") options.blenderPath = argv[++index];
    else if (value === "--replace") options.replace = true;
    else if (value === "--verify-only") options.verifyOnly = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function commandPath(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  try {
    return execFileSync(locator, [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
  } catch {
    return undefined;
  }
}

function findBlender(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.BLENDER_PATH,
    commandPath("blender"),
    process.platform === "win32" ? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" : undefined
  ].filter(Boolean);
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error("Blender was not found. Pass --blender <path> or set BLENDER_PATH.");
  const version = execFileSync(match, ["--version"], { encoding: "utf8" });
  if (!/^Blender\s+\d+\.\d+/m.test(version)) throw new Error(`Configured executable is not Blender: ${match}`);
  return path.resolve(match);
}

function runBlenderExpression(blenderPath, expression, factoryStartup = true) {
  const args = ["--background"];
  if (factoryStartup) args.push("--factory-startup");
  args.push("--python-expr", expression);
  return execFileSync(blenderPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      DISABLE_TELEMETRY: "true",
      BLENDER_MCP_DISABLE_TELEMETRY: "true",
      MCP_DISABLE_TELEMETRY: "true"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 60_000
  });
}

function blenderAddonRoot(blenderPath) {
  const marker = "CODEX_BLENDER_ADDONS=";
  const output = runBlenderExpression(
    blenderPath,
    `import bpy; print(${JSON.stringify(marker)} + bpy.utils.user_resource('SCRIPTS', path='addons', create=True))`
  );
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(marker));
  if (!line) throw new Error("Blender did not report its user add-ons directory.");
  return path.resolve(line.slice(marker.length).trim());
}

async function fetchPinnedAddon() {
  const response = await fetch(BLENDER_MCP_ADDON_URL, { redirect: "error" });
  if (!response.ok) throw new Error(`Unable to download Blender MCP add-on (${response.status}).`);
  const payload = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(payload);
  if (actualHash !== BLENDER_MCP_ADDON_SHA256) {
    throw new Error(`Blender MCP add-on checksum mismatch: expected ${BLENDER_MCP_ADDON_SHA256}, got ${actualHash}.`);
  }
  return payload;
}

function verifyUvx() {
  const uvx = commandPath("uvx");
  if (!uvx) throw new Error("uvx is not available on PATH. Install uv before restarting Codex.");
  const output = execFileSync(uvx, ["--version"], { encoding: "utf8", timeout: 10_000 }).trim();
  return { path: uvx, version: output };
}

function enableAddon(blenderPath) {
  const expression = [
    "import addon_utils, bpy",
    "bpy.ops.preferences.addon_enable(module='blender_mcp')",
    "bpy.ops.wm.save_userpref()",
    "loaded, enabled = addon_utils.check('blender_mcp')",
    "print('CODEX_BLENDER_MCP_ENABLED=' + str(bool(enabled)).lower())"
  ].join("; ");
  const output = runBlenderExpression(blenderPath, expression);
  if (!output.includes("CODEX_BLENDER_MCP_ENABLED=true")) {
    throw new Error("Blender MCP add-on was copied but Blender did not confirm that it is enabled.");
  }
}

function applyRestrictedPreferences(blenderPath) {
  const expression = [
    "import bpy",
    "prefs = bpy.context.preferences.addons['blender_mcp'].preferences",
    "prefs.telemetry_consent = False",
    "bpy.ops.wm.save_userpref()",
    "print('CODEX_BLENDER_MCP_RESTRICTED=true')"
  ].join("; ");
  const output = runBlenderExpression(blenderPath, expression, false);
  if (!output.includes("CODEX_BLENDER_MCP_RESTRICTED=true")) {
    throw new Error("Blender did not confirm the restricted MCP preferences.");
  }
}

function addonIsEnabled(blenderPath) {
  const output = runBlenderExpression(
    blenderPath,
    "import addon_utils; loaded, enabled = addon_utils.check('blender_mcp'); print('CODEX_BLENDER_MCP_ENABLED=' + str(bool(enabled)).lower())",
    false
  );
  return output.includes("CODEX_BLENDER_MCP_ENABLED=true");
}

function readAddonConfiguration(blenderPath) {
  const marker = "CODEX_BLENDER_MCP_CONFIG=";
  const snapshot = [
    "{'port': int(scene.blendermcp_port)",
    "'autoStart': bool(scene.blendermcp_auto_start_server)",
    "'polyHaven': bool(scene.blendermcp_use_polyhaven)",
    "'sketchfab': bool(scene.blendermcp_use_sketchfab)",
    "'hyper3d': bool(scene.blendermcp_use_hyper3d)",
    "'hunyuan': bool(scene.blendermcp_use_hunyuan3d)",
    "'telemetry': bool(getattr(prefs, 'telemetry_consent', False))}"
  ].join(", ");
  const expression = [
    "import bpy, json",
    "scene = bpy.context.scene",
    "prefs = bpy.context.preferences.addons['blender_mcp'].preferences",
    `print(${JSON.stringify(marker)} + json.dumps(${snapshot}))`
  ].join("; ");
  const output = runBlenderExpression(blenderPath, expression, false);
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(marker));
  if (!line) throw new Error("Blender MCP add-on configuration could not be inspected.");
  return JSON.parse(line.slice(marker.length));
}

function assertRestrictedConfiguration(configuration) {
  if (configuration.port !== 9876) {
    throw new Error(`Blender MCP must use local port 9876; found ${configuration.port}.`);
  }
  if (!configuration.autoStart) {
    throw new Error("Blender MCP auto-start is disabled. Enable it before using the guarded host launcher.");
  }
  const enabledRemote = ["polyHaven", "sketchfab", "hyper3d", "hunyuan", "telemetry"]
    .filter((key) => configuration[key]);
  if (enabledRemote.length > 0) {
    throw new Error(`Restricted Blender MCP configuration is not active; disable: ${enabledRemote.join(", ")}.`);
  }
}

export async function setupBlenderMcp(options = {}) {
  const blenderPath = findBlender(options.blenderPath);
  const uvx = verifyUvx();
  const addonRoot = blenderAddonRoot(blenderPath);
  const addonDir = path.join(addonRoot, "blender_mcp");
  const addonPath = path.join(addonDir, "__init__.py");
  const currentHash = existsSync(addonPath) ? sha256(readFileSync(addonPath)) : undefined;
  const decision = decideAddonInstall(currentHash, BLENDER_MCP_ADDON_SHA256, options.replace);

  if (decision === "refuse-unexpected-existing-addon") {
    throw new Error(
      `An unrecognized Blender MCP add-on already exists at ${addonPath}. Re-run with --replace only after reviewing it.`
    );
  }

  if (!options.verifyOnly) {
    if (decision !== "already-installed") {
      const payload = await fetchPinnedAddon();
      mkdirSync(addonDir, { recursive: true });
      const temporaryPath = path.join(addonDir, `.__init__.py.${process.pid}.${Date.now()}.tmp`);
      writeFileSync(temporaryPath, payload, { flag: "wx" });
      if (existsSync(addonPath)) {
        const backupPath = path.join(addonDir, `__init__.py.backup-${Date.now()}`);
        renameSync(addonPath, backupPath);
      }
      try {
        renameSync(temporaryPath, addonPath);
      } finally {
        rmSync(temporaryPath, { force: true });
      }
    }
    enableAddon(blenderPath);
    applyRestrictedPreferences(blenderPath);
  }

  const installedHash = existsSync(addonPath) ? sha256(readFileSync(addonPath)) : undefined;
  if (installedHash !== BLENDER_MCP_ADDON_SHA256) {
    throw new Error(`Pinned Blender MCP add-on is not installed at ${addonPath}.`);
  }
  if (!addonIsEnabled(blenderPath)) {
    throw new Error("Pinned Blender MCP add-on is installed but not enabled. Run this setup script without --verify-only.");
  }
  const configuration = readAddonConfiguration(blenderPath);
  assertRestrictedConfiguration(configuration);

  return {
    addonPath,
    blenderPath,
    commit: BLENDER_MCP_ADDON_COMMIT,
    enabled: true,
    hash: installedHash,
    configuration,
    serverVersion: BLENDER_MCP_VERSION,
    status: decision === "already-installed" ? "verified" : options.verifyOnly ? "verified" : "installed",
    uvx
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node <skill-dir>/scripts/setup-blender-mcp.mjs [--blender <path>] [--verify-only] [--replace]");
    return;
  }
  const result = await setupBlenderMcp(options);
  console.log(JSON.stringify(result, null, 2));
  console.log("Restart Blender and start a new Codex task before running the MCP smoke test.");
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
