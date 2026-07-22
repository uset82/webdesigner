import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const webviewOutput = path.join(root, "apps", "extension", "media", "webview");
const edgeExecutable = findEdgeExecutable();
const smokeProfilePrefix = "codex-avatar-webview-smoke-";

if (!edgeExecutable) {
  throw new Error("Microsoft Edge was not found. Set EDGE_BIN to run the webview render smoke.");
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const relativePath = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath.slice(1));

    if (relativePath === "__fixtures__/custom-avatar.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#7c3aed"/><circle cx="60" cy="54" r="26" fill="#f8fafc"/><path d="M45 72q15 12 30 0" fill="none" stroke="#111827" stroke-width="5"/></svg>'
      );
      return;
    }

    if (relativePath === "__fixtures__/corrupt-avatar.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
      response.end("this is not an SVG image");
      return;
    }

    if (relativePath === "__fixtures__/picture-source.png") {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
          "base64"
        )
      );
      return;
    }

    const filePath = path.resolve(webviewOutput, relativePath);

    if (!isInsideDirectory(webviewOutput, filePath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await cleanupOldSmokeProfiles();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), smokeProfilePrefix));
let browser;

try {
  const port = await listen(server);
  const url = `http://127.0.0.1:${port}/index.html`;
  const debugPort = await findFreePort();
  browser = spawn(
    edgeExecutable,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tempRoot}`,
      url
    ],
    { windowsHide: true }
  );
  const stderr = captureStream(browser.stderr);
  const target = await waitForPageTarget(debugPort, url);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable").catch(() => undefined);
  await cdp.send("Runtime.enable").catch(() => undefined);
  await applyVisualEnvironment(cdp);
  await delay(500);
  const rendered = await evaluateRenderedWebview(cdp);
  await applyVisualEnvironment(cdp);
  await delay(50);

  assert.equal(rendered.hasPanel, true, "React avatar panel rendered");
  assert.equal(rendered.hasStage, true, "avatar stage rendered");
  assert.match(rendered.text, /Ready to build\./, "assistant message rendered");
  assert.match(rendered.text, /welcome/, "initial avatar state rendered");
  if (process.env.SMOKE_NO_ANIMATION === "1") {
    await dispatchExtensionMessage(cdp, {
      protocolVersion: 1,
      type: "settings:update",
      config: {
        enabled: true,
        runtime: "svg",
        position: "activity-bar-view",
        character: "default",
        animationIntensity: "medium",
        frameRate: 30,
        particleEffects: true,
        soundEnabled: false,
        lipSyncEnabled: false,
        idleTimeout: 15,
        sleepTimeout: 300,
        debugOverlay: false,
        noAnimation: true,
        focusMode: false,
        showSpeechBubble: true,
        respectReducedMotion: true,
        blenderPath: "",
        assetWorkspace: ".codex-avatar"
      }
    });
    const noAnimation = await cdp.send("Runtime.evaluate", {
      expression: "document.querySelector('.avatar-panel')?.dataset.noAnimation",
      returnByValue: true
    });
    assert.equal(noAnimation.result?.value, "true", "no-animation mode reaches the rendered panel");
  }
  if (process.env.SMOKE_REDUCED_MOTION === "1") {
    const reducedMotion = await cdp.send("Runtime.evaluate", {
      expression: "document.querySelector('.avatar-shell')?.dataset.reducedMotion",
      returnByValue: true
    });
    assert.equal(reducedMotion.result?.value, "true", "system reduced motion reaches the avatar renderer");
  }

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "library:updated",
    workspaceAvailable: true,
    workspaceTrusted: true,
    activeId: "custom-avatar",
    avatars: [
      {
        id: "default-coder-orb",
        name: "Default Coder Orb",
        author: "Codex Avatar Studio contributors",
        license: "UNLICENSED",
        version: "1.0.0",
        runtime: "svg",
        active: false,
        builtIn: true,
        valid: true,
        errorCount: 0,
        warningCount: 0
      },
      {
        id: "custom-avatar",
        name: "Custom Avatar",
        author: "Smoke Test",
        license: "Test fixture",
        version: "1.0.0",
        runtime: "svg",
        active: true,
        builtIn: false,
        valid: true,
        errorCount: 0,
        warningCount: 1
      }
    ]
  });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "library:validationResult",
    id: "custom-avatar",
    valid: true,
    errors: [],
    warnings: ["Optional preview image is not present."]
  });
  const avatarLibrary = await waitForAvatarLibrary(cdp, { text: "Custom Avatar", selectedId: "custom-avatar" });
  assert.equal(avatarLibrary.hasRawUri, false, "avatar library hides raw asset URIs");
  assert.match(avatarLibrary.text, /Optional preview image is not present/, "structured validation is visible");
  assert.match(avatarLibrary.text, /Export Avatar/, "avatar library exposes portable package export");
  await cdp.send("Runtime.evaluate", { expression: "document.body.tabIndex=-1; document.body.focus()" });
  for (const expected of ["Create from Picture", "Import Avatar", "Blender Tools"]) {
    await pressKey(cdp, "Tab", "Tab");
    assert.equal(await activeElementText(cdp), expected, `keyboard focus reaches ${expected}`);
  }
  await pressKey(cdp, "Enter", "Enter");
  await waitForBlenderTools(cdp, { visible: true });
  await pressKey(cdp, "Enter", "Enter");
  await waitForBlenderTools(cdp, { visible: false });

  if (process.env.SMOKE_SCREENSHOT_VIEW === "library") {
    await captureSmokeScreenshot(cdp);
  }

  const blenderReadyMessage = {
    protocolVersion: 1,
    type: "blender:status",
    availability: "ready",
    busy: false,
    executablePath: "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe",
    source: "platform",
    version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3 LTS" },
    support: "supported",
    capabilities: ["svg", "glb", "png"],
    configuredPathInvalid: false,
    message: "Blender 4.5.3 is connected and ready."
  };
  await dispatchExtensionMessage(cdp, blenderReadyMessage);
  await clickButton(cdp, ".action-row", "Blender Tools");
  const blenderTools = await waitForBlenderTools(cdp, {
    visible: true,
    text: "Blender 4.5.3 LTS",
    executablePath: blenderReadyMessage.executablePath
  });
  assert.match(blenderTools.text, /SVG line art.*GLB export.*PNG preview/s, "Blender capabilities are visible");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:operation",
    operation: "test",
    tone: "working",
    message: "Testing the selected Blender executable."
  });
  await waitForBlenderTools(cdp, { visible: true, text: "Cancel" });
  await dispatchExtensionMessage(cdp, blenderReadyMessage);
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:operation",
    operation: "test",
    tone: "success",
    message: "Blender connection passed."
  });
  await waitForBlenderTools(cdp, { visible: true, text: "Blender connection passed." });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:exportResult",
    jobId: "00000000-0000-4000-8000-000000000007",
    sourceFile: "Mascot.blend",
    results: [
      {
        status: "success",
        mode: "svg",
        fileName: "Mascot.line-art.svg",
        reportFileName: "Mascot.svg.export-report.json"
      },
      {
        status: "success",
        mode: "png",
        fileName: "Mascot.preview.png",
        reportFileName: "Mascot.png.export-report.json"
      },
      { status: "failed", mode: "glb", message: "No exportable mesh was found." }
    ],
    canUseAsAvatar: true
  });
  const blenderExport = await waitForBlenderTools(cdp, { visible: true, text: "Use SVG as Avatar" });
  assert.match(blenderExport.text, /Mascot\.line-art\.svg.*No exportable mesh/s, "partial Blender results are visible");
  assert.match(blenderExport.text, /Export a validated GLB/, "failed GLB is not offered as an active runtime");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:avatarSaveStatus",
    jobId: "00000000-0000-4000-8000-000000000007",
    tone: "success",
    message: "Mascot is now the active SVG avatar.",
    avatar: { id: "mascot", name: "Mascot", replacedExisting: false }
  });
  await waitForBlenderTools(cdp, { visible: true, text: "active SVG avatar" });
  if (process.env.SMOKE_SCREENSHOT_VIEW === "blender") {
    await captureSmokeScreenshot(cdp);
  }
  await clickButton(cdp, ".action-row", "Blender Tools");
  await waitForBlenderTools(cdp, { visible: false });

  const customSvgV1 = new URL("/__fixtures__/custom-avatar.svg?revision=1", url).toString();
  const customSvgV2 = new URL("/__fixtures__/custom-avatar.svg?revision=2", url).toString();
  const corruptSvg = new URL("/__fixtures__/corrupt-avatar.svg?revision=1", url).toString();

  await dispatchExtensionMessage(
    cdp,
    createManifestMessage("custom-avatar", { svg: customSvgV1 }, { svg: corruptSvg })
  );
  const customAvatar = await waitForSvgRenderer(cdp, {
    source: "manifest",
    imageSrc: customSvgV1,
    hasImage: true
  });
  assert.equal(customAvatar.hasBuiltIn, false, "loaded manifest SVG replaces the built-in orb");

  await dispatchExtensionMessage(cdp, { protocolVersion: 1, type: "avatar:setState", state: "thinking" });
  const thinkingAvatar = await waitForSvgRenderer(cdp, {
    source: "manifest",
    imageSrc: customSvgV1,
    hasImage: true,
    state: "thinking"
  });
  assert.match(
    thinkingAvatar.animationName,
    /avatar-(?:breathe|pulse)/,
    "custom SVG receives whole-avatar state motion"
  );

  await dispatchExtensionMessage(cdp, createManifestMessage("skjermbilde-character", { svg: customSvgV1 }));
  const idleMascot = await waitForLayeredMascot(cdp, { state: "thinking" });
  assert.equal(idleMascot.namedLayerCount >= 10, true, "reference mascot exposes independently animated layers");
  assert.equal(idleMascot.hasStaticImage, false, "layered mascot is not a slideshow or flat image");

  await dispatchExtensionMessage(cdp, { protocolVersion: 1, type: "avatar:setState", state: "speaking" });
  const speakingMascot = await waitForLayeredMascot(cdp, { state: "speaking", mouthOpen: true });
  assert.notEqual(speakingMascot.mouthAnimation, "none", "speaking state animates the separated mouth layer");

  await dispatchExtensionMessage(cdp, { protocolVersion: 1, type: "avatar:setState", state: "success" });
  const successMascot = await waitForLayeredMascot(cdp, { state: "success", successVisible: true });
  assert.notEqual(successMascot.bodyAnimation, "none", "success state animates the mascot body");
  if (process.env.SMOKE_SCREENSHOT_VIEW === "mascot") {
    await captureSmokeScreenshot(cdp);
  }

  await dispatchExtensionMessage(cdp, { protocolVersion: 1, type: "avatar:setState", state: "error" });
  await waitForLayeredMascot(cdp, { state: "error", errorVisible: true });
  await dispatchExtensionMessage(cdp, { protocolVersion: 1, type: "avatar:trigger", trigger: "nod" });
  await waitForLayeredMascot(cdp, { state: "error", trigger: "nod" });

  await cdp.send("Runtime.evaluate", {
    expression: "window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth, clientY: 0 }))"
  });
  const trackingMascot = await waitForLayeredMascot(cdp, { state: "error", lookX: "6.00px" });
  assert.equal(trackingMascot.lookY, "-4.00px", "pointer tracking updates both eye axes locally");

  await dispatchExtensionMessage(cdp, createManifestMessage("missing-avatar", {}));
  const missingAvatar = await waitForSvgRenderer(cdp, { source: "builtin", hasImage: false });
  assert.equal(missingAvatar.hasBuiltIn, true, "missing manifest SVG keeps the built-in orb");

  await dispatchExtensionMessage(cdp, createManifestMessage("corrupt-avatar", { svg: corruptSvg }));
  const corruptAvatar = await waitForSvgRenderer(cdp, { source: "builtin", hasImage: false });
  assert.equal(corruptAvatar.hasBuiltIn, true, "corrupt manifest SVG returns to the built-in orb");

  await dispatchExtensionMessage(cdp, createManifestMessage("corrupt-avatar", { svg: customSvgV2 }));
  const retriedAvatar = await waitForSvgRenderer(cdp, {
    source: "manifest",
    imageSrc: customSvgV2,
    hasImage: true
  });
  assert.equal(retriedAvatar.hasBuiltIn, false, "cache-revised SVG URI retries after an earlier load failure");

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:imageProgress",
    stage: "validating",
    message: "Checking picture safety and dimensions.",
    progress: 0.45
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Checking picture safety and dimensions." });

  const picturePreviewUri = new URL("/__fixtures__/picture-source.png?job=1", url).toString();
  const pictureJobId = "00000000-0000-4000-8000-000000000001";
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:imageSelected",
    selection: {
      jobId: pictureJobId,
      previewUri: picturePreviewUri,
      fileName: "avatar-source.png",
      width: 512,
      height: 768,
      fileSize: 2048,
      format: "png",
      hasAlpha: true,
      sourceKind: "external"
    }
  });
  const picturePreview = await waitForPictureStudio(cdp, {
    visible: true,
    text: "avatar-source.png",
    imageSrc: picturePreviewUri
  });
  assert.match(picturePreview.text, /512\s*×\s*768/, "picture dimensions are visible");
  assert.match(picturePreview.text, /Transparency detected/, "alpha status is visible");

  await clickPictureStudioButton(cdp, "Continue");
  await waitForPictureStudio(cdp, { visible: true, text: "Optimized SVG" });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorProgress",
    jobId: pictureJobId,
    revision: 1,
    stage: "tracing",
    message: "Tracing picture shapes into vector paths.",
    progress: 0.55
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Tracing picture shapes" });

  const vectorPreviewUri = new URL("/__fixtures__/custom-avatar.svg?vector=1", url).toString();
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorPreview",
    jobId: pictureJobId,
    revision: 1,
    previewUri: vectorPreviewUri,
    metrics: {
      rawByteSize: 4096,
      optimizedByteSize: 2048,
      pathCount: 42,
      groupCount: 0,
      tinyPathCount: 2,
      missingLayers: ["avatar/root", "avatar/head"],
      warnings: ["Static trace; named layers remain optional."]
    }
  });
  const vectorPreview = await waitForPictureStudio(cdp, {
    visible: true,
    text: "42",
    vectorImageSrc: vectorPreviewUri
  });
  assert.match(vectorPreview.text, /avatar\/root/, "missing named-layer guidance is visible");
  assert.match(vectorPreview.text, /Create Blender Scene from SVG/, "SVG handoff action is visible after preview");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:handoffStatus",
    jobId: pictureJobId,
    revision: 1,
    tone: "working",
    message: "Importing sanitized SVG curves into a new Blender working scene."
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Creating Blender Scene" });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "blender:handoffStatus",
    jobId: pictureJobId,
    revision: 1,
    tone: "success",
    message: "Editable Blender starting scene created. Curves are not an automatic rig or 3D character.",
    sceneFileName: "avatar.working.blend",
    reportFileName: "avatar.scene.export-report.json"
  });
  const handoff = await waitForPictureStudio(cdp, { visible: true, text: "Export Blender Scene" });
  assert.match(handoff.text, /Open Scene Folder.*Export Blender Scene/s, "handoff returns to the normal export flow");
  if (process.env.SMOKE_SCREENSHOT_VIEW === "handoff") {
    await captureSmokeScreenshot(cdp);
  }

  if (!["library", "blender", "handoff", "mascot"].includes(process.env.SMOKE_SCREENSHOT_VIEW ?? "")) {
    await captureSmokeScreenshot(cdp);
  }

  await clickPictureStudioButton(cdp, "Back");
  await waitForPictureStudio(cdp, { visible: true, text: "Review the picture" });
  await clickPictureStudioButton(cdp, "Continue");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorProgress",
    jobId: pictureJobId,
    revision: 2,
    stage: "tracing",
    message: "Tracing picture shapes into vector paths.",
    progress: 0.55
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Cancel conversion" });
  await clickPictureStudioButton(cdp, "Cancel conversion");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorCancelled",
    jobId: pictureJobId,
    revision: 2
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Conversion cancelled" });

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorError",
    jobId: pictureJobId,
    revision: 3,
    code: "output-limit",
    message: "Generated SVG exceeds the safe path limit.",
    recoverable: true
  });
  const vectorError = await waitForPictureStudio(cdp, { visible: true, text: "safe path limit" });
  assert.equal(vectorError.hasAlert, true, "vector failures use an accessible alert");

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:vectorPreview",
    jobId: pictureJobId,
    revision: 4,
    previewUri: vectorPreviewUri,
    metrics: {
      rawByteSize: 4096,
      optimizedByteSize: 2048,
      pathCount: 42,
      groupCount: 0,
      tinyPathCount: 2,
      missingLayers: ["avatar/root"],
      warnings: []
    }
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Save as avatar", vectorImageSrc: vectorPreviewUri });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:packageProgress",
    jobId: pictureJobId,
    revision: 4,
    stage: "installing",
    message: "Installing the validated avatar atomically.",
    progress: 0.62
  });
  await waitForPictureStudio(cdp, { visible: true, text: "Installing the validated avatar" });
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:packageCollision",
    jobId: pictureJobId,
    revision: 4,
    id: "avatar-source",
    suggestedCopyId: "avatar-source-2"
  });
  const collision = await waitForPictureStudio(cdp, { visible: true, text: "avatar-source-2" });
  assert.match(collision.text, /Replace.*Create Copy/s, "collision offers replace and copy choices");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:packageError",
    jobId: pictureJobId,
    revision: 4,
    code: "validation-failed",
    message: "The staged package did not pass validation.",
    recoverable: true
  });
  const packageError = await waitForPictureStudio(cdp, { visible: true, text: "did not pass validation" });
  assert.equal(packageError.hasAlert, true, "package failures use an accessible alert");
  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:packageSaved",
    jobId: pictureJobId,
    revision: 4,
    avatar: { id: "avatar-source", name: "Avatar Source", replacedExisting: false }
  });
  await waitForPictureStudio(cdp, { visible: true, text: "saved and active" });
  await waitForPictureStudio(cdp, { visible: true, text: "Copy Path" });

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:imageError",
    code: "workspace-untrusted",
    message: "Trust this workspace before creating an avatar.",
    recoverable: true
  });
  const pictureError = await waitForPictureStudio(cdp, { visible: true, text: "Trust this workspace" });
  assert.equal(pictureError.hasAlert, true, "structured picture errors use an accessible alert");

  await dispatchExtensionMessage(cdp, {
    protocolVersion: 1,
    type: "studio:imageCancelled",
    jobId: pictureJobId,
    reason: "user"
  });
  await waitForPictureStudio(cdp, { visible: false });

  cdp.close();
  console.log(`Webview render smoke passed: ${url}`);
  if (stderr.text.includes("ERR_")) {
    console.warn(stderr.text.trim());
  }
} finally {
  await stopBrowser(browser);
  server.close();
  await removeTempRoot(tempRoot);
}

function listen(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
        return;
      }

      reject(new Error("Unable to determine webview smoke server port."));
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const tcpServer = createTcpServer();
    tcpServer.once("error", reject);
    tcpServer.listen(0, "127.0.0.1", () => {
      const address = tcpServer.address();
      tcpServer.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
          return;
        }

        reject(new Error("Unable to find a free CDP port."));
      });
    });
  });
}

async function waitForPageTarget(debugPort, expectedUrl) {
  const endpoint = `http://127.0.0.1:${debugPort}/json`;
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.url === expectedUrl);
      if (target?.webSocketDebuggerUrl) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`Unable to connect to Edge DevTools endpoint: ${lastError?.message ?? endpoint}`);
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== "function") {
      reject(new Error("This Node.js runtime does not provide WebSocket."));
      return;
    }

    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));

          return new Promise((sendResolve, sendReject) => {
            pending.set(id, { reject: sendReject, resolve: sendResolve });
          });
        },
        close() {
          socket.close();
        }
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      const request = pending.get(message.id);
      if (!request) {
        return;
      }

      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    });

    socket.addEventListener("error", () => reject(new Error("Unable to connect to Edge DevTools WebSocket.")));
  });
}

