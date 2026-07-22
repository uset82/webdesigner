import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));

if (!existsSync(vsixPath)) {
  throw new Error(`VSIX does not exist: ${vsixPath}`);
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-vsix-smoke-"));
extractVsix(vsixPath, tempRoot);
const installedExtensionDir = path.join(tempRoot, "extension");
const bundledWorkerPath = path.join(installedExtensionDir, "dist", "vectorizeWorker.js");
assert.equal(existsSync(bundledWorkerPath), true, "installed VSIX contains the vectorization worker");
const workerWorkspace = path.join(tempRoot, "worker-workspace");
const workerInput = path.join(workerWorkspace, "fixture.png");
mkdirSync(workerWorkspace, { recursive: true });
writeFileSync(
  workerInput,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
    "base64"
  )
);
const installedWorkerPreview = await runBundledVectorPreview(bundledWorkerPath, {
  inputPath: workerInput,
  workspaceRoot: workerWorkspace,
  outputBaseName: "fixture",
  preprocessing: {
    grayscale: false,
    quantizationLevels: 16,
    removeBackground: true,
    noiseReduction: 10,
    detail: "balanced"
  },
  maxSvgBytes: 1_000_000,
  maxSvgPaths: 20_000
});
assert.match(installedWorkerPreview.optimizedSvg, /<svg/i, "installed worker decodes and traces a real PNG");
assert.ok(installedWorkerPreview.optimizedValidation.pathCount > 0, "installed worker returns SVG metrics");
assert.equal(
  existsSync(path.join(workerWorkspace, ".codex-avatar", "exports")),
  false,
  "worker preview writes no committed export"
);
const vscodeMockDir = path.join(installedExtensionDir, "node_modules", "vscode");
mkdirSync(vscodeMockDir, { recursive: true });
writeFileSync(path.join(vscodeMockDir, "index.js"), createVscodeMockSource(), "utf8");

const requireInstalled = createRequire(path.join(installedExtensionDir, "dist", "extension.js"));
const extension = requireInstalled(path.join(installedExtensionDir, "dist", "extension.js"));
const vscode = requireInstalled("vscode");
const activationWorkspace = path.join(tempRoot, "activation-workspace");
mkdirSync(activationWorkspace, { recursive: true });
vscode.__workspaceRoot = activationWorkspace;
const context = {
  extensionUri: { fsPath: installedExtensionDir },
  subscriptions: []
};

extension.activate(context);

const requiredCommands = [
  "codexAvatar.openAssistant",
  "codexAvatar.toggleAssistant",
  "codexAvatar.resetSettings",
  "codexAvatar.openAssetsFolder",
  "codexAvatar.reloadAvatar",
  "codexAvatar.importAvatar",
  "codexAvatar.removeAvatar",
  "codexAvatar.deleteImportedAvatar",
  "codexAvatar.activateAvatar",
  "codexAvatar.clearCache",
  "codexAvatar.setState",
  "codexAvatar.startThinking",
  "codexAvatar.startSpeaking",
  "codexAvatar.markSuccess",
  "codexAvatar.markError",
  "codexAvatar.createFromPicture",
  "codexAvatar.vectorizeImage",
  "codexAvatar.exportBlenderScene"
];

for (const command of requiredCommands) {
  assert.ok(vscode.__registeredCommands.has(command), `${command} registered after install`);
}

const provider = vscode.__registeredViewProviders.get("codexAvatar.assistantView");
assert.equal(provider?.constructor.name, "AvatarWebviewProvider");
assert.ok(context.subscriptions.length >= requiredCommands.length, "activation adds disposables");

const webviewSmoke = createWebviewSmoke();
provider.resolveWebviewView(webviewSmoke.view);

assert.equal(webviewSmoke.webview.options.enableScripts, true, "webview scripts are enabled for bundled UI");
assert.match(webviewSmoke.webview.html, /Content-Security-Policy/, "webview HTML includes CSP");
assert.match(webviewSmoke.webview.html, /default-src 'none'/, "webview denies default remote content");
assert.match(webviewSmoke.webview.html, /<div id="root"><\/div>/, "webview contains the React root");
assert.ok(webviewSmoke.handlers.length > 0, "webview receive handler is registered");

await webviewSmoke.handlers[0]({ protocolVersion: 1, type: "webview:ready" });
await Promise.all([
  waitForMessage(webviewSmoke.messages, "settings:update"),
  waitForMessage(webviewSmoke.messages, "avatar:setState"),
  waitForMessage(webviewSmoke.messages, "blender:status"),
  waitForMessage(webviewSmoke.messages, "assets:manifestLoaded")
]);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "settings:update"),
  "webview ready posts settings"
);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "avatar:setState"),
  "webview ready posts current state"
);
assert.ok(
  webviewSmoke.messages.some(
    (message) => message.type === "blender:status" && message.availability === "missing" && message.busy === false
  ),
  "webview ready posts the optional Blender connection state"
);
assert.ok(
  webviewSmoke.messages.some(
    (message) =>
      message.type === "assets:manifestLoaded" && message.manifest.entrypoints.svg.includes("placeholder-avatar.svg")
  ),
  "webview ready receives the placeholder SVG fallback manifest"
);
const initialManifest = webviewSmoke.messages.find((message) => message.type === "assets:manifestLoaded")?.manifest;
assert.match(initialManifest?.entrypoints.svg ?? "", /codexAvatarAssetRevision=\d+/, "SVG URI is cache-versioned");

