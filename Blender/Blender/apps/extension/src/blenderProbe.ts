import { spawn, type ChildProcess } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type BlenderDiscoverySource = "setting" | "environment" | "path" | "platform";

export type BlenderSupportState = "supported" | "unsupported" | "not-found";

export type BlenderVersion = {
  major: number;
  minor: number;
  patch: number;
  version: string;
  raw: string;
};

export type BlenderCapabilities = {
  backgroundMode: boolean;
  pythonScripting: boolean;
  svgLineArt: boolean;
  svgLineArtRequiresGreasePencil: boolean;
  glbExport: boolean;
  pngPreview: boolean;
};

export type BlenderProbeAttempt = {
  executablePath: string;
  source: BlenderDiscoverySource;
  state: "supported" | "unsupported" | "invalid";
  version: BlenderVersion | null;
  message: string;
};

export type BlenderPreferenceIssue = {
  executablePath: string;
  message: string;
};

export type BlenderProbeResult = {
  executablePath: string | null;
  discoverySource: BlenderDiscoverySource | null;
  version: BlenderVersion | null;
  supportState: BlenderSupportState;
  capabilities: BlenderCapabilities;
  configuredPreferenceIssue: BlenderPreferenceIssue | null;
  attempts: BlenderProbeAttempt[];
};

export type BlenderVersionCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type BlenderProbeOptions = {
  configuredPath?: string;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  timeoutMs?: number;
  minimumVersion?: readonly [major: number, minor: number, patch: number];
  signal?: AbortSignal;
  runVersionCommand?: (
    executablePath: string,
    timeoutMs: number,
    signal?: AbortSignal
  ) => Promise<BlenderVersionCommandResult>;
  discoverPlatformCandidates?: () => Promise<string[]>;
};

export type BlenderPlatformDiscoveryOptions = {
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  readDirectory?: (directoryPath: string) => Promise<readonly string[]>;
  canAccess?: (candidatePath: string) => Promise<boolean>;
};

const defaultMinimumVersion = [3, 6, 0] as const;
const defaultTimeoutMs = 5_000;
const maximumProbeOutputBytes = 64 * 1024;

export async function probeBlenderExecutable(options: BlenderProbeOptions = {}): Promise<BlenderProbeResult> {
  throwIfProbeAborted(options.signal);
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const minimumVersion = options.minimumVersion ?? defaultMinimumVersion;
  const runVersionCommand = options.runVersionCommand ?? runBlenderVersionCommand;
  const configuredPath = options.configuredPath?.trim() ?? "";
  const environmentPath = environment.BLENDER_PATH?.trim() ?? "";
  const platformCandidates = options.discoverPlatformCandidates
    ? await safelyDiscoverCandidates(options.discoverPlatformCandidates)
    : await discoverPlatformBlenderCandidates({
        environment,
        platform,
        ...(options.homeDirectory === undefined ? {} : { homeDirectory: options.homeDirectory })
      });
  const candidates = deduplicateCandidates(
    [
      ...(configuredPath ? [{ executablePath: configuredPath, source: "setting" as const }] : []),
      ...(environmentPath ? [{ executablePath: environmentPath, source: "environment" as const }] : []),
      {
        executablePath: platform === "win32" ? "blender.exe" : "blender",
        source: "path" as const
      },
      ...platformCandidates.map((executablePath) => ({ executablePath, source: "platform" as const }))
    ],
    platform
  );

  const attempts: BlenderProbeAttempt[] = [];
  let configuredPreferenceIssue: BlenderPreferenceIssue | null = null;
  let unsupportedCandidate:
    | {
        executablePath: string;
        discoverySource: BlenderDiscoverySource;
        version: BlenderVersion;
        capabilities: BlenderCapabilities;
      }
    | undefined;

  for (const candidate of candidates) {
    throwIfProbeAborted(options.signal);
    const attempt = await probeCandidate(candidate, timeoutMs, minimumVersion, runVersionCommand, options.signal);
    attempts.push(attempt);

    if (candidate.source === "setting" && attempt.state === "invalid") {
      configuredPreferenceIssue = {
        executablePath: candidate.executablePath,
        message: attempt.message
      };
    }

    if (attempt.state === "supported" && attempt.version) {
      return {
        executablePath: candidate.executablePath,
        discoverySource: candidate.source,
        version: attempt.version,
        supportState: "supported",
        capabilities: capabilitiesForVersion(attempt.version, true),
        configuredPreferenceIssue,
        attempts
      };
    }

    if (attempt.state === "unsupported" && attempt.version && !unsupportedCandidate) {
      unsupportedCandidate = {
        executablePath: candidate.executablePath,
        discoverySource: candidate.source,
        version: attempt.version,
        capabilities: capabilitiesForVersion(attempt.version, false)
      };
    }
  }

  if (unsupportedCandidate) {
    return {
      ...unsupportedCandidate,
      supportState: "unsupported",
      configuredPreferenceIssue,
      attempts
    };
  }

  return {
    executablePath: null,
    discoverySource: null,
    version: null,
    supportState: "not-found",
    capabilities: unavailableCapabilities(),
    configuredPreferenceIssue,
    attempts
  };
}

