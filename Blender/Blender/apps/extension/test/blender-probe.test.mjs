import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  discoverPlatformBlenderCandidates,
  parseBlenderVersion,
  probeBlenderExecutable
} from "../dist/blenderProbe.js";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));

test("parses Blender identity and exposes supported export capabilities", async () => {
  const result = await probeBlenderExecutable({
    configuredPath: "/tools/blender",
    discoverPlatformCandidates: async () => [],
    runVersionCommand: async () => successfulVersion("Blender 4.5.3 LTS")
  });

  assert.equal(result.executablePath, "/tools/blender");
  assert.equal(result.discoverySource, "setting");
  assert.equal(result.supportState, "supported");
  assert.deepEqual(result.version, {
    major: 4,
    minor: 5,
    patch: 3,
    version: "4.5.3",
    raw: "Blender 4.5.3 LTS"
  });
  assert.deepEqual(result.capabilities, {
    backgroundMode: true,
    pythonScripting: true,
    svgLineArt: true,
    svgLineArtRequiresGreasePencil: true,
    glbExport: true,
    pngPreview: true
  });
  assert.equal(result.configuredPreferenceIssue, null);
});

test("rejects a non-Blender executable that exits successfully", async () => {
  const result = await probeBlenderExecutable({
    configuredPath: "/fake/node",
    environment: { BLENDER_PATH: "/real/blender" },
    discoverPlatformCandidates: async () => [],
    runVersionCommand: async (candidate) =>
      candidate === "/fake/node" ? successfulVersion("v22.14.0") : successfulVersion("Blender 4.4.2")
  });

  assert.equal(parseBlenderVersion("Not Blender 4.5.3"), null);
  assert.equal(result.executablePath, "/real/blender");
  assert.equal(result.discoverySource, "environment");
  assert.equal(result.attempts[0]?.state, "invalid");
  assert.match(result.attempts[0]?.message ?? "", /did not identify Blender/);
});

test("reports an invalid configured preference and continues to PATH", async () => {
  const result = await probeBlenderExecutable({
    configuredPath: "/missing/preference",
    environment: {},
    platform: "linux",
    discoverPlatformCandidates: async () => [],
    runVersionCommand: async (candidate) => {
      if (candidate === "/missing/preference") {
        throw new Error("ENOENT: configured executable was not found");
      }
      return successfulVersion("Blender 4.5.3");
    }
  });

  assert.equal(result.discoverySource, "path");
  assert.equal(result.executablePath, "blender");
  assert.deepEqual(result.configuredPreferenceIssue, {
    executablePath: "/missing/preference",
    message: "ENOENT: configured executable was not found"
  });
});

test("probes BLENDER_PATH before PATH and platform candidates", async () => {
  const attempts = [];
  const result = await probeBlenderExecutable({
    environment: { BLENDER_PATH: "/environment/blender" },
    platform: "linux",
    discoverPlatformCandidates: async () => ["/opt/blender-8/blender"],
    runVersionCommand: async (candidate) => {
      attempts.push(candidate);
      return successfulVersion("Blender 8.0.1");
    }
  });

  assert.deepEqual(attempts, ["/environment/blender"]);
  assert.equal(result.discoverySource, "environment");
});

test("uses a dynamically discovered platform installation after PATH misses", async () => {
  const result = await probeBlenderExecutable({
    environment: {},
    platform: "linux",
    discoverPlatformCandidates: async () => ["/opt/blender-12.7/blender"],
    runVersionCommand: async (candidate) => {
      if (candidate === "blender") {
        throw new Error("not on PATH");
      }
      return successfulVersion("Blender 12.7.0");
    }
  });

  assert.equal(result.discoverySource, "platform");
  assert.equal(result.executablePath, "/opt/blender-12.7/blender");
  assert.equal(result.version?.major, 12);
});