await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "settings:update",
  config: { runtime: "pixi", showSpeechBubble: false }
});
await new Promise((resolve) => setTimeout(resolve, 25));
assert.equal(vscode.__configStore.get("runtime"), "pixi");
assert.equal(vscode.__configStore.get("showSpeechBubble"), false);

const studioWorkspace = path.join(tempRoot, "studio-workspace");
const studioSource = path.join(tempRoot, "studio-source.png");
const studioSourceBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);
mkdirSync(studioWorkspace, { recursive: true });
writeFileSync(studioSource, studioSourceBytes);
vscode.__workspaceRoot = studioWorkspace;
vscode.__openDialogValue = [{ fsPath: studioSource }];
await webviewSmoke.handlers[0]({ protocolVersion: 1, type: "studio:chooseImage" });
const selectedPicture = await waitForMessage(webviewSmoke.messages, "studio:imageSelected");
await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "studio:vectorizeImage",
  jobId: selectedPicture.selection.jobId,
  revision: 1,
  options: {
    preset: "color-illustration",
    grayscale: false,
    colorCount: 16,
    threshold: null,
    removeNearWhite: true,
    noiseReduction: 10,
    detail: "balanced"
  }
});
await waitForMessage(webviewSmoke.messages, "studio:vectorPreview");
await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "studio:saveAvatar",
  jobId: selectedPicture.selection.jobId,
  revision: 1,
  metadata: {
    id: "installed-studio-avatar",
    name: "Installed Studio Avatar",
    author: "VSIX Smoke",
    version: "1.0.0",
    license: "UNLICENSED"
  },
  collisionAction: "reject"
});
await waitForMessage(webviewSmoke.messages, "studio:packageSaved");
await waitForMessage(
  webviewSmoke.messages,
  "assets:manifestLoaded",
  (message) => message.manifest.id === "installed-studio-avatar"
);
const installedAvatarRoot = path.join(studioWorkspace, ".codex-avatar", "avatars", "installed-studio-avatar");
assert.equal(
  existsSync(path.join(installedAvatarRoot, "avatar.manifest.json")),
  true,
  "installed Studio saves manifest"
);
assert.equal(existsSync(path.join(installedAvatarRoot, "svg", "avatar.svg")), true, "installed Studio saves SVG");
assert.deepEqual(readFileSync(studioSource), studioSourceBytes, "installed Studio preserves the selected source");
assert.equal(vscode.__configStore.get("character"), "installed-studio-avatar", "installed Studio activates avatar id");
assert.equal(vscode.__configStore.get("runtime"), "svg", "installed Studio activates SVG runtime");
vscode.__openDialogValue = undefined;

vscode.__quickPickValue = "thinking";
await vscode.commands.executeCommand("codexAvatar.openAssistant");
await vscode.commands.executeCommand("codexAvatar.toggleAssistant");
await vscode.commands.executeCommand("codexAvatar.resetSettings");
await vscode.commands.executeCommand("codexAvatar.openAssetsFolder");
await vscode.commands.executeCommand("codexAvatar.reloadAvatar");
await vscode.commands.executeCommand("codexAvatar.setState");
await vscode.commands.executeCommand("codexAvatar.startThinking");
await vscode.commands.executeCommand("codexAvatar.startSpeaking");
await vscode.commands.executeCommand("codexAvatar.markSuccess");
await vscode.commands.executeCommand("codexAvatar.markError");
await vscode.commands.executeCommand("codexAvatar.createFromPicture");
await vscode.commands.executeCommand("codexAvatar.vectorizeImage");
vscode.__configStore.set("blenderPath", process.execPath);
await vscode.commands.executeCommand("codexAvatar.exportBlenderScene");
assert.ok(
  webviewSmoke.messages.filter((message) => message.type === "blender:status").length >= 2,
  "installed export command reports a typed Blender probe result"
);

assert.ok(
  vscode.__executedCommands.has("workbench.view.extension.codexAvatar"),
  "open assistant focuses view container"
);
assert.ok(vscode.__executedCommands.has("revealFileInOS"), "open assets folder reveals local folder");
assert.ok(vscode.__createdDirectories.length > 0, "open assets folder creates local asset workspace");
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "assets:manifestLoaded"),
  "reload posts manifest"
);
const manifestMessages = webviewSmoke.messages.filter((message) => message.type === "assets:manifestLoaded");
assert.ok(manifestMessages.length >= 2, "reload posts a fresh manifest");
assert.notEqual(
  manifestMessages.at(-1).manifest.entrypoints.svg,
  initialManifest.entrypoints.svg,
  "reload changes the SVG cache revision"
);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "avatar:trigger"),
  "manual commands post triggers"
);

