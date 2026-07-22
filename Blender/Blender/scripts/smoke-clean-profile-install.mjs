import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));
const extensionId = process.env.CODEX_AVATAR_EXTENSION_ID ?? "codex-avatar-studio.codex-avatar-studio-extension";
const timeoutMs = Number(process.env.CODE_CLI_TIMEOUT_MS ?? 120_000);

if (!existsSync(vsixPath)) {
  throw new Error(`VSIX does not exist: ${vsixPath}`);
}

const codeCli = resolveCodeCli();
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-clean-profile-"));
const extensionsDir = path.join(tempRoot, "extensions");
const userDataDir = path.join(tempRoot, "user-data");

try {
  console.log(`Using VS Code CLI: ${codeCli}`);
  console.log(`Clean profile: ${tempRoot}`);
  console.log(`Installing: ${vsixPath}`);

  runCode([
    "--extensions-dir",
    extensionsDir,
    "--user-data-dir",
    userDataDir,
    "--install-extension",
    vsixPath,
    "--force"
  ]);
  const listed = runCode(["--extensions-dir", extensionsDir, "--user-data-dir", userDataDir, "--list-extensions"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.ok(
    listed.includes(extensionId),
    `Expected ${extensionId} in clean profile list. Got: ${listed.join(", ") || "(empty)"}`
  );
  console.log(`Clean-profile install OK: ${extensionId}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function runCode(args) {
  // Prefer the CLI shim (code.cmd / code), never Code.exe — the GUI binary can hang the shell.
  // On Windows, shell mode is required for .cmd; quote every arg so paths with spaces work.
  const result =
    process.platform === "win32"
      ? spawnSync([codeCli, ...args].map(quoteWindowsArg).join(" "), {
          encoding: "utf8",
          shell: true,
          windowsHide: true,
          timeout: timeoutMs,
          env: process.env
        })
      : spawnSync(codeCli, args, {
          encoding: "utf8",
          shell: false,
          timeout: timeoutMs,
          env: process.env
        });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(
        `VS Code CLI timed out after ${timeoutMs}ms. Use bin/code.cmd (not Code.exe) and isolated --extensions-dir/--user-data-dir.`
      );
    }
    throw result.error;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    throw new Error(`code ${args.join(" ")} failed (${result.status}):\n${stdout}\n${stderr}`.trim());
  }
  return `${stdout}\n${stderr}`;
}

function quoteWindowsArg(value) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function resolveCodeCli() {
  if (process.env.CODE_CLI && existsSync(process.env.CODE_CLI)) {
    assertNotGuiBinary(process.env.CODE_CLI);
    return process.env.CODE_CLI;
  }

  const candidates = [];
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    if (localAppData) {
      candidates.push(path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd"));
      candidates.push(path.join(localAppData, "Programs", "Microsoft VS Code Insiders", "bin", "code-insiders.cmd"));
    }
    if (programFiles) {
      candidates.push(path.join(programFiles, "Microsoft VS Code", "bin", "code.cmd"));
      candidates.push(path.join(programFiles, "Microsoft VS Code Insiders", "bin", "code-insiders.cmd"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code");
    candidates.push("/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code");
  } else {
    candidates.push("/usr/bin/code", "/usr/share/code/bin/code", "/snap/bin/code");
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      assertNotGuiBinary(candidate);
      return candidate;
    }
  }

  const fromPath = whichOnPath(process.platform === "win32" ? "code.cmd" : "code");
  if (fromPath) {
    assertNotGuiBinary(fromPath);
    return fromPath;
  }

  throw new Error(
    "Could not find the VS Code CLI (bin/code.cmd or `code` on PATH). Set CODE_CLI to the CLI shim path. Do not point CODE_CLI at Code.exe."
  );
}

function assertNotGuiBinary(cliPath) {
  const base = path.basename(cliPath).toLowerCase();
  if (base === "code.exe" || base === "code - insiders.exe") {
    throw new Error(
      `Refusing GUI binary ${cliPath}. Use the CLI shim (…/bin/code.cmd or …/bin/code) so --install-extension exits.`
    );
  }
}

function whichOnPath(command) {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(finder, [command], {
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true
  });
  if (result.status !== 0) return undefined;
  const first = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first && existsSync(first) ? first : undefined;
}
