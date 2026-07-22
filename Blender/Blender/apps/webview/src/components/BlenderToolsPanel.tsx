import { useEffect, useMemo, useState } from "react";
import type { GeneratedAvatarMetadata } from "../bridge/messages";
import type { BlenderToolsState } from "../bridge/useExtensionBridge";
import { postToExtension } from "../bridge/vscodeApi";

type BlenderToolsPanelProps = {
  tools: BlenderToolsState;
  unavailableReason: string | null;
};

export function BlenderToolsPanel({ tools, unavailableReason }: BlenderToolsPanelProps) {
  useEffect(() => {
    postToExtension({ type: "blender:refresh" });
  }, []);

  const { status, operation } = tools;
  const working = status?.busy === true || operation?.tone === "working";
  const workingReason = working ? (operation?.message ?? status?.message ?? "Blender is working.") : null;
  const actionReason = unavailableReason ?? workingReason;
  const testReason = actionReason ?? (!status?.executablePath ? "Choose or detect Blender before testing it." : null);
  const guidance = getSetupGuidance(status);
  const statusPresentation = getStatusPresentation(status, working);
  const exportReady = !actionReason && status?.availability === "ready" && status.support === "supported";

  return (
    <section id="blender-tools-panel" className="blender-tools-panel" aria-labelledby="blender-tools-heading">
      <div className="blender-tools-heading">
        <div>
          <span className="section-kicker">Optional production tool</span>
          <h2 id="blender-tools-heading">Blender Tools</h2>
        </div>
        <span className="blender-connection-badge" data-tone={statusPresentation.tone}>
          {statusPresentation.label}
        </span>
      </div>

      <p className="blender-introduction">
        Connect a local Blender installation for authored scene exports. Picture-to-SVG avatars work without Blender.
      </p>

      {unavailableReason ? (
        <div id="blender-workspace-setup" className="blender-setup" data-tone="warning" role="status">
          <div>
            <strong>
              {unavailableReason.includes("Trust") ? "Workspace trust is required" : "Open a project folder"}
            </strong>
            <p>{unavailableReason}</p>
          </div>
          <button type="button" onClick={() => postToExtension({ type: "library:openWorkspace" })}>
            {unavailableReason.includes("Trust") ? "Manage Trust" : "Open Folder"}
          </button>
        </div>
      ) : guidance ? (
        <div className="blender-setup" data-tone={guidance.tone} role="status">
          <div>
            <strong>{guidance.title}</strong>
            <p>{guidance.message}</p>
          </div>
        </div>
      ) : null}

      <div className="blender-primary-actions">
        <button
          type="button"
          disabled={!exportReady}
          title={
            exportReady ? "Choose a .blend scene and the output modes to create." : "Connect supported Blender first."
          }
          onClick={() => postToExtension({ type: "command:exportBlender" })}
        >
          Export Scene
        </button>
        <button
          type="button"
          disabled={Boolean(actionReason)}
          title={actionReason ?? "Choose the Blender executable on this computer."}
          onClick={() => postToExtension({ type: "blender:browse" })}
        >
          Browse
        </button>
        <button
          type="button"
          disabled={Boolean(actionReason)}
          title={actionReason ?? "Search common local Blender locations."}
          onClick={() => postToExtension({ type: "blender:autoDetect" })}
        >
          Auto-detect
        </button>
        <button
          type="button"
          disabled={Boolean(testReason)}
          title={testReason ?? "Verify that this executable is Blender and report its capabilities."}
          onClick={() => postToExtension({ type: "blender:test" })}
        >
          Test Connection
        </button>
        {working ? (
          <button
            type="button"
            className="secondary-button"
            title="Stop the current Blender check."
            onClick={() => postToExtension({ type: "blender:cancel" })}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {status ? <BlenderConnectionDetails status={status} /> : null}
      {tools.exportResult ? <BlenderExportSummary tools={tools} /> : null}

      <div
        className="blender-status"
        data-tone={operation?.tone ?? statusPresentation.tone}
        role={operation?.tone === "error" || status?.availability === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <span aria-hidden="true" />
        <p>{operation?.message ?? status?.message ?? "Checking your local Blender setup…"}</p>
      </div>

      <div className="blender-utility-actions">
        <button type="button" className="secondary-button" onClick={() => postToExtension({ type: "blender:openLog" })}>
          Open Log
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={Boolean(unavailableReason)}
          title={unavailableReason ?? "Open the local Blender export folder."}
          onClick={() => postToExtension({ type: "blender:openOutput" })}
        >
          Open Output Folder
        </button>
      </div>
    </section>
  );
}

function BlenderExportSummary({ tools }: { tools: BlenderToolsState }) {
  const result = tools.exportResult;
  const save = tools.avatarSave;
  const initialMetadata = useMemo(
    () => defaultBlenderMetadata(result?.sourceFile ?? "blender-avatar.blend"),
    [result?.sourceFile]
  );
  const [metadata, setMetadata] = useState<GeneratedAvatarMetadata>(initialMetadata);

  useEffect(() => {
    if (result?.jobId) setMetadata(initialMetadata);
  }, [initialMetadata, result?.jobId]);
  if (!result) return null;
  const validMetadata =
    /^[a-z0-9][a-z0-9._-]{0,79}$/.test(metadata.id) &&
    metadata.name.trim().length > 0 &&
    metadata.author.trim().length > 0 &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(metadata.version) &&
    metadata.license.trim().length > 0;
  const saving = save?.jobId === result.jobId && save.tone === "working";
  const collision = save?.jobId === result.jobId && save.tone === "warning" && save.suggestedCopyId;
  const hasValidatedGlb = result.results.some((item) => item.mode === "glb" && item.status === "success");

  const saveAvatar = (collisionAction: "reject" | "replace" | "copy") =>
    postToExtension({ type: "blender:saveAvatar", jobId: result.jobId, metadata, collisionAction });

  return (
    <section className="blender-export-summary" aria-label="Latest Blender export">
      <div className="picture-studio-heading">
        <span className="section-label">Latest export</span>
        <span className="studio-status-badge">{result.sourceFile}</span>
      </div>
      <ul className="blender-export-results">
        {result.results.map((item) => (
          <li key={item.mode} data-tone={item.status === "success" ? "success" : "error"}>
            <strong>{item.mode.toUpperCase()}</strong>
            <span>{item.status === "success" ? item.fileName : item.message}</span>
          </li>
        ))}
      </ul>
      {!result.canUseAsAvatar ? (
        <p className="studio-help">
          Valid GLB and PNG files remain available in the output folder. To use this scene as the visible avatar, add
          Grease Pencil line art and export SVG.
        </p>
      ) : (
        <div className="package-save-panel">
          <p className="studio-help">
            {hasValidatedGlb
              ? "The validated GLB will use the optional WebGL runtime. The package SVG remains its required fallback."
              : "The sanitized SVG will become the active avatar. Export a validated GLB to add optional 3D rendering."}
          </p>
          <fieldset className="avatar-metadata-controls" disabled={saving}>
            <legend>Avatar details</legend>
            <label>
              Name
              <input
                value={metadata.name}
                maxLength={160}
                onChange={(event) => setMetadata({ ...metadata, name: event.currentTarget.value })}
              />
            </label>
            <label>
              ID
              <input
                value={metadata.id}
                maxLength={80}
                onChange={(event) => setMetadata({ ...metadata, id: normalizeId(event.currentTarget.value) })}
              />
            </label>
            <label>
              Author
              <input
                value={metadata.author}
                maxLength={160}
                onChange={(event) => setMetadata({ ...metadata, author: event.currentTarget.value })}
              />
            </label>
            <label>
              Version
              <input
                value={metadata.version}
                maxLength={80}
                onChange={(event) => setMetadata({ ...metadata, version: event.currentTarget.value })}
              />
            </label>
            <label className="metadata-license-control">
              License
              <input
                value={metadata.license}
                maxLength={160}
                onChange={(event) => setMetadata({ ...metadata, license: event.currentTarget.value })}
              />
            </label>
          </fieldset>
          <button type="button" disabled={!validMetadata || saving} onClick={() => saveAvatar("reject")}>
            {saving ? "Creating Avatar…" : hasValidatedGlb ? "Use 3D Avatar" : "Use SVG as Avatar"}
          </button>
          {collision ? (
            <div className="package-collision" role="alert">
              <p>{save.message}</p>
              <button type="button" onClick={() => saveAvatar("replace")}>
                Replace Existing
              </button>
              <button type="button" className="secondary-button" onClick={() => saveAvatar("copy")}>
                Save Copy ({save.suggestedCopyId})
              </button>
            </div>
          ) : null}
          {save?.jobId === result.jobId && !collision ? (
            <p className="studio-ready-message" data-tone={save.tone} role={save.tone === "error" ? "alert" : "status"}>
              {save.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function defaultBlenderMetadata(sourceFile: string): GeneratedAvatarMetadata {
  const base = sourceFile.replace(/\.blend$/i, "").trim() || "Blender Avatar";
  return {
    id: normalizeId(base) || "blender-avatar",
    name: base,
    author: "Local creator",
    version: "1.0.0",
    license: "UNLICENSED"
  };
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80);
}

function BlenderConnectionDetails({ status }: { status: NonNullable<BlenderToolsState["status"]> }) {
  const capabilityLabels = status.capabilities.map((capability) => capabilityLabel(capability));

  return (
    <div className="blender-connection-card">
      <dl className="blender-connection-meta">
        <div>
          <dt>Version</dt>
          <dd>{status.version?.label ?? "Not detected"}</dd>
        </div>
        <div>
          <dt>Support</dt>
          <dd>{supportLabel(status.support)}</dd>
        </div>
        <div>
          <dt>Found via</dt>
          <dd>{sourceLabel(status.source)}</dd>
        </div>
        <div className="blender-path-row">
          <dt>Executable</dt>
          <dd className="blender-executable-path" title={status.executablePath ?? undefined}>
            {status.executablePath ?? "No executable selected"}
          </dd>
        </div>
      </dl>

      <div className="blender-capabilities">
        <span>Available exports</span>
        {capabilityLabels.length > 0 ? (
          <ul>
            {capabilityLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : (
          <p>No export modes reported yet.</p>
        )}
      </div>
    </div>
  );
}

type BlenderStatus = BlenderToolsState["status"];

function getStatusPresentation(status: BlenderStatus, working: boolean): { label: string; tone: string } {
  if (working || status?.availability === "checking") return { label: "Checking", tone: "working" };
  if (!status) return { label: "Not checked", tone: "neutral" };

  switch (status.availability) {
    case "ready":
      return status.support === "supported"
        ? { label: "Connected", tone: "success" }
        : { label: "Check support", tone: "warning" };
    case "missing":
      return { label: "Not found", tone: "warning" };
    case "invalid":
      return { label: "Needs setup", tone: "warning" };
    case "unsupported":
      return { label: "Unsupported", tone: "warning" };
    case "error":
      return { label: "Connection issue", tone: "error" };
    default:
      return { label: "Checking", tone: "working" };
  }
}

function getSetupGuidance(status: BlenderStatus): { title: string; message: string; tone: "warning" | "error" } | null {
  if (!status) return null;
  if (status.configuredPathInvalid) {
    return {
      title: "Saved Blender path needs attention",
      message: "Browse to blender.exe, or use Auto-detect to keep searching other local installations.",
      tone: "warning"
    };
  }

  switch (status.availability) {
    case "missing":
      return {
        title: "Blender was not found",
        message: "Install Blender, choose its executable, or try Auto-detect after installation.",
        tone: "warning"
      };
    case "invalid":
      return {
        title: "This file is not a working Blender executable",
        message: "Choose the Blender application itself, then test the connection again.",
        tone: "warning"
      };
    case "unsupported":
      return {
        title: "This Blender version is not supported",
        message: "Install a supported Blender version, then choose or auto-detect the new executable.",
        tone: "warning"
      };
    case "error":
      return {
        title: "Blender could not be checked",
        message: status.message,
        tone: "error"
      };
    default:
      return null;
  }
}

function sourceLabel(source: NonNullable<BlenderStatus>["source"]): string {
  switch (source) {
    case "setting":
      return "Selected in settings";
    case "environment":
      return "BLENDER_PATH";
    case "path":
      return "System PATH";
    case "platform":
      return "Installed application";
    default:
      return "Not detected";
  }
}

function supportLabel(support: NonNullable<BlenderStatus>["support"]): string {
  switch (support) {
    case "supported":
      return "Supported";
    case "unsupported":
      return "Unsupported";
    default:
      return "Not verified";
  }
}

function capabilityLabel(capability: NonNullable<BlenderStatus>["capabilities"][number]): string {
  const labels: Record<typeof capability, string> = {
    svg: "SVG line art",
    glb: "GLB export",
    png: "PNG preview"
  };
  return labels[capability];
}
