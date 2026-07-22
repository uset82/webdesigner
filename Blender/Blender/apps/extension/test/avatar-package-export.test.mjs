import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  avatarPackageArchiveFileName,
  exportAvatarPackageArchive,
  licenseNeedsRedistributionWarning
} from "../dist/avatarPackageExport.js";

test("exports a validated avatar package as a portable ZIP with a top-level package folder", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-export-"));
  const packageRoot = path.join(root, "package");
  const destination = path.join(root, "shared-avatar.codex-avatar.zip");
  try {
    await createPackage(packageRoot);
    const result = await exportAvatarPackageArchive(packageRoot, destination);
    const archive = await readFile(destination);
    const entries = readStoredZipEntries(archive);

    assert.equal(result.archivePath, destination);
    assert.equal(result.fileCount, 2);
    assert.equal(result.byteLength, archive.byteLength);
    assert.deepEqual([...entries.keys()].sort(), [
      "shareable-avatar/avatar.manifest.json",
      "shareable-avatar/svg/avatar.svg"
    ]);
    assert.equal(entries.get("shareable-avatar/svg/avatar.svg")?.toString("utf8"), safeSvg);
    assert.equal(
      JSON.parse(entries.get("shareable-avatar/avatar.manifest.json")?.toString("utf8") ?? "{}").id,
      "shareable-avatar"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects invalid packages and destinations inside the installed package", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-export-invalid-"));
  const packageRoot = path.join(root, "package");
  try {
    await mkdir(packageRoot, { recursive: true });
    await writeFile(path.join(packageRoot, "avatar.manifest.json"), "{}");
    await assert.rejects(
      () => exportAvatarPackageArchive(packageRoot, path.join(root, "invalid.zip")),
      /cannot be exported until validation passes/i
    );

    await createPackage(packageRoot);
    await assert.rejects(
      () => exportAvatarPackageArchive(packageRoot, path.join(packageRoot, "nested.zip")),
      /outside the installed avatar package/i
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses a recognizable archive name and detects restrictive rights statements", () => {
  assert.equal(
    avatarPackageArchiveFileName({ id: "my-avatar", version: "1.2.0-beta.1" }),
    "my-avatar-1.2.0-beta.1.codex-avatar.zip"
  );
  assert.equal(licenseNeedsRedistributionWarning("Local test use only; rights not asserted; no redistribution."), true);
  assert.equal(licenseNeedsRedistributionWarning("Original artwork — all rights reserved"), true);
  assert.equal(licenseNeedsRedistributionWarning("CC-BY-4.0"), false);
});

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>';

async function createPackage(packageRoot) {
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(path.join(packageRoot, "svg"), { recursive: true });
  await writeFile(path.join(packageRoot, "svg", "avatar.svg"), safeSvg);
  const checksum = createHash("sha256").update(safeSvg).digest("hex");
  await writeFile(
    path.join(packageRoot, "avatar.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: "shareable-avatar",
        name: "Shareable Avatar",
        version: "1.0.0",
        author: "Test Artist",
        license: "CC-BY-4.0",
        preferredRuntime: "svg",
        fallbackRuntime: "svg",
        entrypoints: { svg: "svg/avatar.svg" },
        capabilities: ["state-animation"],
        states: { idle: "idle" },
        checksums: { "svg/avatar.svg": checksum }
      },
      null,
      2
    )}\n`
  );
}

function readStoredZipEntries(archive) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= archive.byteLength && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    assert.equal(method, 0, "exported package entries use portable stored ZIP records");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, archive.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  assert.equal(archive.readUInt32LE(offset), 0x02014b50, "central directory follows local file records");
  assert.equal(archive.readUInt32LE(archive.byteLength - 22), 0x06054b50, "archive ends with ZIP directory record");
  return entries;
}
