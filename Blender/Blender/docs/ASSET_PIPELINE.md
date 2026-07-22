# Asset Pipeline

All asset processing is local. Do not upload source images, SVGs, `.blend`, `.riv`, `.glb`, or Live2D files from this pipeline.

## Image-to-SVG workflow

1. Run `Codex Avatar: Create Avatar from Picture`. The older `Vectorize Image to SVG` command opens the same Studio flow.
2. Select a local PNG, JPG, or JPEG file in a trusted workspace.
3. Review the source, then choose Color Illustration, Clean Icon, or High-Contrast Silhouette.
4. Adjust the bounded color, grayscale, threshold, background, cleanup, and detail controls.
5. Compare the source and safe optimized SVG visually, then review byte size, path count, optional-layer guidance, and warnings.

The Studio is a local reference-art workflow. It does not upload the input, modify the source image, or create an animated rig automatically. Use [SPRITESHEET_GUIDE.md](SPRITESHEET_GUIDE.md) for animation-ready Pixi art and [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md) to package a finished fallback.

Image tracing is for references, icons, silhouettes, and quick shape exploration. Do not use a full poster/image trace as the final animated avatar. Animated characters need clean, named layers or a rigged runtime file.

## Preview and export output

Studio previews are disposable. The selected source copy and optimized SVG preview stay under `.codex-avatar/cache/jobs/<job-id>/` and are removed on cancellation, replacement, or panel disposal. Previewing alone does not create a package or committed export. **Save & Use** stages a separate schema-v1 package, validates its SVG, manifest, metadata, paths, and checksums, then atomically installs and activates it under `.codex-avatar/avatars/<id>/`.

Generated packages contain `svg/avatar.svg`, `metadata/source.json`, and `avatar.manifest.json`. The source picture itself is not copied into the installed package. Author and license/rights fields are required user input and are never inferred. Existing ids require an explicit Replace, Create Copy, or Cancel choice; activation/reload failure restores the previous package, registry, runtime, and character setting.

The optional **Create Blender Scene from SVG** handoff reads that job's sanitized optimized SVG, never the original raster or arbitrary XML. It creates a new collision-safe `.blend` under `.codex-avatar/exports/blender/`, imports paths as editable curves under `Avatar/Export`, and writes a portable `.scene.export-report.json`. The preview SVG is not changed. Curves are explicitly presented as a starting scene rather than an automatic rig or production 3D conversion.

The lower-level export API can retain a trace under `.codex-avatar/exports/svg/`:

- `<name>.raw-trace.svg`
- `<name>.optimized.svg`
- `<name>.manifest.json`

The manifest records the source image, outputs, guidance, and validation warnings. It is a conversion record, not an installable `avatar.manifest.json`. Collision-safe names use `<name>`, `<name>-2`, `<name>-3`, and so on, and exclusive writes never replace an existing trio member.

The optimized SVG is produced locally with SVGO configured to preserve IDs and groups, plus a conservative pass that removes declarations, doctypes, comments, and extra tag whitespace while preserving paths and `viewBox`.

The current pipeline decodes PNG/JPG/JPEG locally with Jimp, traces with ImageTracerJS, and uses SVGO with ID and group preservation before sanitizing the result again for the Webview. The optimized result is shown through a local `<img>` URI; raw XML is not injected into the Webview. The source raster file is never modified. WebP is deliberately not advertised because the packaged Jimp decoder does not support it; it can be enabled only after a real packaged decode-and-trace test passes.

## Preprocessing and safety

`previewImageToSvg` preserves color by default and accepts local preprocessing options for grayscale/threshold tracing, near-white background removal, noise reduction, bounded color quantization, and low/balanced/high path detail. ImageTracerJS produces bounded color layers; complex artwork should still be cleaned into stable named layers before animation.

Every Studio run executes in a terminable worker, rejects non-regular or over-32-MiB sources and oversized raster dimensions, and enforces SVG byte and path-count limits. Cancel terminates active tracing, removes disposable vector data, and publishes no late result. Generated output is never committed when preview generation, sanitization, validation, or cancellation fails.

## Layer IDs

Use SVG group IDs for animation-ready layers. IDs must be stable, lowercase, and slash-separated:

```txt
avatar/root
avatar/head
avatar/eyes/left
avatar/mouth/open
```

Avoid unnamed groups. If a group may move, blink, rotate, glow, or change opacity, name it.

## Humanoid / VTuber-Lite Layers

```txt
avatar/root
avatar/body
avatar/head
avatar/face
avatar/eyes/left
avatar/eyes/right
avatar/pupils/left
avatar/pupils/right
avatar/eyebrows/left
avatar/eyebrows/right
avatar/mouth/closed
avatar/mouth/open
avatar/hair/back
avatar/hair/front
avatar/arm/left/upper
avatar/arm/left/lower
avatar/arm/left/hand
avatar/arm/right/upper
avatar/arm/right/lower
avatar/arm/right/hand
avatar/accessories
avatar/effects
```

## Orb / Pet Assistant Layers

```txt
avatar/root
avatar/core
avatar/face
avatar/eyes/left
avatar/eyes/right
avatar/mouth/closed
avatar/mouth/open
avatar/aura
avatar/particles
avatar/antenna
avatar/accessories
avatar/shadow
```

## Validation Warnings

The validator warns when:

- required layers for the selected profile are missing
- groups do not have IDs
- SVG files are large enough to affect IDE rendering
- auto-tracing creates too many tiny paths

Warnings do not mean the file is unusable. They mean the asset is better treated as reference art until it is cleaned into stable animation layers.

The tracer is not an automatic character-rigging system. It can retain a bounded color palette, but background removal is binary and local, and complex artwork should still be cleaned into named layers manually before animation.
