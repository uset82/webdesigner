import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import {
  createBlenderExportPlans,
  isInsideDirectory,
  resolveBlenderScriptPath,
  sanitizeBlenderBaseName
} from "../dist/blenderPlan.js";
import {
  assertBlenderExportArtifacts,
  assertBlenderVersion,
  findBlenderExecutable,
  runBlenderCommand,
  runBlenderExportJob,
  runBlenderExports
} from "../dist/blenderRunner.js";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
const workspaceRoot = path.resolve(extensionRoot, "..", "..");

test("creates Blender dry-run export plans without starting Blender", () => {
  const blendPath = path.join(workspaceRoot, "fixtures", "Avatar Scene!.blend");
  const plan = createBlenderExportPlans({
    blendPath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    jobId: "dry-run-test",
    modes: ["svg", "glb", "png"]
  });

  assert.ok(isInsideDirectory(workspaceRoot, plan.outputDirectory));
  assert.ok(isInsideDirectory(workspaceRoot, plan.stagingDirectory));
  assert.equal(plan.exports.length, 3);
  assert.deepEqual(
    plan.exports.map((item) => item.mode),
    ["svg", "glb", "png"]
  );

  const svgPlan = plan.exports[0];
  assert.equal(svgPlan.outputPath, path.join(plan.outputDirectory, "Avatar-Scene.line-art.svg"));
  assert.equal(svgPlan.manifestPath, path.join(plan.outputDirectory, "Avatar-Scene.svg.export-report.json"));
  assert.equal(svgPlan.scriptPath, path.resolve(workspaceRoot, "scripts", "blender", "export_svg.py"));
  assert.deepEqual(svgPlan.args, [
    "--disable-autoexec",
    "--background",
    "--python",
    svgPlan.scriptPath,
    "--",
    "--input",
    blendPath,
    "--output",
    svgPlan.stagedOutputPath,
    "--manifest",
    svgPlan.stagedManifestPath
  ]);
  assert.notEqual(svgPlan.stagedOutputPath, svgPlan.outputPath);
});

test("rejects Blender export paths outside the workspace", () => {
  assert.throws(
    () =>
      createBlenderExportPlans({
        blendPath: path.join(workspaceRoot, "avatar.blend"),
        workspaceRoot,
        assetWorkspace: "..",
        extensionRoot,
        modes: ["svg"]
      }),
    /outside the workspace/
  );
  assert.throws(
    () =>
      createBlenderExportPlans({
        blendPath: path.join(os.tmpdir(), "outside.blend"),
        workspaceRoot,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg"]
      }),
    /input file is outside the workspace/
  );
  assert.throws(
    () =>
      createBlenderExportPlans({
        blendPath: path.join(workspaceRoot, "avatar.png"),
        workspaceRoot,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg"]
      }),
    /must be a \.blend file/
  );
  assert.throws(
    () =>
      createBlenderExportPlans({
        blendPath: path.join(workspaceRoot, "avatar.blend"),
        workspaceRoot,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg", "svg"]
      }),
    /Duplicate Blender export mode/
  );
});

test("runs Blender with an argument array and disables shell interpolation", async () => {
  const source = await readFile(path.join(extensionRoot, "dist", "blenderRunner.js"), "utf8");
  assert.match(source, /shell:\s*false/);
});

test("sanitizes Blender output base names", () => {
  assert.equal(sanitizeBlenderBaseName("  Café Mascot / Final  "), "Cafe-Mascot-Final");
  assert.equal(sanitizeBlenderBaseName("????"), "scene");
});

test("allocates collision-safe Blender export names", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-collision-"));
  const outputDirectory = path.join(root, ".codex-avatar", "exports", "blender");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, "Avatar.line-art.svg"), "existing", "utf8");

  const plan = createBlenderExportPlans({
    blendPath: path.join(root, "Avatar.blend"),
    workspaceRoot: root,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    jobId: "collision-test",
    modes: ["svg"]
  });

  assert.equal(path.basename(plan.exports[0].outputPath), "Avatar-2.line-art.svg");
  assert.equal(path.basename(plan.exports[0].manifestPath), "Avatar-2.svg.export-report.json");
});

test("prefers packaged Blender scripts when installed", () => {
  const extensionRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-extension-"));
  const blenderMediaPath = path.join(extensionRoot, "media", "blender");
  mkdirSync(blenderMediaPath, { recursive: true });
  writeFileSync(path.join(blenderMediaPath, "export_svg.py"), "# packaged test script\n", "utf8");

  assert.equal(resolveBlenderScriptPath(extensionRoot, "export_svg.py"), path.join(blenderMediaPath, "export_svg.py"));
});

test("accepts only controlled Blender-shaped version output", async () => {
  const outputChannel = createOutputChannelMock();
  const version = await assertBlenderVersion("controlled-fake-blender", outputChannel, async () => ({
    stdout: "Blender 4.5.3 LTS\n",
    stderr: ""
  }));
  assert.equal(version, "Blender 4.5.3 LTS");
  await assert.rejects(
    () =>
      assertBlenderVersion("controlled-non-blender", outputChannel, async () => ({
        stdout: "Tool 4.5.3\n",
        stderr: ""
      })),
    /did not identify Blender/
  );
});