extension.deactivate?.();

console.log(`VSIX package, activation, command, and webview smoke passed: ${installedExtensionDir}`);

function extractVsix(vsixFile, outputDirectory) {
  execFileSync("tar", ["-xf", vsixFile, "-C", outputDirectory], { stdio: "inherit" });
}

function runBundledVectorPreview(workerPath, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { execArgv: ["--no-deprecation"], workerData });
    worker.on("message", (message) => {
      if (message.type === "result") {
        void worker.terminate();
        resolve(message.preview);
      } else if (message.type === "error") {
        void worker.terminate();
        reject(new Error(message.message));
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Installed vectorization worker exited with code ${code}.`));
    });
  });
}

async function waitForMessage(messages, type, predicate = () => true) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const message = messages.find((candidate) => candidate.type === type && predicate(candidate));
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for installed Webview message: ${type}`);
}

function createVscodeMockSource() {
  return String.raw`
const registeredCommands = new Map();
const registeredViewProviders = new Map();
const executedCommands = new Set();
const createdDirectories = [];
const disposable = () => ({ dispose() {} });
const configStore = new Map();

const Uri = {
  file: fsPath => ({ fsPath, toString: () => fsPath }),
  joinPath: (base, ...segments) => ({
    fsPath: [base.fsPath, ...segments].join("/"),
    toString: () => [base.fsPath, ...segments].join("/")
  })
};

module.exports = {
  __registeredCommands: registeredCommands,
  __registeredViewProviders: registeredViewProviders,
  __executedCommands: executedCommands,
  __createdDirectories: createdDirectories,
  __configStore: configStore,
  __openDialogValue: undefined,
  __quickPickValue: undefined,
  __workspaceRoot: process.cwd(),
  ConfigurationTarget: { Global: 1 },
  DiagnosticSeverity: { Error: 0, Warning: 1 },
  Uri,
  commands: {
    executeCommand: async (command, ...args) => {
      executedCommands.add(command);
      return registeredCommands.has(command) ? registeredCommands.get(command)(...args) : undefined;
    },
    registerCommand(command, callback) {
      registeredCommands.set(command, callback);
      return disposable();
    }
  },
  debug: {
    onDidStartDebugSession: () => disposable(),
    onDidTerminateDebugSession: () => disposable()
  },
  env: {
    clipboard: { writeText: async () => undefined }
  },
  languages: {
    getDiagnostics: () => [],
    onDidChangeDiagnostics: () => disposable()
  },
  tasks: {
    onDidStartTask: () => disposable(),
    onDidEndTask: () => disposable()
  },
  window: {
    createOutputChannel: () => ({
      append() {},
      appendLine() {},
      dispose() {},
      show() {}
    }),
    onDidChangeActiveTextEditor: () => disposable(),
    onDidOpenTerminal: () => disposable(),
    onDidCloseTerminal: () => disposable(),
    registerWebviewViewProvider(viewType, provider) {
      registeredViewProviders.set(viewType, provider);
      return disposable();
    },
    showErrorMessage: () => undefined,
    showInformationMessage: () => undefined,
    showOpenDialog: async () => module.exports.__openDialogValue,
    showQuickPick: async () => module.exports.__quickPickValue,
    showTextDocument: async () => undefined,
    showWarningMessage: () => undefined
  },
  workspace: {
    isTrusted: true,
    fs: {
      createDirectory: async uri => {
        createdDirectories.push(uri.fsPath);
      }
    },
    getConfiguration: () => ({
      get: (key, fallback) => configStore.has(key) ? configStore.get(key) : fallback,
      update: async (key, value) => {
        if (value === undefined) {
          configStore.delete(key);
        } else {
          configStore.set(key, value);
        }
      }
    }),
    onDidChangeConfiguration: () => disposable(),
    onDidChangeTextDocument: () => disposable(),
    onDidSaveTextDocument: () => disposable(),
    onDidGrantWorkspaceTrust: () => disposable(),
    openTextDocument: async uri => ({ uri }),
    get workspaceFolders() {
      return [{ uri: { fsPath: module.exports.__workspaceRoot } }];
    }
  }
};
`;
}

function createWebviewSmoke() {
  const messages = [];
  const handlers = [];
  const webview = {
    cspSource: "vscode-webview://codex-avatar-studio",
    html: "",
    options: {},
    asWebviewUri(uri) {
      const fsPath = uri.fsPath.replace(/\\/g, "/");
      return {
        fsPath,
        toString: () => `vscode-webview://codex-avatar-studio/${fsPath.replace(/^[A-Za-z]:/, "")}`
      };
    },
    onDidReceiveMessage(handler) {
      handlers.push(handler);
      return { dispose() {} };
    },
    postMessage(message) {
      messages.push(message);
      return Promise.resolve(true);
    }
  };

  const view = {
    webview,
    onDidDispose: () => ({ dispose() {} })
  };

  return { handlers, messages, view, webview };
}