export function parseBlenderVersion(output: string): BlenderVersion | null {
  for (const line of output.split(/\r?\n/)) {
    const raw = line.trim();
    const match = /^Blender\s+(\d+)\.(\d+)(?:\.(\d+))?(?:\s|$)/.exec(raw);
    if (!match) {
      continue;
    }

    const major = Number.parseInt(match[1] ?? "", 10);
    const minor = Number.parseInt(match[2] ?? "", 10);
    const patch = Number.parseInt(match[3] ?? "0", 10);
    if (![major, minor, patch].every(Number.isSafeInteger)) {
      return null;
    }

    return {
      major,
      minor,
      patch,
      version: `${major}.${minor}.${patch}`,
      raw
    };
  }

  return null;
}

export async function discoverPlatformBlenderCandidates(
  options: BlenderPlatformDiscoveryOptions = {}
): Promise<string[]> {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const homeDirectory = options.homeDirectory ?? os.homedir();
  const readDirectory = options.readDirectory ?? readDirectoryNames;
  const canAccess = options.canAccess ?? isAccessible;
  const candidates: string[] = [];

  if (platform === "win32") {
    const roots = new Set<string>();
    for (const root of [environment.ProgramFiles, environment["ProgramFiles(x86)"]]) {
      if (root?.trim()) {
        roots.add(path.win32.join(root.trim(), "Blender Foundation"));
      }
    }
    if (environment.LOCALAPPDATA?.trim()) {
      roots.add(path.win32.join(environment.LOCALAPPDATA.trim(), "Programs", "Blender Foundation"));
    }

    for (const foundationRoot of roots) {
      const entries = await safelyReadDirectory(foundationRoot, readDirectory);
      for (const entry of sortNewestFirst(entries.filter((name) => /^Blender(?:\s|$)/i.test(name)))) {
        const candidate = path.win32.join(foundationRoot, entry, "blender.exe");
        if (await canAccess(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  } else if (platform === "darwin") {
    for (const applicationsRoot of ["/Applications", path.posix.join(homeDirectory, "Applications")]) {
      const entries = await safelyReadDirectory(applicationsRoot, readDirectory);
      for (const entry of sortNewestFirst(entries.filter((name) => /^Blender.*\.app$/i.test(name)))) {
        const candidate = path.posix.join(applicationsRoot, entry, "Contents", "MacOS", "Blender");
        if (await canAccess(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  } else {
    for (const installRoot of ["/opt", "/usr/local"]) {
      const entries = await safelyReadDirectory(installRoot, readDirectory);
      for (const entry of sortNewestFirst(entries.filter((name) => /^blender(?:[-_.\s]|$)/i.test(name)))) {
        for (const candidate of [
          path.posix.join(installRoot, entry, "blender"),
          path.posix.join(installRoot, entry, "bin", "blender")
        ]) {
          if (await canAccess(candidate)) {
            candidates.push(candidate);
          }
        }
      }
    }

    for (const candidate of [
      "/snap/blender/current/blender",
      "/var/lib/flatpak/exports/bin/org.blender.Blender",
      path.posix.join(homeDirectory, ".local", "share", "flatpak", "exports", "bin", "org.blender.Blender")
    ]) {
      if (await canAccess(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  return [...new Set(candidates)];
}

export function runBlenderVersionCommand(
  executablePath: string,
  timeoutMs = defaultTimeoutMs,
  signal?: AbortSignal
): Promise<BlenderVersionCommandResult> {
  if (signal?.aborted) return Promise.reject(createProbeAbortError());
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, ["--version"], {
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const stopAndReject = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      void terminateProbeProcessTree(child).finally(() => reject(error));
    };
    const onAbort = (): void => stopAndReject(createProbeAbortError());
    const timer = setTimeout(
      () => stopAndReject(new Error(`Blender version probe timed out after ${timeoutMs} ms.`)),
      timeoutMs
    );

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk.toString());
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString());
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve({ exitCode, stdout, stderr });
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

type BlenderCandidate = {
  executablePath: string;
  source: BlenderDiscoverySource;
};

async function probeCandidate(
  candidate: BlenderCandidate,
  timeoutMs: number,
  minimumVersion: readonly [number, number, number],
  runVersionCommand: NonNullable<BlenderProbeOptions["runVersionCommand"]>,
  signal?: AbortSignal
): Promise<BlenderProbeAttempt> {
  let result: BlenderVersionCommandResult;
  try {
    result = await runVersionCommand(candidate.executablePath, timeoutMs, signal);
  } catch (error) {
    if (isProbeAbortError(error)) throw error;
    return invalidAttempt(candidate, readableError(error));
  }

  if (result.exitCode !== 0) {
    const detail = firstUsefulLine(result.stderr) ?? firstUsefulLine(result.stdout);
    return invalidAttempt(
      candidate,
      `Version check exited with code ${result.exitCode ?? "unknown"}${detail ? `: ${detail}` : "."}`
    );
  }

  const version = parseBlenderVersion(`${result.stdout}\n${result.stderr}`);
  if (!version) {
    return invalidAttempt(candidate, "The executable ran, but its version output did not identify Blender.");
  }

  const supported = compareVersion(version, minimumVersion) >= 0;
  return {
    executablePath: candidate.executablePath,
    source: candidate.source,
    state: supported ? "supported" : "unsupported",
    version,
    message: supported
      ? `Blender ${version.version} is supported.`
      : `Blender ${version.version} is older than the supported minimum ${minimumVersion.join(".")}.`
  };
}

function invalidAttempt(candidate: BlenderCandidate, message: string): BlenderProbeAttempt {
  return {
    executablePath: candidate.executablePath,
    source: candidate.source,
    state: "invalid",
    version: null,
    message
  };
}

function compareVersion(version: BlenderVersion, minimum: readonly [number, number, number]): number {
  if (version.major !== minimum[0]) {
    return version.major - minimum[0];
  }
  if (version.minor !== minimum[1]) {
    return version.minor - minimum[1];
  }
  return version.patch - minimum[2];
}

function capabilitiesForVersion(_version: BlenderVersion, supported: boolean): BlenderCapabilities {
  if (!supported) {
    return unavailableCapabilities();
  }

  return {
    backgroundMode: true,
    pythonScripting: true,
    svgLineArt: true,
    svgLineArtRequiresGreasePencil: true,
    glbExport: true,
    pngPreview: true
  };
}

function unavailableCapabilities(): BlenderCapabilities {
  return {
    backgroundMode: false,
    pythonScripting: false,
    svgLineArt: false,
    svgLineArtRequiresGreasePencil: false,
    glbExport: false,
    pngPreview: false
  };
}

function deduplicateCandidates(candidates: BlenderCandidate[], platform: NodeJS.Platform): BlenderCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = platform === "win32" ? candidate.executablePath.toLowerCase() : candidate.executablePath;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs)) {
    return defaultTimeoutMs;
  }
  return Math.max(250, Math.min(30_000, Math.round(timeoutMs)));
}

async function safelyDiscoverCandidates(discover: () => Promise<string[]>): Promise<string[]> {
  try {
    return await discover();
  } catch {
    return [];
  }
}

async function safelyReadDirectory(
  directoryPath: string,
  readDirectory: NonNullable<BlenderPlatformDiscoveryOptions["readDirectory"]>
): Promise<readonly string[]> {
  try {
    return await readDirectory(directoryPath);
  } catch {
    return [];
  }
}

async function readDirectoryNames(directoryPath: string): Promise<readonly string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function isAccessible(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function sortNewestFirst(values: readonly string[]): string[] {
  return [...values].sort((left, right) => {
    const leftVersion = installFolderVersion(left);
    const rightVersion = installFolderVersion(right);
    if (leftVersion && rightVersion) {
      const componentCount = Math.max(leftVersion.length, rightVersion.length);
      for (let index = 0; index < componentCount; index += 1) {
        const difference = (rightVersion[index] ?? 0) - (leftVersion[index] ?? 0);
        if (difference !== 0) {
          return difference;
        }
      }
    } else if (leftVersion) {
      return -1;
    } else if (rightVersion) {
      return 1;
    }

    return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
  });
}

function installFolderVersion(value: string): number[] | null {
  const match = /(\d+(?:\.\d+)*)/.exec(value);
  return match?.[1]?.split(".").map((component) => Number.parseInt(component, 10)) ?? null;
}

function firstUsefulLine(value: string): string | undefined {
  const line = value
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find(Boolean);
  return line ? truncate(line, 300) : undefined;
}

function readableError(error: unknown): string {
  return truncate(error instanceof Error ? error.message : String(error), 300);
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength ? value : `${value.slice(0, maximumLength - 1)}…`;
}

function appendBounded(current: string, next: string): string {
  if (current.length >= maximumProbeOutputBytes) {
    return current;
  }
  return `${current}${next}`.slice(0, maximumProbeOutputBytes);
}

async function terminateProbeProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) {
    child.kill("SIGKILL");
    return;
  }
  if (process.platform === "win32") {
    await runProbeTaskkill(pid).catch(() => undefined);
    if (child.exitCode === null) child.kill("SIGKILL");
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

function runProbeTaskkill(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      shell: false
    });
    const timer = setTimeout(() => {
      killer.kill("SIGKILL");
      resolve();
    }, 5_000);
    const finish = (): void => {
      clearTimeout(timer);
      resolve();
    };
    killer.once("error", finish);
    killer.once("close", finish);
  });
}

function throwIfProbeAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createProbeAbortError();
}

function createProbeAbortError(): Error {
  const error = new Error("Blender connection check was cancelled.");
  error.name = "AbortError";
  return error;
}

function isProbeAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