test("continues discovery after a configured non-Blender executable", async () => {
  const outputChannel = createOutputChannelMock();
  const executable = await findBlenderExecutable(
    {
      blenderPath: process.execPath
    },
    outputChannel
  );

  assert.notEqual(executable, process.execPath);
  assert.ok(outputChannel.lines.some((line) => /setting: invalid.*did not identify Blender/i.test(line)));
});

test("requires Blender export output and manifest artifacts", async () => {
  const exportDirectory = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-export-"));
  const outputPath = path.join(exportDirectory, "Avatar.webgl.glb");
  const manifestPath = path.join(exportDirectory, "Avatar.glb.export-report.json");
  writeValidArtifact("glb", outputPath, manifestPath, "Avatar.blend");

  await assertBlenderExportArtifacts({ mode: "glb", outputPath, manifestPath });
  await assert.rejects(
    () =>
      assertBlenderExportArtifacts({
        mode: "svg",
        outputPath,
        manifestPath: path.join(exportDirectory, "missing.manifest.json")
      }),
    /export report/
  );
  writeFileSync(manifestPath, "not-json", "utf8");
  await assert.rejects(() => assertBlenderExportArtifacts({ mode: "glb", outputPath, manifestPath }), /valid JSON/);
});

test("prefixes and bounds Blender stdout and stderr logging", async () => {
  const outputChannel = createOutputChannelMock();
  const result = await runBlenderCommand(
    process.execPath,
    ["-e", "process.stdout.write('hello\\n'); process.stderr.write('warning\\n')"],
    outputChannel,
    { timeoutMs: 5000, logLimitBytes: 128 }
  );

  assert.match(result.stdout, /hello/);
  assert.match(result.stderr, /warning/);
  assert.ok(outputChannel.lines.includes("[Blender stdout] hello"));
  assert.ok(outputChannel.lines.includes("[Blender stderr] warning"));
});

test("times out a Blender command and waits for process-tree cleanup", async () => {
  const outputChannel = createOutputChannelMock();
  const startedAt = Date.now();
  await assert.rejects(
    () => runBlenderCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], outputChannel, { timeoutMs: 100 }),
    /timed out/
  );
  assert.ok(Date.now() - startedAt < 6000);
});

test("cancels a running Blender command and cleans up its process tree", async () => {
  const outputChannel = createOutputChannelMock();
  const controller = new AbortController();
  const command = runBlenderCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], outputChannel, {
    timeoutMs: 5000,
    signal: controller.signal
  });
  setTimeout(() => controller.abort(), 100);

  await assert.rejects(() => command, /cancelled/);
});

test("reports a missing Blender process without crashing", async () => {
  const missingExecutable = path.join(os.tmpdir(), `missing-blender-${Date.now()}`, "blender.exe");
  await assert.rejects(
    () => runBlenderCommand(missingExecutable, ["--version"], createOutputChannelMock(), { timeoutMs: 1000 }),
    /Could not start Blender command/
  );
});

test("stages, validates, and publishes a complete Blender job without changing the source", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-job-"));
  const blendPath = path.join(root, "Avatar.blend");
  const originalSource = "source-scene";
  writeFileSync(blendPath, originalSource, "utf8");
  const observedArgs = [];

  const results = await runBlenderExports({
    blenderPath: "fake-blender",
    blendPath,
    workspaceRoot: root,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["svg", "png"],
    outputChannel: createOutputChannelMock(),
    processRunner: async (_command, args) => {
      observedArgs.push(args);
      const outputPath = argumentValue(args, "--output");
      const manifestPath = argumentValue(args, "--manifest");
      const mode = outputPath.endsWith(".svg") ? "svg" : "png";
      writeValidArtifact(mode, outputPath, manifestPath, blendPath);
      return { stdout: "", stderr: "" };
    }
  });

  assert.equal(results.length, 2);
  assert.ok(results.every((result) => existsSync(result.outputPath) && existsSync(result.manifestPath)));
  assert.ok(observedArgs.every((args) => args[0] === "--disable-autoexec"));
  assert.equal(readFileSync(blendPath, "utf8"), originalSource);
  const jobsDirectory = path.join(root, ".codex-avatar", "cache", "jobs");
  assert.deepEqual(await readdir(jobsDirectory), []);
});

test("does not overwrite a destination created while a Blender job is running", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-race-"));
  const blendPath = path.join(root, "Avatar.blend");
  writeFileSync(blendPath, "source-scene", "utf8");
  const finalOutput = path.join(root, ".codex-avatar", "exports", "blender", "Avatar.line-art.svg");

  await assert.rejects(
    () =>
      runBlenderExports({
        blenderPath: "fake-blender",
        blendPath,
        workspaceRoot: root,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg"],
        outputChannel: createOutputChannelMock(),
        processRunner: async (_command, args) => {
          const outputPath = argumentValue(args, "--output");
          const manifestPath = argumentValue(args, "--manifest");
          writeValidArtifact("svg", outputPath, manifestPath, blendPath);
          writeFileSync(finalOutput, "existing-artifact", "utf8");
          return { stdout: "", stderr: "" };
        }
      }),
    /destination already exists/
  );

  assert.equal(readFileSync(finalOutput, "utf8"), "existing-artifact");
});

