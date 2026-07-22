import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AvatarPackageRegistry, MAX_AVATAR_PACKAGE_FILE_BYTES, validateAvatarPackage } from "../dist/avatarPackages.js";

const extensionRoot = path.join(import.meta.dirname, "..");

function manifest(entrypoint = "avatar.svg", checksums, id = "local-test-avatar") {
  return {
    schemaVersion: 1,
    id,
    name: "Local Test Avatar",
    version: "1.0.0",
    author: "Test Author",
    license: "MIT",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: entrypoint },
    capabilities: ["state-animation"],
    states: { idle: "idle_loop" },
    checksums
  };
}

test("validates the built-in manifest and imports, activates, then removes a local package", async () => {
  const builtIn = await validateAvatarPackage(path.join(extensionRoot, "media", "avatars"));
  assert.equal(builtIn.valid, true, builtIn.errors.join("\n"));

  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-package-"));
  const source = path.join(root, "source");
  const workspace = path.join(root, "workspace");
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, "avatar.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const svgHash = createHash("sha256")
    .update(await readFile(path.join(source, "avatar.svg")))
    .digest("hex");
  await writeFile(
    path.join(source, "avatar.manifest.json"),
    JSON.stringify(manifest("avatar.svg", { "avatar.svg": svgHash }))
  );

  try {
    const registry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    const imported = await registry.importPackage(source);
    assert.equal(imported.id, "local-test-avatar");
    assert.equal((await registry.listPackages()).length, 1);
    await registry.activateAvatar(imported.id);
    assert.equal((await registry.getActivePackage())?.id, imported.id);
    const reloadedRegistry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    assert.equal((await reloadedRegistry.getActivePackage())?.id, imported.id, "active SVG package survives reload");

    const assetRoot = path.join(workspace, ".codex-avatar");
    await mkdir(path.join(assetRoot, "cache"), { recursive: true });
    await mkdir(path.join(assetRoot, "previews"), { recursive: true });
    await mkdir(path.join(assetRoot, "exports"), { recursive: true });
    await writeFile(path.join(assetRoot, "cache", "generated.tmp"), "generated");
    await writeFile(path.join(assetRoot, "previews", "preview.tmp"), "generated");
    await writeFile(path.join(assetRoot, "exports", "keep.txt"), "user export");
    await registry.clearGeneratedCache();
    await assert.rejects(() => stat(path.join(assetRoot, "cache")));
    await assert.rejects(() => stat(path.join(assetRoot, "previews")));
    assert.equal((await stat(path.join(assetRoot, "exports", "keep.txt"))).isFile(), true);

    await writeFile(
      path.join(imported.rootPath, "avatar.manifest.json"),
      JSON.stringify(manifest("avatar.svg", { "avatar.svg": svgHash }, "different-package-id"))
    );
    const records = await registry.listPackageRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0].id, "local-test-avatar");
    assert.equal(records[0].validation.valid, false);
    assert.match(records[0].validation.errors.join("\n"), /Registry id .* does not match package id/);
    const registeredValidation = await registry.validateRegisteredPackage("local-test-avatar");
    assert.equal(registeredValidation.valid, false);
    assert.match(registeredValidation.errors.join("\n"), /Registry id .* does not match package id/);

    assert.equal(await registry.removeAvatar(imported.id), true);
    assert.equal(await registry.getActivePackage(), undefined);
    assert.equal((await registry.listPackages()).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects traversal, remote entrypoints, and bad checksums", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-invalid-"));
  try {
    await writeFile(path.join(root, "avatar.manifest.json"), JSON.stringify(manifest("../outside.svg")));
    const traversal = await validateAvatarPackage(root);
    assert.equal(traversal.valid, false);
    assert.match(traversal.errors.join("\n"), /safe local relative path|escapes/);

    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("https://example.com/avatar.svg"))
    );
    const remote = await validateAvatarPackage(root);
    assert.equal(remote.valid, false);
    assert.match(remote.errors.join("\n"), /safe local relative path/);

    await writeFile(path.join(root, "avatar.svg"), "<svg/>");
    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("avatar.svg", { "avatar.svg": "0".repeat(64) }))
    );
    const checksum = await validateAvatarPackage(root);
    assert.equal(checksum.valid, false);
    assert.match(checksum.errors.join("\n"), /Checksum mismatch/);

    await writeFile(path.join(root, "avatar.svg"), `<svg><script>alert(1)</script></svg>`);
    await writeFile(path.join(root, "avatar.manifest.json"), JSON.stringify(manifest("avatar.svg")));
    const unsafeSvg = await validateAvatarPackage(root);
    assert.equal(unsafeSvg.valid, false);
    assert.match(unsafeSvg.errors.join("\n"), /executable or remote SVG/);

    await writeFile(path.join(root, "avatar.svg"), Buffer.alloc(MAX_AVATAR_PACKAGE_FILE_BYTES + 1));
    const oversized = await validateAvatarPackage(root);
    assert.equal(oversized.valid, false);
    assert.match(oversized.errors.join("\n"), /file limit/);

    await writeFile(path.join(root, "avatar.svg"), "<svg/>");
    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("avatar.svg", undefined, "a".repeat(81)))
    );
    const oversizedId = await validateAvatarPackage(root);
    assert.equal(oversizedId.valid, false);
    assert.match(oversizedId.errors.join("\n"), /1-80/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a forged registry path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-registry-"));
  const workspace = path.join(root, "workspace");
  const assetRoot = path.join(workspace, ".codex-avatar");
  try {
    await mkdir(assetRoot, { recursive: true });
    await writeFile(
      path.join(assetRoot, "avatar-registry.json"),
      JSON.stringify({ schemaVersion: 1, activeId: "escape", packages: { escape: "../outside" } })
    );
    const registry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    await assert.rejects(() => registry.listPackages(), /unsupported format/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installs staged packages transactionally and restores the prior package on rollback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-transaction-"));
  const workspace = path.join(root, "workspace");
  const assetRoot = path.join(workspace, ".codex-avatar");
  const registry = new AvatarPackageRegistry(
    () => workspace,
    () => ".codex-avatar"
  );

  try {
    const firstStage = await createStagedPackage(assetRoot, "transaction-avatar", "first");
    const firstTransaction = await registry.beginInstallStagedPackage(firstStage, { replaceExisting: false });
    await firstTransaction.commit();
    assert.equal((await registry.getActivePackage())?.id, "transaction-avatar");
    assert.equal(await registry.hasPackageCollision("transaction-avatar"), true);
    assert.equal(await registry.suggestAvailableId("transaction-avatar"), "transaction-avatar-2");

    const installedSvg = path.join(assetRoot, "avatars", "transaction-avatar", "avatar.svg");
    assert.equal(
      await readFile(installedSvg, "utf8"),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>first</text></svg>'
    );

    const replacementStage = await createStagedPackage(assetRoot, "transaction-avatar", "replacement");
    const replacement = await registry.beginInstallStagedPackage(replacementStage, { replaceExisting: true });
    assert.equal(
      await readFile(installedSvg, "utf8"),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>replacement</text></svg>'
    );
    await replacement.rollback();
    assert.equal(
      await readFile(installedSvg, "utf8"),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>first</text></svg>'
    );
    assert.equal((await registry.getActivePackage())?.id, "transaction-avatar");

    const committedStage = await createStagedPackage(assetRoot, "transaction-avatar", "committed");
    const committed = await registry.beginInstallStagedPackage(committedStage, { replaceExisting: true });
    await committed.commit();
    assert.equal(
      await readFile(installedSvg, "utf8"),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>committed</text></svg>'
    );
    const reloaded = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    assert.equal((await reloaded.getActivePackage())?.manifest.id, "transaction-avatar");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restores package files when a removal registry update fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-remove-rollback-"));
  const workspace = path.join(root, "workspace");
  const assetRoot = path.join(workspace, ".codex-avatar");
  const registry = new AvatarPackageRegistry(
    () => workspace,
    () => ".codex-avatar"
  );

  try {
    const stage = await createStagedPackage(assetRoot, "remove-rollback-avatar", "keep-me");
    const transaction = await registry.beginInstallStagedPackage(stage, { replaceExisting: false });
    await transaction.commit();
    const packageRoot = path.join(assetRoot, "avatars", "remove-rollback-avatar");
    const originalWriteRegistry = registry.writeRegistry.bind(registry);
    registry.writeRegistry = async () => {
      throw new Error("simulated registry write failure");
    };

    await assert.rejects(() => registry.removeAvatar("remove-rollback-avatar"), /simulated registry write failure/);
    assert.equal((await stat(packageRoot)).isDirectory(), true);

    registry.writeRegistry = originalWriteRegistry;
    assert.equal((await registry.getPackage("remove-rollback-avatar")).id, "remove-rollback-avatar");
    assert.equal((await registry.getActivePackage()).id, "remove-rollback-avatar");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createStagedPackage(assetRoot, id, marker) {
  const stagingRoot = path.join(assetRoot, "cache", "jobs", `${id}-${marker}`);
  await mkdir(stagingRoot, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>${marker}</text></svg>`;
  await writeFile(path.join(stagingRoot, "avatar.svg"), svg);
  const checksum = createHash("sha256").update(svg).digest("hex");
  await writeFile(
    path.join(stagingRoot, "avatar.manifest.json"),
    JSON.stringify(manifest("avatar.svg", { "avatar.svg": checksum }, id))
  );
  return stagingRoot;
}
