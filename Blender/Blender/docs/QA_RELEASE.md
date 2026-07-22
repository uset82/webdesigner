# QA and Release

## Automated Checks

Run these from the repository root before a release or PR handoff:

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke:webview
```

Expected coverage:

- TypeScript builds every workspace package.
- Typecheck and lint run with strict TypeScript settings.
- `avatar-core` validates state, manifest, runtime fallback, Live2D mapping, GPU guards, and reduced motion helpers.
- `asset-pipeline` validates PNG/JPEG decoding, color/transparency behavior, output collisions, SVG sanitization, layer checks, limits, and local vectorization.
- `extension` tests command contribution, strict Webview CSP, transactional package install/removal, trust fallback, path privacy, real package validation, validated ZIP export, library activation/reload, terminable worker tracing, Blender partial exports, artifact validation, and SVG-first Blender packages.
- `webview` tests the real avatar selector, structured validation, unavailable states, Export Avatar action, collapsed advanced settings, built entry assets, and typed bridge commands.
- `smoke:webview` serves the bundled Webview locally and verifies the avatar renderer, picture Studio, package states, avatar library, and theme-responsive layout in headless Edge.

## Manual QA Checklist

- [ ] Launch Extension Development Host.
- [ ] Run `Codex Avatar: Open Assistant`.
- [ ] Confirm the Assistant view appears in the activity bar.
- [ ] Confirm the SVG fallback avatar renders before any optional runtime assets are present.
- [ ] Run `Codex Avatar: Set State` and preview several states.
- [ ] Trigger thinking, speaking, success, and error commands from the Command Palette.
- [ ] Toggle enabled/disabled from both Command Palette and Webview UI.
- [ ] Confirm Create from Picture, Import Avatar, and Blender Tools are the only primary action row.
- [ ] Select the built-in and a custom package through Avatar library; do not use a free-text avatar id.
- [ ] Validate a valid package and a damaged package; confirm structured errors/warnings contain no raw local paths.
- [ ] Activate, reload, reveal, and remove a non-active package; then remove the active package and confirm fallback.
- [ ] Export a valid custom package, inspect the author/license confirmation, unzip the result, and import it into another trusted workspace.
- [ ] Change position, intensity, reduced motion, and speech bubble settings; expand Advanced behavior for runtime and diagnostics.
- [ ] Reload the window and confirm settings persisted.
- [ ] Use Reset Settings and confirm defaults return without restart.
- [ ] With no workspace and with an untrusted workspace, confirm local actions are disabled with Open Folder/Manage Trust guidance and the built-in SVG still renders.
- [ ] Run Create Avatar from Picture with small color PNG, transparent PNG, and JPEG fixtures; compare source/SVG previews and cancel one active conversion.
- [ ] Run Blender export with no Blender configured and confirm the friendly setup warning appears.
- [ ] In Blender Tools, exercise Browse, Auto-detect, and Test Connection; confirm version, source, executable, support, and capabilities are readable.
- [ ] Set a fake executable as the saved Blender path; confirm it is rejected while valid fallback detection continues.
- [ ] Cancel a running Blender check/export and confirm the process tree exits and no staged files are published.
- [ ] If Blender is installed, run `pnpm smoke:blender`, then test SVG/GLB/PNG from the panel; confirm partial success, source preservation, `Export`/`Avatar` selection, `Guides`/`Ignore` exclusion, portable reports, and collision-safe names.
- [ ] For a valid Grease Pencil SVG result, confirm install, activation, reload, and same-id replace/copy behavior. With a validated GLB, confirm **Use 3D Avatar**, lazy WebGL loading, state cross-fades, one-shot return, and SVG recovery; without one, confirm SVG-only activation.
- [ ] After picture vectorization, select **Create Blender Scene from SVG**; confirm the source SVG is unchanged, the new scene contains editable curves under `Avatar/Export`, helper collections/camera/light exist, and **Export Blender Scene** returns to the normal flow.
- [ ] Verify reduced-motion behavior with system reduced motion enabled.
- [ ] Verify focus mode reduces motion and chatter.
- [ ] Capture and inspect narrow and wide panels in dark, light, and high-contrast themes.
- [ ] Inspect Webview developer tools for CSP errors.
- [ ] Exercise WebGL context loss, corrupt/missing GLB, page visibility, reduced motion, focus/no-animation mode, and repeated mount/dispose; confirm fallback and no resource leaks.
- [ ] Confirm there are no remote network calls in normal SVG fallback use.

## Release Gates

- [ ] `pnpm build` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm smoke:webview` passes.
- [ ] `pnpm validate:vsix`, `pnpm smoke:vsix`, and `pnpm smoke:clean-profile` pass.
- [ ] Extension Development Host launches.
- [ ] SVG fallback works without optional assets.
- [ ] Missing Rive, Live2D, WebGL, WebGPU, and Blender assets fail gracefully.
- [ ] VSIX packaging succeeds.

Use `docs/RELEASE_CHECKLIST.md` for the release handoff checklist.