test("enforces one Blender export job at a time and releases the lock after cancellation", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-lock-"));
  const blendPath = path.join(root, "Avatar.blend");
  writeFileSync(blendPath, "source-scene", "utf8");
  const controller = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const firstJob = runBlenderExports({
    blenderPath: "fake-blender",
    blendPath,
    workspaceRoot: root,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["svg"],
    outputChannel: createOutputChannelMock(),
    signal: controller.signal,
    processRunner: async (_command, _args, _output, options) => {
      markStarted();
      await new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("cancelled fake Blender")), { once: true });
      });
    }
  });
  await started;

  await assert.rejects(
    () =>
      runBlenderExports({
        blenderPath: "fake-blender",
        blendPath,
        workspaceRoot: root,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg"],
        outputChannel: createOutputChannelMock()
      }),
    /already running/
  );
  controller.abort();
  await assert.rejects(() => firstJob, /cancelled fake Blender/);

  await assert.rejects(
    () =>
      runBlenderExports({
        blenderPath: "fake-blender",
        blendPath: path.join(root, "not-a-scene.txt"),
        workspaceRoot: root,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        modes: ["svg"],
        outputChannel: createOutputChannelMock()
      }),
    /must be a \.blend file/
  );
});

test("allows an explicitly selected external blend source while keeping outputs inside the workspace", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-workspace-"));
  const externalRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-source-"));
  const blendPath = path.join(externalRoot, "External.blend");
  writeFileSync(blendPath, "source-scene", "utf8");

  const outcomes = await runBlenderExportJob({
    blenderPath: "fake-blender",
    blendPath,
    workspaceRoot: root,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["svg"],
    allowExternalInput: true,
    outputChannel: createOutputChannelMock(),
    processRunner: async (_command, args) => {
      writeValidArtifact("svg", argumentValue(args, "--output"), argumentValue(args, "--manifest"), blendPath);
      return { stdout: "", stderr: "" };
    }
  });

  assert.equal(outcomes[0].status, "success");
  assert.ok(outcomes[0].outputPath.startsWith(path.join(root, ".codex-avatar")));
  assert.equal(readFileSync(blendPath, "utf8"), "source-scene");
});

test("keeps successful Blender modes when another selected mode fails", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-partial-"));
  const blendPath = path.join(root, "Avatar.blend");
  writeFileSync(blendPath, "source-scene", "utf8");

  const outcomes = await runBlenderExportJob({
    blenderPath: "fake-blender",
    blendPath,
    workspaceRoot: root,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["svg", "glb"],
    outputChannel: createOutputChannelMock(),
    processRunner: async (_command, args) => {
      const outputPath = argumentValue(args, "--output");
      if (outputPath.endsWith(".svg")) throw new Error("No Grease Pencil line art was found.");
      writeValidArtifact("glb", outputPath, argumentValue(args, "--manifest"), blendPath);
      return { stdout: "", stderr: "" };
    }
  });

  assert.deepEqual(
    outcomes.map(({ mode, status }) => [mode, status]),
    [
      ["svg", "failed"],
      ["glb", "success"]
    ]
  );
  assert.ok(existsSync(outcomes[1].outputPath));
});

function argumentValue(args, name) {
  const index = args.indexOf(name);
  assert.notEqual(index, -1);
  return args[index + 1];
}

function createOutputChannelMock() {
  const lines = [];
  return {
    lines,
    append(value) {
      lines.push(value);
    },
    appendLine(value) {
      lines.push(value);
    }
  };
}

function writeValidArtifact(mode, outputPath, reportPath, sourcePath) {
  if (mode === "svg") {
    writeFileSync(
      outputPath,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>\n'
    );
  } else if (mode === "glb") {
    writeFileSync(outputPath, createMinimalGlb());
  } else {
    const png = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "ascii");
    png.writeUInt32BE(16, 16);
    png.writeUInt32BE(16, 20);
    writeFileSync(outputPath, png);
  }
  writeFileSync(
    reportPath,
    `${JSON.stringify({ schemaVersion: 1, mode, sourceFile: path.basename(sourcePath), outputFile: path.basename(outputPath), collection: "Export", objectCount: 1, guidance: "Local validated fixture." }, null, 2)}\n`
  );
}

function createMinimalGlb() {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" } }), "utf8");
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const padded = Buffer.alloc(paddedLength, 0x20);
  json.copy(padded);
  const glb = Buffer.alloc(20 + paddedLength);
  glb.write("glTF", 0, "ascii");
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(paddedLength, 12);
  glb.write("JSON", 16, "ascii");
  padded.copy(glb, 20);
  return glb;
}
