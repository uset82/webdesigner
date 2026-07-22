import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  readdir,
  rename as renamePath,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { validateAvatarManifest, type AvatarManifest } from "@codex-avatar-studio/avatar-core";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";

const REGISTRY_SCHEMA_VERSION = 1;
const MANIFEST_FILE = "avatar.manifest.json";
const GENERATED_CACHE_DIRECTORIES = ["cache", "previews"] as const;

export const MAX_AVATAR_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_PACKAGE_TOTAL_BYTES = 64 * 1024 * 1024;
export const MAX_AVATAR_PACKAGE_FILES = 128;

export type AvatarPackage = {
  id: string;
  rootPath: string;
  manifest: AvatarManifest;
};

export type AvatarPackageValidation = {
  valid: boolean;
  manifest?: AvatarManifest | undefined;
  errors: string[];
  warnings: string[];
};

export type AvatarPackageRecord = {
  id: string;
  rootPath: string;
  validation: AvatarPackageValidation;
};

export type AvatarPackageInstallTransaction = {
  avatarPackage: AvatarPackage;
  replacedExisting: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

type RegistryFile = {
  schemaVersion: 1;
  activeId?: string;
  packages: Record<string, string>;
};

export class AvatarPackageError extends Error {
  public constructor(
    message: string,
    public readonly errors: string[] = [message]
  ) {
    super(message);
    this.name = "AvatarPackageError";
  }
}

export class AvatarPackageRegistry {
  public constructor(
    private readonly workspaceRootProvider: () => string | undefined,
    private readonly assetWorkspaceProvider: () => string
  ) {}

  public getAssetRoot(): string | undefined {
    const workspaceRoot = this.workspaceRootProvider();
    if (!workspaceRoot) return undefined;
    const assetWorkspace = this.assetWorkspaceProvider();
    const assetRoot = path.resolve(
      path.isAbsolute(assetWorkspace) ? assetWorkspace : path.join(workspaceRoot, assetWorkspace)
    );
    return isPathInside(workspaceRoot, assetRoot) ? assetRoot : undefined;
  }

  public async importPackage(sourcePath: string): Promise<AvatarPackage> {
    const assetRoot = this.requireAssetRoot();
    const sourceRoot = await resolvePackageRoot(sourcePath);
    const sourcePackage = await loadAvatarPackage(sourceRoot);
    const targetRoot = path.join(assetRoot, "avatars", sourcePackage.id);
    assertInside(assetRoot, targetRoot, "Avatar package target");

    if (await exists(targetRoot)) {
      throw new AvatarPackageError(`Avatar package "${sourcePackage.id}" is already imported.`);
    }

    await mkdir(path.dirname(targetRoot), { recursive: true });
    await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true });
    try {
      const importedPackage = await loadAvatarPackage(targetRoot);
      const registry = await this.readRegistry();
      setRegistryPackage(registry, importedPackage.id, path.relative(assetRoot, targetRoot));
      await this.writeRegistry(registry);
      return importedPackage;
    } catch (error) {
      await rm(targetRoot, { recursive: true, force: true });
      throw error;
    }
  }

  public async hasPackageCollision(id: string): Promise<boolean> {
    assertValidPackageId(id);
    const assetRoot = this.requireAssetRoot();
    const registry = await this.readRegistry();
    return Object.hasOwn(registry.packages, id) || (await exists(path.join(assetRoot, "avatars", id)));
  }

  public async suggestAvailableId(baseId: string): Promise<string> {
    assertValidPackageId(baseId);
    for (let copy = 1; copy <= 10_000; copy += 1) {
      const suffix = `-${copy}`;
      const candidate = copy === 1 ? baseId : `${baseId.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
      if (!(await this.hasPackageCollision(candidate))) return candidate;
    }
    throw new AvatarPackageError(`Could not create a unique avatar id from "${baseId}".`);
  }

  public async getPackage(id: string): Promise<AvatarPackage> {
    assertValidPackageId(id);
    const registry = await this.readRegistry();
    if (!Object.hasOwn(registry.packages, id)) {
      throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    }
    const relativeRoot = registry.packages[id] as string;
    return loadAvatarPackage(await this.resolveVerifiedRegisteredRoot(relativeRoot));
  }

  public async beginInstallStagedPackage(
    stagedRoot: string,
    options: { replaceExisting: boolean }
  ): Promise<AvatarPackageInstallTransaction> {
    const assetRoot = this.requireAssetRoot();
    const resolvedStagingRoot = await realpath(stagedRoot);
    assertInside(assetRoot, resolvedStagingRoot, "Generated avatar staging path");
    const stagedPackage = await loadAvatarPackage(resolvedStagingRoot);
    const targetRoot = path.resolve(assetRoot, "avatars", stagedPackage.id);
    assertInside(assetRoot, targetRoot, "Generated avatar target");

    const previousRegistry = await this.readRegistry();
    const registrySnapshot = cloneRegistry(previousRegistry);
    const targetExists = await exists(targetRoot);
    const registryCollision = Object.hasOwn(previousRegistry.packages, stagedPackage.id);
    if ((targetExists || registryCollision) && !options.replaceExisting) {
      throw new AvatarPackageError(`Avatar package "${stagedPackage.id}" already exists.`);
    }
    if (registryCollision) {
      const registeredTarget = this.resolveRegisteredRoot(previousRegistry.packages[stagedPackage.id] as string);
      if (path.resolve(registeredTarget) !== targetRoot) {
        throw new AvatarPackageError(`Avatar package "${stagedPackage.id}" is registered at an unexpected path.`);
      }
    }

    const transactionRoot = path.resolve(assetRoot, "cache", "transactions", randomUUID());
    const backupRoot = path.join(transactionRoot, "previous-package");
    assertInside(assetRoot, transactionRoot, "Generated avatar transaction");
    await mkdir(path.dirname(targetRoot), { recursive: true });
    await mkdir(transactionRoot, { recursive: true });

    let backedUp = false;
    let installed = false;
    let registryUpdated = false;
    try {
      if (targetExists) {
        await renameWithRetry(targetRoot, backupRoot);
        backedUp = true;
      }
      await renameWithRetry(resolvedStagingRoot, targetRoot);
      installed = true;
      const installedPackage = await loadAvatarPackage(targetRoot);
      const nextRegistry = cloneRegistry(previousRegistry);
      setRegistryPackage(nextRegistry, installedPackage.id, path.relative(assetRoot, targetRoot));
      nextRegistry.activeId = installedPackage.id;
      await this.writeRegistry(nextRegistry);
      registryUpdated = true;

      let settled = false;
      return {
        avatarPackage: installedPackage,
        replacedExisting: targetExists || registryCollision,
        commit: async () => {
          if (settled) return;
          await rm(transactionRoot, { recursive: true, force: true }).catch(() => undefined);
          settled = true;
        },
        rollback: async () => {
          if (settled) return;
          settled = true;
          await this.writeRegistry(registrySnapshot);
          await rm(targetRoot, { recursive: true, force: true });
          if (backedUp) await renameWithRetry(backupRoot, targetRoot);
          await rm(transactionRoot, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (registryUpdated) await this.writeRegistry(registrySnapshot).catch(() => undefined);
      if (installed) await rm(targetRoot, { recursive: true, force: true }).catch(() => undefined);
      if (backedUp) await renameWithRetry(backupRoot, targetRoot).catch(() => undefined);
      await rm(transactionRoot, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  public async listPackages(): Promise<AvatarPackage[]> {
    const registry = await this.readRegistry();
    const packages: AvatarPackage[] = [];
    for (const [id, relativeRoot] of Object.entries(registry.packages)) {
      const rootPath = await this.resolveVerifiedRegisteredRoot(relativeRoot);
      const avatarPackage = await loadAvatarPackage(rootPath);
      assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
      if (avatarPackage.id !== id) {
        throw new AvatarPackageError(`Registry id "${id}" does not match package id "${avatarPackage.id}".`);
      }
      packages.push(avatarPackage);
    }
    return packages;
  }

  public async listPackageRecords(): Promise<AvatarPackageRecord[]> {
    const registry = await this.readRegistry();
    const records: AvatarPackageRecord[] = [];
    for (const [id, relativeRoot] of Object.entries(registry.packages)) {
      const rootPath = this.resolveRegisteredRoot(relativeRoot);
      let validation: AvatarPackageValidation;
      try {
        await this.resolveVerifiedRegisteredRoot(relativeRoot);
        validation = withMatchingRegistryId(id, await validateAvatarPackage(rootPath));
      } catch {
        validation = unsafeRegisteredPackageValidation();
      }
      records.push({ id, rootPath, validation });
    }
    return records;
  }

  public async getActiveId(): Promise<string | undefined> {
    return (await this.readRegistry()).activeId;
  }

  public async validateRegisteredPackage(id: string): Promise<AvatarPackageValidation> {
    assertValidPackageId(id);
    const registry = await this.readRegistry();
    if (!Object.hasOwn(registry.packages, id)) {
      throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    }
    const relativeRoot = registry.packages[id] as string;
    try {
      const rootPath = await this.resolveVerifiedRegisteredRoot(relativeRoot);
      return withMatchingRegistryId(id, await validateAvatarPackage(rootPath));
    } catch {
      return unsafeRegisteredPackageValidation();
    }
  }

  public async getActivePackage(): Promise<AvatarPackage | undefined> {
    const registry = await this.readRegistry();
    if (!registry.activeId) return undefined;
    const relativeRoot = registry.packages[registry.activeId];
    if (!relativeRoot) throw new AvatarPackageError(`Active avatar "${registry.activeId}" is not registered.`);
    const avatarPackage = await loadAvatarPackage(await this.resolveVerifiedRegisteredRoot(relativeRoot));
    assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
    return avatarPackage;
  }

  public async activateAvatar(id: string | undefined): Promise<AvatarPackage | undefined> {
    const registry = await this.readRegistry();
    if (id === undefined) {
      delete registry.activeId;
      await this.writeRegistry(registry);
      return undefined;
    }
    if (!Object.hasOwn(registry.packages, id)) {
      throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    }
    const relativeRoot = registry.packages[id] as string;
    const avatarPackage = await loadAvatarPackage(await this.resolveVerifiedRegisteredRoot(relativeRoot));
    assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
    registry.activeId = id;
    await this.writeRegistry(registry);
    return avatarPackage;
  }

  public async removeAvatar(id: string): Promise<boolean> {
    assertValidPackageId(id);
    const assetRoot = this.requireAssetRoot();
    const registry = await this.readRegistry();
    if (!Object.hasOwn(registry.packages, id)) {
      throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    }
    const relativeRoot = registry.packages[id] as string;
    const rootPath = this.resolveRegisteredRoot(relativeRoot);
    const wasActive = registry.activeId === id;
    const nextRegistry = cloneRegistry(registry);
    delete nextRegistry.packages[id];
    if (wasActive) delete nextRegistry.activeId;

    const transactionRoot = path.resolve(assetRoot, "cache", "transactions", randomUUID());
    const removedPackageRoot = path.join(transactionRoot, "removed-package");
    assertInside(assetRoot, transactionRoot, "Avatar removal transaction");
    await mkdir(transactionRoot, { recursive: true });

    let moved = false;
    try {
      await renameWithRetry(rootPath, removedPackageRoot);
      moved = true;
      await this.writeRegistry(nextRegistry);
    } catch (error) {
      if (moved) {
        await mkdir(path.dirname(rootPath), { recursive: true }).catch(() => undefined);
        await renameWithRetry(removedPackageRoot, rootPath).catch(() => undefined);
      }
      await rm(transactionRoot, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }

    await rm(transactionRoot, { recursive: true, force: true }).catch(() => undefined);
    return wasActive;
  }

  public async clearGeneratedCache(): Promise<void> {
    const assetRoot = this.requireAssetRoot();
    for (const directory of GENERATED_CACHE_DIRECTORIES) {
      const target = path.join(assetRoot, directory);
      assertInside(assetRoot, target, `Generated ${directory} directory`);
      const targetStat = await lstat(target).catch((error: unknown) => {
        if (isFileNotFound(error)) return undefined;
        throw error;
      });
      if (!targetStat) continue;
      if (targetStat.isSymbolicLink()) {
        throw new AvatarPackageError(`Generated ${directory} directory must not be a symbolic link.`);
      }
      if (!targetStat.isDirectory()) {
        throw new AvatarPackageError(`Generated ${directory} path is not a directory.`);
      }
      await rm(target, { recursive: true, force: true });
    }
  }

  private requireAssetRoot(): string {
    const assetRoot = this.getAssetRoot();
    if (!assetRoot) throw new AvatarPackageError("Open a workspace folder before managing avatar packages.");
    return assetRoot;
  }

  private resolveRegisteredRoot(relativeRoot: string): string {
    const assetRoot = this.requireAssetRoot();
    assertSafeRelativePath(relativeRoot, "Registry package path");
    const rootPath = path.resolve(assetRoot, relativeRoot);
    assertInside(assetRoot, rootPath, "Registry package path");
    return rootPath;
  }

  private async resolveVerifiedRegisteredRoot(relativeRoot: string): Promise<string> {
    const assetRoot = this.requireAssetRoot();
    const rootPath = this.resolveRegisteredRoot(relativeRoot);
    const rootStat = await lstat(rootPath).catch(() => {
      throw new AvatarPackageError("Registered avatar package folder is missing or inaccessible.");
    });
    if (rootStat.isSymbolicLink()) {
      throw new AvatarPackageError("Registered avatar package folder must not be a symbolic link.");
    }
    const resolvedRoot = await realpath(rootPath).catch(() => {
      throw new AvatarPackageError("Registered avatar package folder is missing or inaccessible.");
    });
    assertInside(assetRoot, resolvedRoot, "Registry package path");
    return rootPath;
  }

  private async readRegistry(): Promise<RegistryFile> {
    const assetRoot = this.requireAssetRoot();
    const registryPath = path.join(assetRoot, "avatar-registry.json");
    try {
      const value: unknown = JSON.parse(await readFile(registryPath, "utf8"));
      if (!isRegistryFile(value)) throw new AvatarPackageError("Avatar registry has an unsupported format.");
      return value;
    } catch (error) {
      if (isFileNotFound(error)) return { schemaVersion: REGISTRY_SCHEMA_VERSION, packages: {} };
      if (error instanceof AvatarPackageError) throw error;
      throw new AvatarPackageError(`Avatar registry could not be read: ${toErrorMessage(error)}`);
    }
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    const assetRoot = this.requireAssetRoot();
    await mkdir(assetRoot, { recursive: true });
    const registryPath = path.join(assetRoot, "avatar-registry.json");
    const temporaryPath = path.join(assetRoot, `.avatar-registry-${randomUUID()}.tmp`);
    const backupPath = path.join(assetRoot, `.avatar-registry-${randomUUID()}.bak`);
    const hadRegistry = await exists(registryPath);
    await writeFile(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    try {
      if (hadRegistry) await renameWithRetry(registryPath, backupPath);
      await renameWithRetry(temporaryPath, registryPath);
      await rm(backupPath, { force: true });
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      if (hadRegistry && (await exists(backupPath))) {
        await rm(registryPath, { force: true }).catch(() => undefined);
        await renameWithRetry(backupPath, registryPath).catch(() => undefined);
      }
      throw error;
    }
  }
}

export async function validateAvatarPackage(packageRoot: string): Promise<AvatarPackageValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let manifest: AvatarManifest | undefined;
  try {
    const packagePath = await realpath(packageRoot);
    await validatePackageTree(packagePath, errors);
    const manifestPath = path.join(packagePath, MANIFEST_FILE);
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    const manifestResult = validateAvatarManifest(parsed);
    if (!manifestResult.valid || !manifestResult.manifest) {
      return { valid: false, errors: manifestResult.errors, warnings: manifestResult.warnings };
    }
    manifest = manifestResult.manifest;
    warnings.push(...manifestResult.warnings);

    if (!isValidPackageId(manifest.id)) {
      errors.push("id must be 1-80 letters, numbers, dots, underscores, or hyphens and start with a letter or number.");
    }

    const referencedFiles = new Set<string>();
    for (const [runtime, entrypoint] of Object.entries(manifest.entrypoints)) {
      await addReferencedFile(packagePath, entrypoint, `entrypoints.${runtime}`, referencedFiles, errors);
    }
    for (const [runtime, asset] of Object.entries(manifest.assets ?? {})) {
      await addReferencedFile(packagePath, asset, `assets.${runtime}`, referencedFiles, errors);
    }
    if (manifest.previewImage) {
      await addReferencedFile(packagePath, manifest.previewImage, "previewImage", referencedFiles, errors);
    }
    for (const checksumPath of Object.keys(manifest.checksums ?? {})) {
      await addReferencedFile(packagePath, checksumPath, `checksums.${checksumPath}`, referencedFiles, errors);
    }

    for (const filePath of referencedFiles) {
      const relativePath = path.relative(packagePath, filePath);
      const normalizedRelativePath = relativePath.split(path.sep).join("/");
      const checksum = manifest.checksums?.[normalizedRelativePath] ?? manifest.checksums?.[relativePath];
      if (checksum) {
        const actual = createHash("sha256")
          .update(await readFile(filePath))
          .digest("hex");
        if (actual.toLowerCase() !== checksum.toLowerCase()) {
          errors.push(`Checksum mismatch for "${path.relative(packagePath, filePath)}".`);
        }
      }
    }
  } catch (error) {
    errors.push(toErrorMessage(error));
  }
  return { valid: errors.length === 0, manifest, errors, warnings };
}

export async function loadAvatarPackage(packageRoot: string): Promise<AvatarPackage> {
  const validation = await validateAvatarPackage(packageRoot);
  if (!validation.valid || !validation.manifest) {
    throw new AvatarPackageError(
      `Invalid avatar package: ${validation.errors.join(" ") || "manifest is missing"}`,
      validation.errors
    );
  }
  return { id: validation.manifest.id, rootPath: await realpath(packageRoot), manifest: validation.manifest };
}

async function resolvePackageRoot(sourcePath: string): Promise<string> {
  const sourceStat = await stat(sourcePath).catch((error: unknown) => {
    throw new AvatarPackageError(`Avatar package source is not accessible: ${toErrorMessage(error)}`);
  });
  const candidate = sourceStat.isDirectory() ? sourcePath : path.dirname(sourcePath);
  return realpath(candidate);
}

async function addReferencedFile(
  packageRoot: string,
  relativePath: string,
  field: string,
  referencedFiles: Set<string>,
  errors: string[]
): Promise<void> {
  let filePath: string;
  try {
    assertSafeRelativePath(relativePath, field);
    filePath = path.resolve(packageRoot, relativePath);
    assertInside(packageRoot, filePath, field);
  } catch (error) {
    errors.push(toErrorMessage(error));
    return;
  }

  try {
    const result = await lstat(filePath);
    if (result.isSymbolicLink()) {
      throw new AvatarPackageError(`${field} must not reference a symbolic link: "${relativePath}".`);
    }
    if (!result.isFile()) {
      errors.push(`${field} must reference a file: "${relativePath}".`);
      return;
    }
    if (result.size > MAX_AVATAR_PACKAGE_FILE_BYTES) {
      errors.push(`${field} exceeds the ${MAX_AVATAR_PACKAGE_FILE_BYTES}-byte avatar asset limit: "${relativePath}".`);
      return;
    }
    const realFilePath = await realpath(filePath);
    assertInside(packageRoot, realFilePath, field);
    if (path.extname(filePath).toLowerCase() === ".svg") {
      const source = await readFile(filePath, "utf8");
      if (sanitizeSvg(source) !== source) {
        errors.push(`${field} contains executable or remote SVG content: "${relativePath}".`);
      }
    }
    referencedFiles.add(filePath);
  } catch (error) {
    errors.push(`${field} is not a safe readable file: "${relativePath}" (${toErrorMessage(error)}).`);
  }
}

async function validatePackageTree(packageRoot: string, errors: string[]): Promise<void> {
  let fileCount = 0;
  let totalBytes = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const entryStat = await lstat(filePath);
      if (entryStat.isSymbolicLink()) {
        errors.push(`Avatar packages must not contain symbolic links: "${path.relative(packageRoot, filePath)}".`);
        continue;
      }
      if (entryStat.isDirectory()) {
        await visit(filePath);
        continue;
      }
      if (!entryStat.isFile()) {
        errors.push(
          `Avatar packages may contain only regular files and directories: "${path.relative(packageRoot, filePath)}".`
        );
        continue;
      }

      fileCount += 1;
      totalBytes += entryStat.size;
      if (fileCount > MAX_AVATAR_PACKAGE_FILES) {
        errors.push(`Avatar package contains more than the ${MAX_AVATAR_PACKAGE_FILES}-file limit.`);
        return;
      }
      if (entryStat.size > MAX_AVATAR_PACKAGE_FILE_BYTES) {
        errors.push(
          `Avatar asset exceeds the ${MAX_AVATAR_PACKAGE_FILE_BYTES}-byte file limit: "${path.relative(packageRoot, filePath)}".`
        );
      }
      if (totalBytes > MAX_AVATAR_PACKAGE_TOTAL_BYTES) {
        errors.push(`Avatar package exceeds the ${MAX_AVATAR_PACKAGE_TOTAL_BYTES}-byte total size limit.`);
        return;
      }
    }
  }

  await visit(packageRoot);
}

function assertSafeRelativePath(value: string, field: string): void {
  if (
    value.trim().length === 0 ||
    value.includes("\0") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    value.split(/[\\/]+/).some((segment) => segment === "..")
  ) {
    throw new AvatarPackageError(`${field} must be a safe local relative path: "${value}".`);
  }
}

function assertInside(parent: string, child: string, field: string): void {
  if (!isPathInside(parent, child)) {
    throw new AvatarPackageError(`${field} escapes the approved avatar directory.`);
  }
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isRegistryFile(value: unknown): value is RegistryFile {
  if (!value || typeof value !== "object") return false;
  const registry = value as Partial<RegistryFile>;
  if (
    registry.schemaVersion !== REGISTRY_SCHEMA_VERSION ||
    !registry.packages ||
    typeof registry.packages !== "object" ||
    Array.isArray(registry.packages)
  ) {
    return false;
  }
  if (
    registry.activeId !== undefined &&
    (typeof registry.activeId !== "string" || !isValidPackageId(registry.activeId))
  ) {
    return false;
  }
  for (const [id, relativeRoot] of Object.entries(registry.packages)) {
    if (!isValidPackageId(id) || typeof relativeRoot !== "string" || !isSafeRelativePath(relativeRoot)) {
      return false;
    }
  }
  return registry.activeId === undefined || Object.hasOwn(registry.packages, registry.activeId);
}

function isValidPackageId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value);
}

function assertValidPackageId(value: string): void {
  if (!isValidPackageId(value)) {
    throw new AvatarPackageError(
      "Avatar id must be 1-80 letters, numbers, dots, underscores, or hyphens and start with a letter or number."
    );
  }
}

function withMatchingRegistryId(id: string, validation: AvatarPackageValidation): AvatarPackageValidation {
  if (!validation.manifest || validation.manifest.id === id) return validation;
  return {
    ...validation,
    valid: false,
    errors: [...validation.errors, `Registry id "${id}" does not match package id "${validation.manifest.id}".`]
  };
}

function unsafeRegisteredPackageValidation(): AvatarPackageValidation {
  return {
    valid: false,
    errors: ["Registered avatar package folder is missing, inaccessible, or unsafe."],
    warnings: []
  };
}

function cloneRegistry(registry: RegistryFile): RegistryFile {
  return JSON.parse(JSON.stringify(registry)) as RegistryFile;
}

function setRegistryPackage(registry: RegistryFile, id: string, relativeRoot: string): void {
  Object.defineProperty(registry.packages, id, {
    configurable: true,
    enumerable: true,
    value: relativeRoot,
    writable: true
  });
}

function isSafeRelativePath(value: string): boolean {
  try {
    assertSafeRelativePath(value, "Path");
    return true;
  } catch {
    return false;
  }
}

const RENAME_RETRY_DELAYS_MS = [20, 40, 80, 160, 320, 500] as const;

async function renameWithRetry(source: string, destination: string): Promise<void> {
  let retry = 0;
  while (true) {
    try {
      await renamePath(source, destination);
      return;
    } catch (error) {
      if (!isTransientRenameError(error) || retry >= RENAME_RETRY_DELAYS_MS.length) throw error;
      await delay(RENAME_RETRY_DELAYS_MS[retry]);
      retry += 1;
    }
  }
}

function isTransientRenameError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "EPERM" || error.code === "EACCES" || error.code === "EBUSY" || error.code === "ENOTEMPTY";
}

function isFileNotFound(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function exists(target: string): Promise<boolean> {
  return stat(target).then(
    () => true,
    () => false
  );
}