async function evaluateRenderedWebview(cdp) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `(() => new Promise(resolve => {
          const deadline = Date.now() + 5000;
          const tick = () => {
            const panel = document.querySelector(".avatar-panel");
            const stage = document.querySelector(".avatar-stage");
            const assistantBubble = document.querySelector(".assistant-bubble");
            if ((panel && stage && assistantBubble) || Date.now() > deadline) {
              resolve({
                hasPanel: Boolean(panel),
                hasStage: Boolean(stage),
                html: document.body.innerHTML,
                text: document.body.textContent || ""
              });
              return;
            }

            setTimeout(tick, 50);
          };
          tick();
        }))()`
      });

      return result.result.value;
    } catch (error) {
      lastError = error;
      if (!/Execution context was destroyed/i.test(error.message)) {
        throw error;
      }

      await delay(300);
    }
  }

  throw lastError;
}

async function applyVisualEnvironment(cdp) {
  const viewport = process.env.SMOKE_VIEWPORT;
  if (viewport) {
    const match = /^(\d{3,4})x(\d{3,4})$/i.exec(viewport.trim());
    if (!match) {
      throw new Error("SMOKE_VIEWPORT must use WIDTHxHEIGHT, for example 360x900.");
    }

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 280 || width > 2_560 || height < 480 || height > 2_560) {
      throw new Error("SMOKE_VIEWPORT must stay between 280x480 and 2560x2560.");
    }

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  const theme = process.env.SMOKE_THEME?.trim().toLowerCase();
  if (!theme) {
    return;
  }
  if (!new Set(["dark", "light", "high-contrast"]).has(theme)) {
    throw new Error("SMOKE_THEME must be dark, light, or high-contrast.");
  }

  await cdp
    .send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        { name: "prefers-color-scheme", value: theme === "light" ? "light" : "dark" },
        { name: "forced-colors", value: theme === "high-contrast" ? "active" : "none" }
      ]
    })
    .catch(() => undefined);

  const tokens =
    theme === "light"
      ? {
          "--vscode-sideBar-background": "#f6f8fa",
          "--vscode-editor-background": "#ffffff",
          "--vscode-sideBar-foreground": "#24292f",
          "--vscode-descriptionForeground": "#57606a",
          "--vscode-sideBar-border": "#d0d7de",
          "--vscode-focusBorder": "#0969da",
          "--vscode-button-background": "#0969da",
          "--vscode-button-hoverBackground": "#0860ca",
          "--vscode-button-foreground": "#ffffff"
        }
      : theme === "high-contrast"
        ? {
            "--vscode-sideBar-background": "#000000",
            "--vscode-editor-background": "#000000",
            "--vscode-sideBar-foreground": "#ffffff",
            "--vscode-descriptionForeground": "#ffffff",
            "--vscode-sideBar-border": "#ffffff",
            "--vscode-focusBorder": "#00ffff",
            "--vscode-button-background": "#000000",
            "--vscode-button-hoverBackground": "#1a1a1a",
            "--vscode-button-foreground": "#ffffff"
          }
        : {
            "--vscode-sideBar-background": "#111318",
            "--vscode-editor-background": "#181b22",
            "--vscode-sideBar-foreground": "#d7dde8",
            "--vscode-descriptionForeground": "#9aa6b5",
            "--vscode-sideBar-border": "#303640",
            "--vscode-focusBorder": "#58a6ff",
            "--vscode-button-background": "#0e639c",
            "--vscode-button-hoverBackground": "#1177bb",
            "--vscode-button-foreground": "#ffffff"
          };

  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const tokens = ${JSON.stringify(tokens)};
      document.documentElement.dataset.smokeTheme = ${JSON.stringify(theme)};
      document.documentElement.style.colorScheme = ${JSON.stringify(theme === "light" ? "light" : "dark")};
      for (const [name, value] of Object.entries(tokens)) {
        document.documentElement.style.setProperty(name, value);
      }
    })()`
  });
  if (process.env.SMOKE_REDUCED_MOTION === "1") {
    await cdp.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [{ name: "prefers-reduced-motion", value: "reduce" }]
    });
    await delay(50);
  }
}

async function captureSmokeScreenshot(cdp) {
  if (!process.env.SMOKE_SCREENSHOT) {
    return;
  }

  const screenshotPath = path.resolve(root, process.env.SMOKE_SCREENSHOT);
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  console.log(`Webview screenshot written: ${path.relative(root, screenshotPath)}`);
}

async function pressKey(cdp, key, code) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

async function activeElementText(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: "document.activeElement?.textContent?.trim() ?? ''",
    returnByValue: true
  });
  return result.result?.value ?? "";
}

async function dispatchExtensionMessage(cdp, message) {
  await cdp.send("Runtime.evaluate", {
    expression: `window.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(message)} }))`
  });
}

function createManifestMessage(id, entrypoints, assets) {
  return {
    protocolVersion: 1,
    type: "assets:manifestLoaded",
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version: "1.0.0",
      author: "Smoke Test",
      license: "UNLICENSED",
      preferredRuntime: "svg",
      fallbackRuntime: "svg",
      entrypoints,
      capabilities: ["state-animation", "reduced-motion"],
      states: { idle: "idle_loop", thinking: "thinking_loop" },
      ...(assets ? { assets } : {})
    }
  };
}

async function waitForSvgRenderer(cdp, expected) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(expected)};
      const deadline = Date.now() + 5000;
      const tick = () => {
        const shell = document.querySelector(".avatar-shell");
        const image = shell?.querySelector(".avatar-svg-asset");
        const builtIn = shell?.querySelector(".avatar-svg-builtin");
        const snapshot = {
          source: shell?.getAttribute("data-avatar-source") || "",
          state: shell?.getAttribute("data-avatar-state") || "",
          hasImage: Boolean(image),
          imageSrc: image?.src || "",
          imageComplete: image?.complete ?? false,
          naturalWidth: image?.naturalWidth ?? 0,
          hasBuiltIn: Boolean(builtIn),
          animationName: image ? getComputedStyle(image).animationName : ""
        };
        const matches = snapshot.source === expected.source
          && (expected.state === undefined || snapshot.state === expected.state)
          && (expected.hasImage === undefined || snapshot.hasImage === expected.hasImage)
          && (expected.imageSrc === undefined || snapshot.imageSrc === expected.imageSrc)
          && (!expected.hasImage || (snapshot.imageComplete && snapshot.naturalWidth > 0));
        if (matches) {
          resolve(snapshot);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for SVG renderer: " + JSON.stringify({ expected, snapshot })));
          return;
        }
        setTimeout(tick, 40);
      };
      tick();
    }))()`
  });

  return result.result.value;
}