test("discovers dynamic Windows install folders without a version ceiling", async () => {
  const candidates = await discoverPlatformBlenderCandidates({
    platform: "win32",
    environment: { ProgramFiles: "C:\\Program Files" },
    readDirectory: async () => ["Blender 4.5", "Blender 12.11", "Blender Preview", "Unrelated"],
    canAccess: async () => true
  });

  assert.deepEqual(candidates, [
    path.win32.join("C:\\Program Files", "Blender Foundation", "Blender 12.11", "blender.exe"),
    path.win32.join("C:\\Program Files", "Blender Foundation", "Blender 4.5", "blender.exe"),
    path.win32.join("C:\\Program Files", "Blender Foundation", "Blender Preview", "blender.exe")
  ]);
});

test("discovers dynamic macOS application bundles", async () => {
  const candidates = await discoverPlatformBlenderCandidates({
    platform: "darwin",
    environment: {},
    homeDirectory: "/Users/avatar",
    readDirectory: async (directory) =>
      directory === "/Applications" ? ["Blender 6.2.app", "Blender.app", "Notes.app"] : [],
    canAccess: async () => true
  });

  assert.deepEqual(candidates, [
    "/Applications/Blender 6.2.app/Contents/MacOS/Blender",
    "/Applications/Blender.app/Contents/MacOS/Blender"
  ]);
});

test("discovers dynamic Linux installs and known local package locations", async () => {
  const accessible = new Set([
    "/opt/blender-7.4/blender",
    "/snap/blender/current/blender",
    "/home/avatar/.local/share/flatpak/exports/bin/org.blender.Blender"
  ]);
  const candidates = await discoverPlatformBlenderCandidates({
    platform: "linux",
    environment: {},
    homeDirectory: "/home/avatar",
    readDirectory: async (directory) => (directory === "/opt" ? ["blender-7.4", "other"] : []),
    canAccess: async (candidate) => accessible.has(candidate)
  });

  assert.deepEqual(candidates, [
    "/opt/blender-7.4/blender",
    "/snap/blender/current/blender",
    "/home/avatar/.local/share/flatpak/exports/bin/org.blender.Blender"
  ]);
});

test("returns an unsupported Blender only when no supported installation is found", async () => {
  const result = await probeBlenderExecutable({
    configuredPath: "/old/blender",
    environment: {},
    platform: "linux",
    discoverPlatformCandidates: async () => [],
    runVersionCommand: async (candidate) => {
      if (candidate === "/old/blender") {
        return successfulVersion("Blender 3.5.9");
      }
      throw new Error("not found");
    }
  });

  assert.equal(result.executablePath, "/old/blender");
  assert.equal(result.supportState, "unsupported");
  assert.equal(result.capabilities.glbExport, false);
  assert.equal(result.configuredPreferenceIssue, null);
});

test("missing Blender is a graceful not-found result", async () => {
  const result = await probeBlenderExecutable({
    configuredPath: "/missing/blender",
    environment: {},
    platform: "linux",
    discoverPlatformCandidates: async () => ["/opt/blender-latest/blender"],
    runVersionCommand: async () => {
      throw new Error("executable unavailable");
    }
  });

  assert.equal(result.executablePath, null);
  assert.equal(result.discoverySource, null);
  assert.equal(result.version, null);
  assert.equal(result.supportState, "not-found");
  assert.equal(result.capabilities.pythonScripting, false);
  assert.equal(result.attempts.length, 3);
});

test("cancellation stops a connection probe instead of continuing to fallback candidates", async () => {
  const controller = new AbortController();
  const attempts = [];
  const pending = probeBlenderExecutable({
    configuredPath: "/slow/blender",
    environment: {},
    platform: "linux",
    signal: controller.signal,
    discoverPlatformCandidates: async () => ["/fallback/blender"],
    runVersionCommand: async (candidate, _timeoutMs, signal) => {
      attempts.push(candidate);
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("Blender connection check was cancelled.");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      });
    }
  });

  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(() => pending, /cancelled/);
  assert.deepEqual(attempts, ["/slow/blender"]);
});

test("the real version command never enables shell interpolation", async () => {
  const source = await readFile(path.join(extensionRoot, "src", "blenderProbe.ts"), "utf8");
  assert.match(source, /spawn\(executablePath, \["--version"\], \{[\s\S]*?shell:\s*false/);
});

function successfulVersion(stdout) {
  return {
    exitCode: 0,
    stdout: `${stdout}\n`,
    stderr: ""
  };
}
