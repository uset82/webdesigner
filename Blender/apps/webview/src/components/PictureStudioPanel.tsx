import { useRef, useState } from "react";
import type { GeneratedAvatarMetadata, VectorizeStudioOptions } from "../bridge/messages";
import { postToExtension } from "../bridge/vscodeApi";
import type {
  PackageSaveState,
  BlenderHandoffStatus,
  PictureSelection,
  PictureStudioState,
  VectorizationState
} from "../bridge/useExtensionBridge";

type PictureStudioPanelProps = {
  studio: PictureStudioState;
};

const vectorPresets: Record<VectorizeStudioOptions["preset"], VectorizeStudioOptions> = {
  "color-illustration": {
    preset: "color-illustration",
    grayscale: false,
    colorCount: 16,
    threshold: null,
    removeNearWhite: true,
    noiseReduction: 10,
    detail: "balanced"
  },
  "clean-icon": {
    preset: "clean-icon",
    grayscale: false,
    colorCount: 8,
    threshold: null,
    removeNearWhite: true,
    noiseReduction: 30,
    detail: "balanced"
  },
  "high-contrast-silhouette": {
    preset: "high-contrast-silhouette",
    grayscale: true,
    colorCount: 2,
    threshold: 128,
    removeNearWhite: true,
    noiseReduction: 35,
    detail: "low"
  }
};

