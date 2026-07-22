# User Guide

Codex Avatar Studio is a local VS Code extension. The built-in SVG avatar works without an account, a network connection, Blender, or a GPU runtime. PixiJS is loaded only when the selected avatar provides a Pixi entrypoint; a failed optional runtime returns to SVG.

## Install and open the assistant

1. Install VS Code 1.96 or newer.
2. Install the packaged `codex-avatar-studio-<version>.vsix` from **Extensions → … → Install from VSIX**.
3. Open a trusted workspace.
4. Run `Codex Avatar: Open Assistant`, or open the Codex Avatar view from the Activity Bar.
5. If the panel is not visible, run `Codex Avatar: Toggle Assistant` and then `Codex Avatar: Reload Avatar`.

For a source checkout, use the developer steps in [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) and press `F5` to start an Extension Development Host.

## Create an avatar from a picture

1. Run `Codex Avatar: Create Avatar from Picture` and choose a local PNG, JPG, or JPEG. WebP is not advertised because the packaged decoder does not support it yet.
2. Review the local source preview and continue to SVG Style.
3. Choose Color Illustration, Clean Icon, or High-Contrast Silhouette; adjust the bounded cleanup controls if needed; then generate the SVG preview.
4. Compare source and SVG, and review optimized size, path count, optional animation-layer guidance, and warnings.
5. Enter the avatar name, lowercase id, author, semantic version, and the real license or rights statement for the artwork. The Studio deliberately leaves author and license blank.
6. Select **Save & Use**. If the id exists, choose Replace, Create Copy, or Cancel.

The extension stages and validates a schema-v1 package, verifies SHA-256 checksums, installs it under `.codex-avatar/avatars/<id>/`, activates SVG, and reloads the avatar. Files, registry state, and settings roll back together if activation or reload fails. A successful package remains active after VS Code reload. **Open Folder** and **Copy Path** are available on the completion view.

Picture processing, worker tracing, package creation, and activation stay on the local machine. Cancelled previews remain disposable and never become packages.

### Animated Skjermbilde mascot prototype

The local package id `skjermbilde-character` has a reference-specific layered SVG renderer based on the supplied illustration. It separates the face, eyes, eyelids, irises, eyebrows, mouth, head, hat, clothing, hands, and reaction marks so the character can blink, breathe, follow the pointer, speak, think, celebrate, warn, show an error, and sleep. Use `Codex Avatar: Set State` and the trigger commands to test it.

This renderer is a hand-authored 2D reconstruction, not automatic image rigging or 3D conversion. It runs without WebGL or a cloud service, respects reduced motion, and returns to the package's local traced SVG if the layered renderer fails. See [LAYERED_MASCOT_PROTOTYPE.md](LAYERED_MASCOT_PROTOTYPE.md) for the layer contract and website integration example.

## Import an avatar package

1. Prepare a local folder containing `avatar.manifest.json` and its referenced files. The format is documented in [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md).
2. Select **Import Avatar** at the top of the assistant and choose the manifest or package folder. The Command Palette action `Codex Avatar: Import Avatar Package` remains available.
3. Select the package in **Avatar library** and review its author, license, runtime, and health badges.
4. Select **Validate** for real manifest, SVG, checksum, path, and package-limit results. Errors and warnings are shown separately.
5. Select **Use Avatar**. The selected package becomes active and reloads immediately.

Imports are copied to `.codex-avatar/avatars/<id>/`. Paths must be local and relative to the package. Packages are limited to 128 files, 10 MiB per file, and 64 MiB total. Remote URLs, traversal, symlinks that escape the package, unsafe SVG, invalid checksums, and oversized Pixi metadata are rejected.

Use **Reload Active** after changing package files, **Open Folder** to reveal the selected local package, or **Remove** and confirm to delete an imported/generated package. Select **Default Coder Orb** and **Use Avatar** to return to the built-in avatar without deleting anything. The library never shows raw local resource URLs. Command Palette equivalents remain available. Use `Codex Avatar: Clear Generated Cache` to remove generated cache and previews while preserving installed packages and exports.

Avatar-library file actions require an open, trusted workspace. When one is unavailable, the panel disables those actions, explains why, and offers **Open Folder** or **Manage Trust**. The built-in SVG remains available even in an untrusted workspace.

## Export and share an avatar package

1. Select a non-built-in avatar in **Avatar library** and confirm it shows **Ready**. Use **Validate** first if it needs repair.
2. Select **Export Avatar**.
3. Review the displayed author and license/rights statement. Statements such as “no redistribution,” “rights not asserted,” “all rights reserved,” or `UNLICENSED` produce a stronger local-backup warning; the extension does not grant redistribution rights.
4. Choose a destination for the suggested `<id>-<version>.codex-avatar.zip` file. The extension revalidates the installed package, writes the archive locally, and reveals the completed ZIP.
5. To use the ZIP in another workspace or share it with another Codex Avatar Studio user, unzip it first. Select **Import Avatar** in the destination workspace and choose the extracted package folder or its `avatar.manifest.json`.

