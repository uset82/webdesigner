# Changelog

## Unreleased

- Added the trusted-workspace Create from Picture Studio with source metadata, disposable previews, structured progress/errors, and cleanup on cancel or panel disposal.
- Added color-first PNG/JPEG tracing presets, bounded cleanup/detail controls, side-by-side SVG preview, complexity metrics, and optional named-layer guidance.
- Added Save & Use metadata, schema-v1 package generation, checksum validation, explicit collision choices, transactional install/activation/rollback, persistent selection, and safe Open Folder/Copy Path actions.
- Added **Export Avatar** with package revalidation, explicit author/license confirmation, restricted-rights backup warnings, atomic local ZIP creation, and portable top-level package folders.
- Moved tracing into a packaged worker so visible cancellation can terminate CPU-bound conversion without committing output.
- Hardened SVG sanitization, source-size limits, collision-safe exports, real decoder/worker fixtures, browser coverage, and installed-VSIX tracing smoke tests.
- Kept WebP unavailable until a packaged decoder can pass a real decode-and-trace test.
- Replaced the free-text avatar field and raw asset rows with a compact avatar library that imports, selects, validates, reloads, reveals, and transactionally removes local packages with trust guidance and structured results.
- Grouped everyday behavior separately from collapsed advanced settings, removed duplicate action rows, and added responsive dark, light, and high-contrast browser coverage.
- Added Blender Tools with Browse, dynamic Auto-detect, strict Blender identity/version testing, capability reporting, repairable invalid-path guidance, and log/output actions; the real Windows probe detects Blender 4.5.3 without a fixed version ceiling.
- Hardened Blender execution with `--disable-autoexec`, trusted real-path checks, single-flight jobs, configurable timeout, cancellation/process-tree cleanup, bounded prefixed logs, per-job staging, validation, and collision-safe publication.
- Connected Blender exports end to end: explicit external scene selection, `Export`/`Avatar` collection conventions, per-mode partial success, portable export reports, structural SVG/GLB/PNG validation, real-host smoke coverage, and SVG-first avatar package activation with GLB kept export-only.
- Added an optional sanitized SVG-to-Blender handoff that creates a new editable curve scene with standard collections, camera, lighting, collision-safe output, portable reporting, and a route back to validated exports.

## 0.1.0 - 2026-07-08

- Added the Codex Avatar Studio VS Code extension shell.
- Added React/Vite webview with SVG fallback, Rive, Live2D, WebGL, and WebGPU runtime adapters.
- Added local SVG asset pipeline and Blender export integration.
- Added settings, asset manager, QA gates, performance hardening, and VSIX packaging workflow.
- Added a clean-room PixiJS spritesheet avatar with deterministic state and trigger animation.
- Added local avatar package validation, workspace trust controls, cache clearing, and imported-avatar deletion.
- Added local audio-reactive mouth animation, bounded runtime resources, packaged smoke tests, and privacy documentation.
- Replaced the GPL-2.0 Potrace tracing path with the permissive ImageTracerJS/Jimp local pipeline and added VSIX bundle validation for the removed runtime.
- Re-audited direct dependencies and built-in asset provenance, refreshed third-party notices, and added `pnpm validate:notices` for release gating.