async function waitForLayeredMascot(cdp, expected) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(expected)};
      const deadline = Date.now() + 5000;
      const tick = () => {
        const shell = document.querySelector('.layered-mascot-shell');
        const mouth = shell?.querySelector('.mascot-mouth-open');
        const success = shell?.querySelector('.mascot-success-effect');
        const error = shell?.querySelector('.mascot-error-effect');
        const body = shell?.querySelector('.mascot-body-rig');
        const snapshot = {
          source: shell?.getAttribute('data-avatar-source') || '',
          state: shell?.getAttribute('data-avatar-state') || '',
          trigger: shell?.getAttribute('data-trigger') || '',
          namedLayerCount: shell?.querySelectorAll('[data-layer]').length ?? 0,
          hasStaticImage: Boolean(shell?.querySelector('img')),
          mouthOpen: mouth ? getComputedStyle(mouth).display !== 'none' : false,
          mouthAnimation: mouth ? getComputedStyle(mouth).animationName : 'none',
          successVisible: success ? Number(getComputedStyle(success).opacity) > 0 : false,
          errorVisible: error ? Number(getComputedStyle(error).opacity) > 0 : false,
          bodyAnimation: body ? getComputedStyle(body).animationName : 'none',
          lookX: shell?.style.getPropertyValue('--mascot-look-x') || '',
          lookY: shell?.style.getPropertyValue('--mascot-look-y') || ''
        };
        const matches = snapshot.source === 'layered-mascot'
          && snapshot.state === expected.state
          && (expected.trigger === undefined || snapshot.trigger === expected.trigger)
          && (expected.mouthOpen === undefined || snapshot.mouthOpen === expected.mouthOpen)
          && (expected.successVisible === undefined || snapshot.successVisible === expected.successVisible)
          && (expected.errorVisible === undefined || snapshot.errorVisible === expected.errorVisible)
          && (expected.lookX === undefined || snapshot.lookX === expected.lookX);
        if (matches) {
          resolve(snapshot);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error('Timed out waiting for layered mascot: ' + JSON.stringify({ expected, snapshot })));
          return;
        }
        setTimeout(tick, 40);
      };
      tick();
    }))()`
  });

  return result.result.value;
}

async function waitForPictureStudio(cdp, expected) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(expected)};
      const deadline = Date.now() + 5000;
      const tick = () => {
        const panel = document.querySelector(".picture-studio-panel");
        const image = panel?.querySelector(".picture-source-preview img");
        const vectorImage = panel?.querySelector(".vector-output-preview img");
        const snapshot = {
          visible: Boolean(panel),
          text: panel?.textContent || "",
          imageSrc: image?.src || "",
          imageComplete: image?.complete ?? false,
          naturalWidth: image?.naturalWidth ?? 0,
          vectorImageSrc: vectorImage?.src || "",
          vectorImageComplete: vectorImage?.complete ?? false,
          vectorNaturalWidth: vectorImage?.naturalWidth ?? 0,
          hasAlert: Boolean(panel?.querySelector('[role="alert"]'))
        };
        const matches = snapshot.visible === expected.visible
          && (expected.text === undefined || snapshot.text.includes(expected.text))
          && (expected.imageSrc === undefined || (
            snapshot.imageSrc === expected.imageSrc && snapshot.imageComplete && snapshot.naturalWidth > 0
          ))
          && (expected.vectorImageSrc === undefined || (
            snapshot.vectorImageSrc === expected.vectorImageSrc
              && snapshot.vectorImageComplete
              && snapshot.vectorNaturalWidth > 0
          ));
        if (matches) {
          resolve(snapshot);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for Picture Studio: " + JSON.stringify({ expected, snapshot })));
          return;
        }
        setTimeout(tick, 40);
      };
      tick();
    }))()`
  });

  return result.result.value;
}