The ZIP contains one top-level folder with the complete data-only package, including its manifest and local assets. Export never uploads the package and cannot write the archive inside the installed package itself. The generated source picture is not included unless it was already a declared package file.

For an ordinary website or app, `svg/avatar.svg` is the portable static asset. The animated `skjermbilde-character` experience also depends on the repository's authored React renderer and CSS; see [LAYERED_MASCOT_PROTOTYPE.md](LAYERED_MASCOT_PROTOTYPE.md) for website reuse.

## Connect Blender (optional)

1. Open **Blender Tools** from the primary action row.
2. Select **Auto-detect** to search `codexAvatar.blenderPath`, `BLENDER_PATH`, system `PATH`, and dynamic platform install folders. Or select **Browse** and choose the Blender executable directly.
3. Select **Test Connection**. A valid result shows the parsed Blender version, discovery source, executable path, support state, and the SVG line-art, GLB, and PNG production modes available to the extension.
4. Use **Open Log** for prefixed process output or **Open Output Folder** for `.codex-avatar/exports/blender/`.

A bad saved executable is reported separately while auto-detection continues, so a broken preference can be repaired without hiding another valid installation. A tool that merely exits successfully is not accepted: its version output must identify Blender. The current supported minimum is Blender 3.6, with no fixed maximum-version ceiling.

Select **Export Scene** in Blender Tools or run `Codex Avatar: Export Blender Scene`. Choose any explicit local `.blend`; the source is never overwritten and output always stays in the trusted workspace. The exporter prefers an `Export` collection, falls back to `Avatar`, and excludes `Guides` and `Ignore`. SVG, GLB, and PNG modes complete independently and show partial success. Each result is structurally validated before collision-safe publication, and each portable report is named `<scene>.<mode>.export-report.json`. Cancel and timeout stop the Blender process tree. Configure the per-process limit with `codexAvatar.blenderTimeoutSeconds` (10–600 seconds, default 120).

Blender is not an image vectorizer and is not required for the Create from Picture workflow. SVG line-art export depends on authored Grease Pencil content. After a valid SVG export, enter the avatar details and select **Use SVG as Avatar** to validate, install, activate, and reload it. When the same export also contains a validated GLB, the action becomes **Use 3D Avatar**: WebGL is preferred, while the package SVG and then the built-in coder orb remain the recovery chain.

After a picture produces an SVG preview (or after saving its package), select **Create Blender Scene from SVG** to make a new editable Blender working copy. The scene places imported curves in `Avatar/Export`, adds the standard helper collections, orthographic camera, and neutral light, and saves only under `.codex-avatar/exports/blender/`. The curves are not an automatic rig or 3D character. Select **Open Scene Folder** to edit, then **Export Blender Scene** to use the normal validated export flow.

## States, triggers, and settings

`Codex Avatar: Set State` lets you preview `idle`, `welcome`, `listening`, `thinking`, `speaking`, `coding`, `reviewing`, `debugging`, `building`, `success`, `warning`, `error`, and `sleeping`. The manual actions `Start Thinking`, `Start Speaking`, `Mark Success`, and `Mark Error` are shortcuts.

The trigger commands cover blink, gaze, nod, shake, celebrate, point, speaking start/stop, particles, and clearing effects. A one-shot trigger returns to the current state automatically when the selected runtime supports it.

The Webview keeps Enabled, Focus mode, Intensity, Speech bubble, and Reduced motion under **Behavior**. Runtime, position, frame rate, effects, sound, lip sync, timeouts, no-animation mode, diagnostics, and reset are collapsed under **Advanced behavior**. Character and runtime selections are workspace-scoped when a folder is open; behavior preferences remain global. Select avatars through **Avatar library**, not a free-text id. `soundEnabled` and `lipSyncEnabled` are opt-in; the MVP does not request microphone permission.

## Local outputs

- Imported packages: `.codex-avatar/avatars/`
- Generated cache and previews: `.codex-avatar/cache/` and `.codex-avatar/previews/`
- SVG exports: `.codex-avatar/exports/svg/`
- Blender exports: `.codex-avatar/exports/blender/`
- Shareable avatar ZIPs: the location selected in the **Export Avatar** save dialog

The [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md), [PERFORMANCE.md](PERFORMANCE.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) documents explain data handling, resource limits, and recovery steps.
