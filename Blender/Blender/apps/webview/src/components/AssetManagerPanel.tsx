import { useEffect, useState } from "react";
import type { AvatarLibraryEntry, AvatarLibraryState } from "../bridge/useExtensionBridge";
import { postToExtension } from "../bridge/vscodeApi";

type AssetManagerPanelProps = {
  library: AvatarLibraryState;
};

export function AssetManagerPanel({ library }: AssetManagerPanelProps) {
  const [selectedId, setSelectedId] = useState(
    () => library.avatars.find((avatar) => avatar.active)?.id ?? library.avatars[0]?.id ?? ""
  );
  const [removeConfirmationId, setRemoveConfirmationId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId((current) => {
      if (current && library.avatars.some((avatar) => avatar.id === current)) return current;
      return library.avatars.find((avatar) => avatar.active)?.id ?? library.avatars[0]?.id ?? "";
    });
  }, [library.avatars]);

  const selectedAvatar = library.avatars.find((avatar) => avatar.id === selectedId);
  const setupReason = getSetupReason(library);
  const busyReason = library.status?.tone === "working" ? library.status.message : null;
  const unavailableReason = busyReason ?? setupReason;
  const validation = library.validation?.id === selectedAvatar?.id ? library.validation : null;

  const selectAvatar = (id: string) => {
    setSelectedId(id);
    setRemoveConfirmationId(null);
  };

  const activate = () => {
    if (!selectedAvatar) return;
    postToExtension({ type: "library:activate", id: getExtensionAvatarId(selectedAvatar) });
  };

  const validate = () => {
    if (!selectedAvatar) return;
    postToExtension({ type: "library:validate", id: getExtensionAvatarId(selectedAvatar) });
  };

  const reveal = () => {
    if (!selectedAvatar) return;
    postToExtension({ type: "library:reveal", id: getExtensionAvatarId(selectedAvatar) });
  };

  const exportAvatar = () => {
    if (!selectedAvatar || selectedAvatar.builtIn) return;
    postToExtension({ type: "library:export", id: selectedAvatar.id });
  };

  const confirmRemove = () => {
    if (!selectedAvatar || selectedAvatar.builtIn) return;
    setRemoveConfirmationId(null);
    postToExtension({ type: "library:remove", id: selectedAvatar.id });
  };

  return (
    <section className="asset-manager-panel avatar-library-panel" aria-labelledby="avatar-library-heading">
      <div className="asset-manager-heading avatar-library-heading">
        <div>
          <span className="section-kicker">Your avatars</span>
          <h2 id="avatar-library-heading" className="section-label">
            Avatar library
          </h2>
        </div>
        {library.loaded ? <span className="runtime-badge">{library.avatars.length}</span> : null}
      </div>

      {!library.loaded ? (
        <p className="library-empty" role="status">
          Loading your avatar library…
        </p>
      ) : (
        <>
          {setupReason ? (
            <div className="library-setup" role="status">
              <div>
                <strong>{library.workspaceAvailable ? "Workspace trust is required" : "Open a project folder"}</strong>
                <p>{setupReason}</p>
              </div>
              <button type="button" onClick={() => postToExtension({ type: "library:openWorkspace" })}>
                {library.workspaceAvailable ? "Manage Trust" : "Open Folder"}
              </button>
            </div>
          ) : null}

          {library.avatars.length > 0 ? (
            <>
              <label className="library-selector" htmlFor="avatar-library-select">
                <span>Avatar</span>
                <select
                  id="avatar-library-select"
                  value={selectedId}
                  onChange={(event) => selectAvatar(event.target.value)}
                  aria-describedby="avatar-library-selection-help"
                >
                  {library.avatars.map((avatar) => (
                    <option key={avatar.id} value={avatar.id}>
                      {avatar.name}
                      {avatar.active ? " — Active" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAvatar ? (
                <article className="library-card" aria-label={`${selectedAvatar.name} details`}>
                  <div className="library-card-heading">
                    <div>
                      <h3>{selectedAvatar.name}</h3>
                      <p id="avatar-library-selection-help">By {selectedAvatar.author}</p>
                    </div>
                    <div className="library-badges">
                      {selectedAvatar.active ? <span data-tone="active">Active</span> : null}
                      <span data-tone={selectedAvatar.valid ? "success" : "error"}>
                        {selectedAvatar.valid ? "Ready" : "Needs repair"}
                      </span>
                      {selectedAvatar.valid && selectedAvatar.warningCount > 0 ? (
                        <span data-tone="warning">
                          {selectedAvatar.warningCount} note{selectedAvatar.warningCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {selectedAvatar.builtIn ? <span>Built in</span> : null}
                    </div>
                  </div>

                  <dl className="library-meta">
                    <div>
                      <dt>Style</dt>
                      <dd>{selectedAvatar.runtime.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt>Version</dt>
                      <dd>{selectedAvatar.version}</dd>
                    </div>
                    <div>
                      <dt>License</dt>
                      <dd>{selectedAvatar.license}</dd>
                    </div>
                  </dl>

                  {!selectedAvatar.valid && !validation ? (
                    <p className="library-validation-hint">
                      This avatar has {formatIssueCounts(selectedAvatar)}. Validate it to see what needs attention.
                    </p>
                  ) : null}

                  <div className="asset-actions library-actions">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={Boolean(unavailableReason) || selectedAvatar.active || !selectedAvatar.valid}
                      title={
                        unavailableReason ??
                        (selectedAvatar.active
                          ? "This avatar is already active."
                          : !selectedAvatar.valid
                            ? "Validate and repair this avatar before using it."
                            : undefined)
                      }
                      onClick={activate}
                    >
                      Use Avatar
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(unavailableReason)}
                      title={unavailableReason ?? undefined}
                      onClick={validate}
                    >
                      Validate
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(unavailableReason)}
                      title={unavailableReason ?? undefined}
                      onClick={() => postToExtension({ type: "library:reload" })}
                    >
                      Reload Active
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(unavailableReason)}
                      title={unavailableReason ?? undefined}
                      onClick={reveal}
                    >
                      Open Folder
                    </button>
                    {!selectedAvatar.builtIn ? (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(unavailableReason) || !selectedAvatar.valid}
                          title={
                            unavailableReason ??
                            (!selectedAvatar.valid ? "Validate and repair this avatar before exporting it." : undefined)
                          }
                          onClick={exportAvatar}
                        >
                          Export Avatar
                        </button>
                        <button
                          type="button"
                          className="danger-action"
                          disabled={Boolean(unavailableReason)}
                          title={unavailableReason ?? undefined}
                          onClick={() => setRemoveConfirmationId(selectedAvatar.id)}
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                  </div>

                  {removeConfirmationId === selectedAvatar.id ? (
                    <div className="library-remove-confirmation" role="alert">
                      <p>
                        Remove <strong>{selectedAvatar.name}</strong> from this workspace? This cannot be undone.
                      </p>
                      <div>
                        <button type="button" className="danger-action" onClick={confirmRemove}>
                          Confirm Remove
                        </button>
                        <button type="button" onClick={() => setRemoveConfirmationId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </>
          ) : (
            <div className="library-empty">
              <strong>No avatars yet</strong>
              <p>Create one from a picture or import an avatar package to begin.</p>
            </div>
          )}
        </>
      )}

      {library.status ? (
        <div
          className="library-status"
          data-tone={library.status.tone}
          role={library.status.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <span aria-hidden="true" />
          <p>{library.status.message}</p>
        </div>
      ) : null}

      {validation ? <ValidationResult result={validation} /> : null}
    </section>
  );
}

function ValidationResult({ result }: { result: NonNullable<AvatarLibraryState["validation"]> }) {
  return (
    <div className="library-validation" data-valid={String(result.valid)} aria-live="polite">
      <div className="library-validation-heading">
        <strong>{result.valid ? "Validation passed" : "Validation needs attention"}</strong>
        <span>
          {result.errors.length} error{result.errors.length === 1 ? "" : "s"}, {result.warnings.length} warning
          {result.warnings.length === 1 ? "" : "s"}
        </span>
      </div>
      {result.errors.length > 0 ? (
        <div>
          <span className="validation-list-label">Errors</span>
          <ul>
            {[...new Set(result.errors)].map((message) => (
              <li key={`error-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.warnings.length > 0 ? (
        <div>
          <span className="validation-list-label">Warnings</span>
          <ul>
            {[...new Set(result.warnings)].map((message) => (
              <li key={`warning-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function getExtensionAvatarId(avatar: AvatarLibraryEntry): string | null {
  return avatar.builtIn ? null : avatar.id;
}

function getSetupReason(library: AvatarLibraryState): string | null {
  if (!library.loaded) return null;
  if (!library.workspaceAvailable) {
    return "Avatar packages are stored with a project, so open a folder before managing your library.";
  }
  if (!library.workspaceTrusted) {
    return "Trust this workspace to import, validate, activate, or remove local avatar files.";
  }
  return null;
}

function formatIssueCounts(avatar: AvatarLibraryEntry): string {
  const errors = `${avatar.errorCount} error${avatar.errorCount === 1 ? "" : "s"}`;
  const warnings = `${avatar.warningCount} warning${avatar.warningCount === 1 ? "" : "s"}`;
  return `${errors} and ${warnings}`;
}