async function waitForAvatarLibrary(cdp, expected) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(expected)};
      const deadline = Date.now() + 5000;
      const tick = () => {
        const panel = document.querySelector('.avatar-library-panel');
        const selector = panel?.querySelector('select');
        const text = panel?.textContent || "";
        const snapshot = {
          visible: Boolean(panel),
          text,
          selectedId: selector?.value || "",
          hasRawUri: /vscode-(?:resource|webview):|https?:\\/\\/|[A-Za-z]:\\\\/.test(text)
        };
        const matches = snapshot.visible
          && (expected.text === undefined || snapshot.text.includes(expected.text))
          && (expected.selectedId === undefined || snapshot.selectedId === expected.selectedId);
        if (matches) {
          resolve(snapshot);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for avatar library: " + JSON.stringify({ expected, snapshot })));
          return;
        }
        setTimeout(tick, 40);
      };
      tick();
    }))()`
  });

  return result.result.value;
}

async function waitForBlenderTools(cdp, expected) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(expected)};
      const deadline = Date.now() + 5000;
      const tick = () => {
        const panel = document.querySelector('.blender-tools-panel');
        const text = panel?.textContent || "";
        const executablePath = panel?.querySelector('.blender-executable-path')?.textContent?.trim() || "";
        const snapshot = { visible: Boolean(panel), text, executablePath };
        const matches = snapshot.visible === expected.visible
          && (expected.text === undefined || snapshot.text.includes(expected.text))
          && (expected.executablePath === undefined || snapshot.executablePath === expected.executablePath);
        if (matches) {
          resolve(snapshot);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for Blender Tools: " + JSON.stringify({ expected, snapshot })));
          return;
        }
        setTimeout(tick, 40);
      };
      tick();
    }))()`
  });

  return result.result.value;
}

