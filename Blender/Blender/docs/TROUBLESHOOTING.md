# Troubleshooting

## The assistant panel is empty

Run `Codex Avatar: Open Assistant`, then `Codex Avatar: Reload Avatar`. Check that the workspace is trusted and that the extension is enabled. In a development host, open **Help → Toggle Developer Tools** and inspect the console for a CSP or missing-resource error.

## Pixi fails or the avatar returns to SVG

This is the expected safe fallback when WebGL/WebGPU is unavailable, the local spritesheet is invalid, or initialization exceeds eight seconds in the Webview. Confirm that the manifest entrypoint and `image` path are local and that the image fits the frame grid. Set `codexAvatar.runtime` to `svg` to keep the assistant available while repairing the package.

## An avatar package is rejected

Check these common causes:

- `avatar.manifest.json` is missing or has `schemaVersion` other than `1`.
- A state, trigger, or runtime name is not in the shared contract.
- A referenced file is missing, absolute, remote, or contains `..` traversal.
- The package contains a symlink escaping its root, unsafe SVG content, a bad checksum, or exceeds the package limits.
- Pixi metadata exceeds 4096 texture dimensions, 4096 frames, or 16,384 clip references.

Open the manifest as JSON, fix the reported path, and import again. Remove a broken copy with `Codex Avatar: Delete Imported Avatar Package` before retrying the same id.

## Export Avatar is disabled or fails

Export is available only for a non-built-in package that currently shows **Ready** in a trusted workspace. Select **Validate**, repair any manifest, checksum, SVG, path, or size errors, and try again. Choose a writable ZIP destination outside `.codex-avatar/avatars/<id>/`.

If the rights dialog offers **Export Local Backup**, the manifest contains a restricted or unclear statement such as “no redistribution,” “rights not asserted,” “all rights reserved,” or `UNLICENSED`. The archive can still be created for backup, but do not publish or redistribute it unless you own the artwork or have permission. Recipients must unzip the archive before selecting **Import Avatar**.

## Generated SVG is missing or looks too complex

Use `Codex Avatar: Create Avatar from Picture` with a local PNG, JPG, or JPEG in a trusted workspace. Start with Color Illustration, reduce Detail or increase Noise cleanup when the path count is high, and use High-Contrast Silhouette only when monochrome output is intended. WebP is not enabled because the packaged decoder cannot read it yet. Cancelled previews are disposable and do not create exports or packages. Clean a finished trace into named layers when part-by-part animation is needed. See [ASSET_PIPELINE.md](ASSET_PIPELINE.md).

## Blender export fails

Blender is optional. Open **Blender Tools**, select **Auto-detect** or **Browse**, then use **Test Connection**. The panel distinguishes a bad saved path, missing Blender, an unsupported version, and a connection error while showing any valid fallback installation it found. Use **Open Log** for prefixed stdout/stderr.

If only SVG fails, the scene probably has no Grease Pencil line art or the Blender build lacks its SVG exporter. GLB and PNG successes are retained. Blender does not convert arbitrary meshes or pictures into SVG. Put intended content in `Export` (or `Avatar`), keep helpers in `Guides`/`Ignore`, then re-export. Reports use `.export-report.json`; they are not installable avatar manifests.

The workspace must be trusted and the source must be a regular `.blend` file inside it. Export is staged locally, uses a single process, and never replaces the source scene or an existing output. If a process stalls, select Cancel or increase `codexAvatar.blenderTimeoutSeconds` up to 600 seconds. See [BLENDER_PIPELINE.md](BLENDER_PIPELINE.md).

## Tests fail locally

Use Node 22.22.0 and pnpm 11.7.0, run `pnpm install --frozen-lockfile`, and retry `pnpm run ci`. `pnpm smoke:webview` needs Microsoft Edge; `pnpm smoke:vsix` is a clean extraction/runtime smoke and does not install an extension into the active editor.

For a real isolated install, run `pnpm run smoke:clean-profile` after packaging. That script uses the VS Code **CLI shim** (`…/bin/code.cmd` on Windows, or `code` on PATH) with temporary `--extensions-dir` and `--user-data-dir` folders.

Do **not** invoke `Code.exe` directly for `--install-extension`. The GUI binary can leave the shell hung for minutes while VS Code stays open. If a command is stuck after using `Code.exe`, cancel the shell job; leave your normal VS Code session alone (it uses `%APPDATA%\Code`, not the temp profile dirs).

## Performance or motion concerns

Set frame rate to 30, animation intensity to Low, enable Focus Mode, enable reduced motion, or set `noAnimation`. Hidden Webviews pause the Pixi ticker. `Codex Avatar: Clear Generated Cache` removes generated intermediates but preserves imported packages and exports. See [PERFORMANCE.md](PERFORMANCE.md).
