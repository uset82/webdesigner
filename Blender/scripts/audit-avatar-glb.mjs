import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REQUIRED_ACTIONS = [
  "idle_loop",
  "listening_loop",
  "thinking_loop",
  "speaking_loop",
  "coding_loop",
  "reviewing_loop",
  "debugging_loop",
  "building_loop",
  "warning_loop",
  "sleeping_loop",
  "welcome_once",
  "success_once",
  "error_once",
  "blink_once",
  "look_left_once",
  "look_right_once",
  "nod_once",
  "shake_once",
  "celebrate_once",
  "point_once",
  "talk_start",
  "talk_stop"
];

const REQUIRED_MORPHS = ["Blink_L", "Blink_R", "Mouth_Open", "Smile", "Frown", "Brow_Up", "Brow_Down"];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--output") {
      options[argument.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  if (!options.input || !options.output) {
    throw new Error("Usage: node scripts/audit-avatar-glb.mjs --input <avatar.glb> --output <report.json>");
  }
  return options;
}

export function parseGlb(buffer) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("Input is not a valid GLB container.");
  }
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error("GLB version or declared length is invalid.");
  }
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.toString("ascii", 16, 20) !== "JSON" || 20 + jsonLength > buffer.length) {
    throw new Error("GLB JSON chunk is missing or truncated.");
  }
  const document = JSON.parse(
    buffer
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .trimEnd()
  );
  const binaryHeaderOffset = 20 + jsonLength;
  const binaryLength = buffer.readUInt32LE(binaryHeaderOffset);
  const binaryType = buffer.toString("ascii", binaryHeaderOffset + 4, binaryHeaderOffset + 8);
  if (binaryType !== "BIN\0" || binaryHeaderOffset + 8 + binaryLength > buffer.length) {
    throw new Error("GLB binary chunk is missing or truncated.");
  }
  return {
    document,
    binaryChunk: buffer.subarray(binaryHeaderOffset + 8, binaryHeaderOffset + 8 + binaryLength)
  };
}

function accessorMaximumAbsolute(document, binaryChunk, accessorIndex) {
  const accessor = document.accessors?.[accessorIndex];
  const view = document.bufferViews?.[accessor?.bufferView];
  if (!accessor || !view || accessor.componentType !== 5126 || accessor.type !== "VEC3") {
    throw new Error("Root translation accessor must be a float VEC3.");
  }
  const stride = view.byteStride ?? 12;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  let maximum = 0;
  for (let index = 0; index < accessor.count; index += 1) {
    for (let component = 0; component < 3; component += 1) {
      maximum = Math.max(maximum, Math.abs(binaryChunk.readFloatLE(offset + index * stride + component * 4)));
    }
  }
  return maximum;
}

export function auditGlb(document, binaryChunk, byteLength, inputFile) {
  const animations = (document.animations ?? [])
    .map((animation) => animation.name)
    .filter(Boolean)
    .sort();
  const morphTargets = [...new Set((document.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []))].sort();
  const missingActions = REQUIRED_ACTIONS.filter((name) => !animations.includes(name));
  const missingMorphTargets = REQUIRED_MORPHS.filter((name) => !morphTargets.includes(name));
  const rootNodeIndexes = new Set(
    (document.nodes ?? [])
      .map((node, index) => ({ name: node.name, index }))
      .filter((node) => node.name === "Root")
      .map((node) => node.index)
  );
  const rootTranslationChannels = (document.animations ?? []).flatMap((animation) =>
    (animation.channels ?? [])
      .filter((channel) => channel.target?.path === "translation" && rootNodeIndexes.has(channel.target?.node))
      .filter((channel) => {
        const sampler = animation.samplers?.[channel.sampler];
        return accessorMaximumAbsolute(document, binaryChunk, sampler?.output) > 1e-4;
      })
      .map(() => animation.name ?? "unnamed")
  );
  const failures = [];
  if (byteLength > 8 * 1024 * 1024) failures.push("GLB exceeds the 8 MB budget");
  if ((document.skins?.length ?? 0) < 1) failures.push("GLB has no skin");
  if (missingActions.length) failures.push("required animation clips are missing");
  if (missingMorphTargets.length) failures.push("required morph targets are missing");
  if (rootTranslationChannels.length) failures.push("root translation animation prevents in-place playback");

  return {
    schemaVersion: 1,
    inputFile: path.basename(inputFile),
    gltfVersion: document.asset?.version ?? null,
    generator: document.asset?.generator ?? null,
    byteLength,
    sizeBudgetBytes: 8 * 1024 * 1024,
    sceneCount: document.scenes?.length ?? 0,
    nodeCount: document.nodes?.length ?? 0,
    meshCount: document.meshes?.length ?? 0,
    skinCount: document.skins?.length ?? 0,
    animationCount: animations.length,
    animations,
    missingActions,
    morphTargets,
    missingMorphTargets,
    rootTranslationChannels,
    valid: failures.length === 0,
    failures
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputFile = path.resolve(options.input);
  const outputFile = path.resolve(options.output);
  const buffer = await readFile(inputFile);
  const parsed = parseGlb(buffer);
  const report = auditGlb(parsed.document, parsed.binaryChunk, buffer.length, inputFile);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
