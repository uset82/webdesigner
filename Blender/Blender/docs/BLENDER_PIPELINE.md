# Blender Pipeline

Use Blender as an optional asset production tool for SVG line-art export, GLB export, PNG preview, and 2.5D/WebGL avatar scenes. The IDE extension must run even when Blender is not installed.

## Setup

Open **Blender Tools** in the assistant and use **Auto-detect**, **Browse**, or **Test Connection**. Detection checks, in order:

1. VS Code setting `codexAvatar.blenderPath`
2. `BLENDER_PATH`
3. `blender` on system `PATH`
4. dynamically discovered Windows, macOS, or Linux install folders

The probe requires anchored `Blender <major>.<minor>.<patch>` identity output and rejects unrelated programs even when they exit with code 0. An invalid saved setting is shown separately while fallback detection continues. Blender 3.6 is the current minimum; discovery has no fixed maximum-version ceiling. Missing or unsupported Blender shows repairable setup guidance and does not affect picture-to-SVG conversion or the built-in SVG fallback.

The panel shows the parsed version, discovery source, executable path, support state, and available SVG line-art, GLB, and PNG production modes. **Open Log** reveals the local VS Code output channel; **Open Output Folder** reveals `.codex-avatar/exports/blender/`.

### Restricted project MCP (optional)

Codex development tasks can inspect a running local Blender through `.codex/config.toml`. Run `pnpm setup:blender-mcp` once: it locates Blender and `uvx`, downloads the add-on from the pinned commit, verifies SHA-256 before writing, installs it in the user add-on directory, enables it, and never opens or overwrites a scene. Re-running the command is idempotent; `pnpm verify:blender-mcp` performs the read-only verification path. An unknown existing add-on is refused unless `--replace` is explicit.

Restart Blender and start a new Codex task after setup. In Blender's MCP panel, leave PolyHaven, Sketchfab, Hyper3D, Hunyuan, and all remote-generation integrations disabled, then start the server on `localhost:9876`. The project allowlist exposes only scene info, object info, viewport screenshots, and Blender-code execution. The three inspection tools are automatic; arbitrary Blender Python always requires approval. Telemetry is disabled, Blender remains optional, and a missing host, `uvx`, add-on, or connection does not affect the extension or its SVG fallback.

## Scene Conventions

Prefer these collections:

```txt
Avatar
Rig
Export
Guides
Ignore
```

The exporter prefers `Export`, falls back to `Avatar`, and otherwise uses the scene collection. Nested `Guides` and `Ignore` collections are excluded. The selected `.blend` may be outside the workspace because the native picker is explicit; it is opened read-only and all output remains under the trusted workspace.

For line-art/SVG work:

- use an orthographic camera
- use flat or stylized materials
- use Grease Pencil SVG export when available
- treat Blender SVG export as line art or reference, not a complete Rive/Live2D rig

For GLB/WebGL work:

- use GLB for optional Three.js/WebGL mode
- keep scene scale consistent
- pack or localize textures
- use shape keys for blink/mouth behavior when targeting a 3D avatar

## Outputs

Select **Export Scene** in Blender Tools (or run `Codex Avatar: Export Blender Scene`), choose a local `.blend`, and choose SVG line art, GLB, or PNG preview. The extension checks Blender identity before starting and shows a readable error when it is unavailable.

Every process uses an argument array with `shell: false`, `--disable-autoexec`, bounded prefixed stdout/stderr, a configurable 10–600 second timeout, cancellation, and process-tree cleanup. Only one Blender export job runs at a time. Input scenes and packaged Python scripts are checked as regular local files and may not escape their trusted roots through symlinks.

Each job writes first to `.codex-avatar/cache/jobs/blender-<job-id>/`. Every mode is run, validated, and published independently, so a valid GLB or PNG is retained if SVG is unavailable. SVG is sanitized and optimized through the shared local pipeline; GLB headers/version/chunks/size, PNG signature/dimensions/size, and portable report fields are validated before collision-safe publication. Failure, cancellation, timeout, validation error, or a late filename collision removes that mode's staged files and never overwrites the source scene.

The command writes local files to:

```txt
.codex-avatar/exports/blender/
```

Supported outputs:

- `<scene>.line-art.svg` for line art when Blender SVG support is available
- `<scene>.webgl.glb` for WebGL/Three.js assets
- `<scene>.preview.png` for PNG preview
- `<scene>.<mode>.export-report.json` for each export

SVG export depends on Blender Grease Pencil SVG support. It does not vectorize arbitrary pictures or meshes. If SVG succeeds, the extension builds a validated package and may include the GLB and PNG. A validated GLB plus that package-local SVG enables **Use 3D Avatar**, installs atomically, selects WebGL, and retains SVG recovery; without a GLB the action remains **Use SVG as Avatar**.

Run `pnpm smoke:blender` to create a disposable real Blender fixture and verify GLB/PNG export, collection exclusion, portable reports, and artifact validation. It skips cleanly when Blender is absent; set `REQUIRE_BLENDER=1` to require the host.

## SVG-to-Blender handoff

After a successful picture SVG preview or package, select **Create Blender Scene from SVG**. The extension accepts only the current sanitized SVG inside the avatar workspace and creates a new collision-safe `<name>.working.blend` plus `<name>.scene.export-report.json` under `.codex-avatar/exports/blender/`. The source SVG and existing scenes are never modified.

The new scene imports SVG paths as editable curves into `Export`, nested under `Avatar`, and adds `Guides`, `Ignore`, an orthographic camera, neutral area lighting, a transparent render background, and small curve depth. Imported curves are a 2D/2.5D starting point; they are not automatically rigged or converted into a production 3D character. Use **Open Scene Folder** to edit the working copy, then **Export Blender Scene** to return to the validated Phase 7 workflow.