async function clickButton(cdp, containerSelector, label) {
  const buttonSelector = `${containerSelector} button`;
  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const button = [...document.querySelectorAll(${JSON.stringify(buttonSelector)})]
        .find(candidate => candidate.textContent?.trim() === ${JSON.stringify(label)});
      button?.click();
      return Boolean(button);
    })()`
  });
  assert.equal(result.result.value, true, `Button exists: ${label}`);
}

async function clickPictureStudioButton(cdp, label) {
  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const button = [...document.querySelectorAll(".picture-studio-panel button")]
        .find(candidate => candidate.textContent?.trim() === ${JSON.stringify(label)});
      button?.click();
      return Boolean(button);
    })()`
  });
  assert.equal(result.result.value, true, `Picture Studio button exists: ${label}`);
}

function captureStream(stream) {
  const captured = { text: "" };
  stream?.on("data", (chunk) => {
    captured.text += chunk.toString();
  });
  return captured;
}

async function stopBrowser(child) {
  if (!child) {
    return;
  }

  if (child.exitCode === null && !child.killed) {
    child.kill();
  }

  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
}

async function removeTempRoot(directory) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(directory, { force: true, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  if (process.env.SMOKE_DEBUG_CLEANUP === "1") {
    console.warn(`Unable to remove temporary webview smoke profile: ${lastError.message}`);
  }
}

async function cleanupOldSmokeProfiles() {
  const entries = await readdir(os.tmpdir(), { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(smokeProfilePrefix))
      .map((entry) => removeTempRoot(path.join(os.tmpdir(), entry.name)))
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findEdgeExecutable() {
  const candidates = [
    process.env.EDGE_BIN,
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe")
  ].filter(Boolean);

  return candidates.find((candidate) => {
    try {
      return statSyncFile(candidate);
    } catch {
      return false;
    }
  });
}

function statSyncFile(filePath) {
  return statSync(filePath).isFile();
}

function getContentType(filePath) {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isInsideDirectory(parent, child) {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