export function PictureStudioPanel({ studio }: PictureStudioPanelProps) {
  const [step, setStep] = useState<"source" | "vector">("source");
  const [options, setOptions] = useState<VectorizeStudioOptions>({ ...vectorPresets["color-illustration"] });
  const revision = useRef(0);

  if (studio.status === "idle") return null;

  if (studio.status === "working") {
    return (
      <section className="picture-studio-panel" aria-label="Create avatar from picture">
        <StudioHeading badge={labelForStage(studio.stage)} />
        <p className="studio-progress-message" role="status">
          {studio.message ?? "Preparing picture."}
        </p>
        <progress className="studio-progress" max={1} value={studio.progress ?? 0} />
        <div className="picture-studio-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => postToExtension({ type: "studio:cancelImageJob" })}
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (studio.status === "error") {
    return (
      <section className="picture-studio-panel" aria-label="Create avatar from picture">
        <StudioHeading badge="Needs attention" tone="error" />
        <div className="studio-error" role="alert">
          <strong>{errorTitle(studio.error?.code)}</strong>
          <span>{studio.error?.message ?? "The picture could not be prepared."}</span>
        </div>
        <div className="picture-studio-actions">
          {studio.error?.recoverable ? (
            <button type="button" onClick={() => postToExtension({ type: "studio:chooseImage" })}>
              Try another picture
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              postToExtension({
                type: "studio:cancelImageJob",
                ...(studio.selection ? { jobId: studio.selection.jobId } : {})
              })
            }
          >
            Close
          </button>
        </div>
      </section>
    );
  }

  const selection = studio.selection;
  if (!selection) return null;

  const startVectorization = () => {
    revision.current += 1;
    postToExtension({
      type: "studio:vectorizeImage",
      jobId: selection.jobId,
      revision: revision.current,
      options
    });
  };
  const continueToVector = () => {
    setStep("vector");
    startVectorization();
  };

  return (
    <section className="picture-studio-panel" aria-label="Create avatar from picture" data-step={step}>
      <StudioHeading
        badge={step === "source" ? "Source preview" : studioBadge(studio.vectorization, studio.packageSave)}
      />
      {step === "source" ? (
        <SourceReview selection={selection} onContinue={continueToVector} />
      ) : (
        <VectorWorkspace
          selection={selection}
          options={options}
          setOptions={setOptions}
          vectorization={studio.vectorization}
          packageSave={studio.packageSave}
          blenderHandoff={studio.blenderHandoff}
          onGenerate={startVectorization}
          onBack={() => setStep("source")}
        />
      )}
    </section>
  );
}

function SourceReview({ selection, onContinue }: { selection: PictureSelection; onContinue: () => void }) {
  return (
    <>
      <div className="picture-source-layout">
        <SourceFigure selection={selection} />
        <dl className="picture-source-meta">
          <div>
            <dt>File</dt>
            <dd title={selection.fileName}>{selection.fileName}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>
              {selection.width} × {selection.height}
            </dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{formatBytes(selection.fileSize)}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{selection.format.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>{alphaLabel(selection.hasAlpha)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{selection.sourceKind === "external" ? "Copied locally for preview" : "Workspace picture"}</dd>
          </div>
        </dl>
      </div>
      <p className="studio-help">Review the picture before choosing SVG conversion settings.</p>
      <div className="picture-studio-actions">
        <button type="button" onClick={onContinue}>
          Continue
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => postToExtension({ type: "studio:chooseImage" })}
        >
          Choose different
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => postToExtension({ type: "studio:cancelImageJob", jobId: selection.jobId })}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

type VectorWorkspaceProps = {
  selection: PictureSelection;
  options: VectorizeStudioOptions;
  setOptions: (options: VectorizeStudioOptions) => void;
  vectorization: VectorizationState;
  packageSave: PackageSaveState;
  blenderHandoff?: BlenderHandoffStatus | undefined;
  onGenerate: () => void;
  onBack: () => void;
};

export function VectorWorkspace({
  selection,
  options,
  setOptions,
  vectorization,
  packageSave,
  blenderHandoff,
  onGenerate,
  onBack
}: VectorWorkspaceProps) {
  const isWorking = vectorization.status === "working";
  const packageWorking = packageSave.status === "working";
  const locked = isWorking || packageWorking;
  const preview = vectorization.status === "ready" ? vectorization.preview : null;
  const [metadata, setMetadata] = useState<GeneratedAvatarMetadata>(() => defaultGeneratedMetadata(selection.fileName));

  if (packageSave.status === "success") {
    return (
      <>
        <PackageSuccess packageSave={packageSave} />
        {preview ? <BlenderHandoffPanel selection={selection} preview={preview} status={blenderHandoff} /> : null}
      </>
    );
  }

  return (
    <>
      <div className="vector-preview-grid" aria-live="polite">
        <div>
          <span className="preview-label">Source</span>
          <SourceFigure selection={selection} />
        </div>
        <div>
          <span className="preview-label">Optimized SVG</span>
          <figure className="picture-source-preview vector-output-preview">
            {preview ? (
              <img src={preview.previewUri} alt={`Optimized SVG preview for ${selection.fileName}`} />
            ) : isWorking ? (
              <div className="vector-preview-placeholder" role="status">
                <span>{vectorization.message}</span>
                <progress className="studio-progress" max={1} value={vectorization.progress} />
              </div>
            ) : (
              <div className="vector-preview-placeholder">Generate a preview to compare the traced SVG.</div>
            )}
          </figure>
        </div>
      </div>

      <fieldset className="vector-controls" disabled={locked}>
        <legend>SVG style</legend>
        <label>
          Preset
          <select
            value={options.preset}
            onChange={(event) =>
              setOptions({ ...vectorPresets[event.currentTarget.value as VectorizeStudioOptions["preset"]] })
            }
          >
            <option value="color-illustration">Color Illustration</option>
            <option value="clean-icon">Clean Icon</option>
            <option value="high-contrast-silhouette">High-Contrast Silhouette</option>
          </select>
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={options.grayscale}
            onChange={(event) => setOptions({ ...options, grayscale: event.currentTarget.checked })}
          />
          Grayscale
        </label>
        <label>
          Colors
          <select
            value={options.colorCount}
            disabled={options.grayscale}
            onChange={(event) =>
              setOptions({ ...options, colorCount: Number(event.currentTarget.value) as 2 | 4 | 8 | 16 })
            }
          >
            {[2, 4, 8, 16].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={options.threshold !== null}
            onChange={(event) => setOptions({ ...options, threshold: event.currentTarget.checked ? 128 : null })}
          />
          High-contrast threshold
        </label>
        <label>
          Threshold {options.threshold ?? "off"}
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            disabled={options.threshold === null}
            value={options.threshold ?? 128}
            onChange={(event) => setOptions({ ...options, threshold: Number(event.currentTarget.value) })}
          />
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={options.removeNearWhite}
            onChange={(event) => setOptions({ ...options, removeNearWhite: event.currentTarget.checked })}
          />
          Remove near-white background
        </label>
        <label>
          Noise cleanup {options.noiseReduction}%
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={options.noiseReduction}
            onChange={(event) => setOptions({ ...options, noiseReduction: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          Detail
          <select
            value={options.detail}
            onChange={(event) =>
              setOptions({ ...options, detail: event.currentTarget.value as VectorizeStudioOptions["detail"] })
            }
          >
            <option value="low">Low · fewer paths</option>
            <option value="balanced">Balanced</option>
            <option value="high">High · more paths</option>
          </select>
        </label>
      </fieldset>

      {vectorization.status === "idle" && vectorization.message ? (
        <p className="studio-ready-message" role="status">
          {vectorization.message}
        </p>
      ) : null}
      {vectorization.status === "error" ? (
        <div className="studio-error" role="alert">
          <strong>SVG preview failed</strong>
          <span>{vectorization.message}</span>
        </div>
      ) : null}
      {preview ? <VectorMetrics preview={preview} /> : null}
      {preview ? <BlenderHandoffPanel selection={selection} preview={preview} status={blenderHandoff} /> : null}
      {preview ? (
        <PackageForm
          metadata={metadata}
          setMetadata={setMetadata}
          packageSave={packageSave}
          onSave={(collisionAction) =>
            postToExtension({
              type: "studio:saveAvatar",
              jobId: selection.jobId,
              revision: preview.revision,
              metadata,
              collisionAction
            })
          }
        />
      ) : null}

      <div className="picture-studio-actions">
        {isWorking ? (
          <button
            type="button"
            onClick={() =>
              postToExtension({
                type: "studio:cancelVectorization",
                jobId: selection.jobId,
                revision: vectorization.revision
              })
            }
          >
            Cancel conversion
          </button>
        ) : (
          <button type="button" disabled={packageWorking} onClick={onGenerate}>
            {preview ? "Update SVG Preview" : "Generate SVG Preview"}
          </button>
        )}
        <button type="button" className="secondary-button" disabled={locked} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={locked}
          onClick={() => postToExtension({ type: "studio:chooseImage" })}
        >
          Choose different
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={packageWorking}
          onClick={() => postToExtension({ type: "studio:cancelImageJob", jobId: selection.jobId })}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function BlenderHandoffPanel({
  selection,
  preview,
  status
}: {
  selection: PictureSelection;
  preview: Extract<VectorizationState, { status: "ready" }>["preview"];
  status?: BlenderHandoffStatus | undefined;
}) {
  const working = status?.tone === "working";
  const succeeded = status?.tone === "success";
  return (
    <section className="blender-handoff-panel" aria-label="Create Blender scene from SVG">
      <div className="picture-studio-heading">
        <span className="section-label">Continue in Blender</span>
        <span className="studio-status-badge">Optional</span>
      </div>
      <p className="studio-help">
        Import this sanitized SVG as editable curves in a new local scene. Curves are a starting point—not an automatic
        rig or production 3D character.
      </p>
      <div className="picture-studio-actions">
        <button
          type="button"
          disabled={working}
          onClick={() =>
            postToExtension({
              type: "blender:createSceneFromSvg",
              jobId: selection.jobId,
              revision: preview.revision
            })
          }
        >
          {working ? "Creating Blender Scene…" : "Create Blender Scene from SVG"}
        </button>
        {succeeded ? (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={() => postToExtension({ type: "blender:openOutput" })}
            >
              Open Scene Folder
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => postToExtension({ type: "command:exportBlender" })}
            >
              Export Blender Scene
            </button>
          </>
        ) : null}
      </div>
      {status ? (
        <p className="studio-ready-message" data-tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
          {status.message}
          {status.sceneFileName ? ` ${status.sceneFileName}` : ""}
        </p>
      ) : null}
    </section>
  );
}

function VectorMetrics({ preview }: { preview: Extract<VectorizationState, { status: "ready" }>["preview"] }) {
  const { metrics } = preview;
  return (
    <section className="vector-metrics" aria-label="SVG preview details">
      <dl>
        <div>
          <dt>Optimized size</dt>
          <dd>{formatBytes(metrics.optimizedByteSize)}</dd>
        </div>
        <div>
          <dt>Paths</dt>
          <dd>{metrics.pathCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Groups</dt>
          <dd>{metrics.groupCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Raw → optimized</dt>
          <dd>
            {formatBytes(metrics.rawByteSize)} → {formatBytes(metrics.optimizedByteSize)}
          </dd>
        </div>
      </dl>
      {metrics.missingLayers.length > 0 ? (
        <p className="studio-help">
          Static SVG is ready. Optional animation layers are not present: {metrics.missingLayers.join(", ")}.
        </p>
      ) : null}
      {metrics.warnings.length > 0 ? (
        <details>
          <summary>{metrics.warnings.length} conversion note(s)</summary>
          <ul>
            {metrics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function PackageForm({
  metadata,
  setMetadata,
  packageSave,
  onSave
}: {
  metadata: GeneratedAvatarMetadata;
  setMetadata: (metadata: GeneratedAvatarMetadata) => void;
  packageSave: PackageSaveState;
  onSave: (collisionAction: "reject" | "replace" | "copy") => void;
}) {
  const isWorking = packageSave.status === "working";
  const valid = isGeneratedMetadataComplete(metadata);

  return (
    <section className="package-save-panel" aria-label="Save generated avatar">
      <div className="picture-studio-heading">
        <span className="section-label">Save as avatar</span>
        <span className="studio-status-badge">Local package</span>
      </div>
      <fieldset className="avatar-metadata-controls" disabled={isWorking}>
        <legend>Avatar details</legend>
        <label>
          Name
          <input
            type="text"
            maxLength={160}
            value={metadata.name}
            onChange={(event) => setMetadata({ ...metadata, name: event.currentTarget.value })}
          />
        </label>
        <label>
          ID
          <input
            type="text"
            maxLength={80}
            aria-describedby="avatar-id-help"
            value={metadata.id}
            onChange={(event) => setMetadata({ ...metadata, id: normalizeAvatarIdInput(event.currentTarget.value) })}
          />
        </label>
        <label>
          Author
          <input
            type="text"
            maxLength={160}
            value={metadata.author}
            onChange={(event) => setMetadata({ ...metadata, author: event.currentTarget.value })}
          />
        </label>
        <label>
          Version
          <input
            type="text"
            maxLength={80}
            value={metadata.version}
            onChange={(event) => setMetadata({ ...metadata, version: event.currentTarget.value })}
          />
        </label>
        <label className="metadata-license-control">
          License / rights statement
          <input
            type="text"
            maxLength={160}
            placeholder="Enter the license or rights status"
            value={metadata.license}
            onChange={(event) => setMetadata({ ...metadata, license: event.currentTarget.value })}
          />
        </label>
      </fieldset>
      <p id="avatar-id-help" className="studio-help">
        The ID uses lowercase letters, numbers, dots, underscores, or hyphens. Confirm that you have the right to use
        the picture and enter its real license or rights status; the Studio will not invent one.
      </p>

      {packageSave.status === "working" ? (
        <div className="package-progress" role="status">
          <span>{packageSave.message}</span>
          <progress className="studio-progress" max={1} value={packageSave.progress} />
        </div>
      ) : null}
      {packageSave.status === "error" ? (
        <div className="studio-error" role="alert">
          <strong>Avatar was not saved</strong>
          <span>{packageSave.message}</span>
        </div>
      ) : null}
      {packageSave.status === "collision" ? (
        <div className="package-collision" role="alert">
          <strong>An avatar named “{packageSave.id}” already exists.</strong>
          <span>Replace it, or keep both by creating “{packageSave.suggestedCopyId}”.</span>
          <div className="picture-studio-actions">
            <button type="button" onClick={() => onSave("replace")}>
              Replace
            </button>
            <button type="button" className="secondary-button" onClick={() => onSave("copy")}>
              Create Copy
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => postToExtension({ type: "studio:cancelImageJob" })}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="picture-studio-actions">
          <button type="button" disabled={!valid || isWorking} onClick={() => onSave("reject")}>
            Save &amp; Use
          </button>
        </div>
      )}
    </section>
  );
}

function PackageSuccess({ packageSave }: { packageSave: Extract<PackageSaveState, { status: "success" }> }) {
  return (
    <section className="package-success" role="status">
      <span className="studio-status-badge">Active SVG avatar</span>
      <strong>{packageSave.avatar.name} is saved and active.</strong>
      <span>The package was validated, registered, loaded, and will remain selected after reload.</span>
      <div className="picture-studio-actions">
        <button
          type="button"
          onClick={() => postToExtension({ type: "studio:revealAvatar", id: packageSave.avatar.id })}
        >
          Open Folder
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => postToExtension({ type: "studio:copyAvatarPath", id: packageSave.avatar.id })}
        >
          Copy Path
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => postToExtension({ type: "studio:chooseImage" })}
        >
          Create another
        </button>
      </div>
    </section>
  );
}

function defaultGeneratedMetadata(fileName: string): GeneratedAvatarMetadata {
  const rawName = fileName.replace(/\.[^.]+$/, "").trim() || "My Avatar";
  const name = rawName.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
  return {
    id: normalizeAvatarIdInput(rawName) || "my-avatar",
    name,
    author: "",
    version: "1.0.0",
    license: ""
  };
}

function normalizeAvatarIdInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .slice(0, 80);
}

function isGeneratedMetadataComplete(metadata: GeneratedAvatarMetadata): boolean {
  return (
    /^[a-z0-9][a-z0-9._-]{0,79}$/.test(metadata.id) &&
    metadata.name.trim().length > 0 &&
    metadata.author.trim().length > 0 &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(metadata.version.trim()) &&
    metadata.license.trim().length > 0
  );
}

function SourceFigure({ selection }: { selection: PictureSelection }) {
  return (
    <figure className="picture-source-preview">
      <img src={selection.previewUri} alt={`Selected source: ${selection.fileName}`} />
    </figure>
  );
}

function StudioHeading({ badge, tone }: { badge: string; tone?: "error" }) {
  return (
    <div className="picture-studio-heading">
      <span className="section-label">Create from Picture</span>
      <span className="studio-status-badge" {...(tone ? { "data-tone": tone } : {})}>
        {badge}
      </span>
    </div>
  );
}

function studioBadge(vectorization: VectorizationState, packageSave: PackageSaveState): string {
  if (packageSave.status === "working") return "Saving";
  if (packageSave.status === "collision") return "Name conflict";
  if (packageSave.status === "success") return "Active";
  if (packageSave.status === "error") return "Save failed";
  if (vectorization.status === "working") return "Converting";
  if (vectorization.status === "ready") return "SVG preview ready";
  if (vectorization.status === "error") return "Needs attention";
  return "SVG style";
}

function labelForStage(stage: PictureStudioState["stage"]): string {
  switch (stage) {
    case "selecting":
      return "Selecting";
    case "validating":
      return "Checking";
    case "copying":
      return "Preparing";
    default:
      return "Working";
  }
}

function errorTitle(code: NonNullable<PictureStudioState["error"]>["code"] | undefined): string {
  switch (code) {
    case "workspace-required":
      return "Open a workspace";
    case "workspace-untrusted":
      return "Trust this workspace";
    case "unsupported-format":
      return "Unsupported picture format";
    case "invalid-image":
      return "Invalid picture";
    case "busy":
      return "Picture job already running";
    default:
      return "Picture preview failed";
  }
}

function alphaLabel(hasAlpha: boolean | null): string {
  if (hasAlpha === true) return "Transparency detected";
  if (hasAlpha === false) return "Opaque";
  return "Unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
