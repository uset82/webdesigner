# Avatar Package Specification

An avatar package is a local directory containing an `avatar.manifest.json` file and the assets referenced by that manifest. The extension imports packages into the workspace-local `.codex-avatar/avatars/<id>/` registry. The package is a data-only bundle: it does not execute JavaScript.

## Manifest

Required fields:

- `schemaVersion`: currently `1`;
- `id`, `name`, `version`, `author`, and `license`;
- `preferredRuntime` and `fallbackRuntime`;
- `entrypoints`, `capabilities`, and `states`.

Optional fields include `triggers`, `previewImage`, `runtimePriority`, `assets`, and `checksums`. Checksums are SHA-256 hex strings keyed by package-relative asset paths.

All entrypoints, assets, preview images, and checksum keys must be local relative paths. Absolute paths, `..` segments, URL schemes, remote URLs, and symlinks escaping the package are rejected. Referenced files must exist and checksum values must match when supplied.

## Minimal package

```text
my-orb/
├── avatar.manifest.json
├── svg/avatar.svg
└── pixi/avatar-spritesheet.json
```

```json
{
  "schemaVersion": 1,
  "id": "my-orb",
  "name": "My Original Orb",
  "version": "1.0.0",
  "author": "Your Name",
  "license": "CC0-1.0",
  "preferredRuntime": "pixi",
  "fallbackRuntime": "svg",
  "entrypoints": {
    "pixi": "pixi/avatar-spritesheet.json",
    "svg": "svg/avatar.svg"
  },
  "capabilities": ["state-animation", "reduced-motion"],
  "states": {
    "idle": "idle_loop",
    "thinking": "think_loop"
  },
  "previewImage": "svg/avatar.svg"
}
```

Start with an SVG entrypoint and add Pixi metadata only when the atlas is ready. The `idle` state and an SVG entrypoint are required for a useful fallback. The author is responsible for ensuring that the chosen license covers the artwork and any included fonts, sounds, models, or generated derivatives.

## Runtime behavior

The requested runtime is selected when its capability and local entrypoint are available. The declared fallback is used when it is not; the built-in SVG avatar remains the final fallback. State and trigger values are names interpreted by the selected runtime, not executable code.

## Commands

- `Codex Avatar: Create Avatar from Picture` builds, validates, installs, and activates a local SVG package through **Save & Use**.
- `Codex Avatar: Import Avatar Package` copies and validates a local package.
- `Codex Avatar: Activate Avatar Package` selects an imported package or returns to the built-in avatar.
- `Codex Avatar: Remove Avatar Package` removes an imported package; removing the active package returns to the built-in avatar.
- **Export Avatar** in the Webview revalidates a non-built-in package and writes a local `<id>-<version>.codex-avatar.zip` after an explicit rights confirmation.

The Webview displays the package name, author, license, runtime paths, and validation status. Imported packages remain local to the workspace and are never uploaded by this feature.

Generated picture packages also include `metadata/source.json` with the safe source filename, dimensions, format, and transparency status. Both that metadata file and `svg/avatar.svg` are covered by SHA-256 checksums. The original raster is preserved outside the package.

Blender-created avatar packages follow the same permanent-fallback rule. A successful sanitized Blender SVG becomes `svg/avatar.svg`, a validated PNG may become `preview/avatar.png`, and a validated GLB becomes `webgl/avatar.glb`. A package may advertise `preferredRuntime: "webgl"`, `entrypoints.webgl`, and `runtimePriority: ["webgl", "svg"]` only when both the GLB and package-local SVG validate. Packages without that pair remain SVG-only. Schema version 1 already defines these fields, so no migration is required.

## Creation and import checklist

1. Create original art or use assets whose license permits the intended distribution.
2. Add `avatar.manifest.json` and local relative entrypoints.
3. Add an SVG fallback and confirm the `idle` mapping.
4. For Pixi, create the atlas and metadata described in [SPRITESHEET_GUIDE.md](SPRITESHEET_GUIDE.md).
5. Add SHA-256 checksums for every referenced file when publishing a package.
6. Import the package with `Codex Avatar: Import Avatar Package`.
7. Activate it, reload the avatar, and test reduced motion, a state change, and a missing optional runtime.

The extension enforces 128 files maximum, 10 MiB maximum per file, 64 MiB maximum total size, and local-only paths. Deleting an imported package does not delete exports or the built-in avatar.

## Portable ZIP export

An exported ZIP stores the complete package without compression under one top-level `<id>/` directory. Unzip it before importing; ZIP files are not accepted directly by **Import Avatar**. Archive entries use UTF-8 relative names and preserve the same manifest and assets that passed package validation. The exporter rejects invalid packages, symbolic links, unsafe paths, package limits, and destinations inside the installed package.

Export is a local packaging operation, not a license grant. Restricted or unclear rights statements receive a local-backup warning, and the recipient remains responsible for following the author and license fields in `avatar.manifest.json`.
