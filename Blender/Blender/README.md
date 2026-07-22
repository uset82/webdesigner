# Codex Avatar Studio

Codex Avatar Studio is a local animated assistant for **Visual Studio Code** and compatible **Cursor** builds. It adds an avatar panel that reacts to coding activity, supports local picture-to-SVG creation, imports portable avatar packages, and can render validated 3D GLB avatars through WebGL.

The extension works without an account, cloud upload, Blender, or a dedicated GPU. Advanced features are optional and always fall back to the built-in SVG coder orb.

> [!IMPORTANT]
> The repository and public VSIX do not include the local Cholita artwork, `.blend`, GLB, or workspace previews used during development. Users receive the redistributable coder orb and can create or import avatars for which they have the necessary rights.

## Features

- Built-in animated SVG avatar with no extra setup.
- Local PNG, JPG, JPEG, and WebP to SVG conversion.
- Avatar library for importing, validating, activating, exporting, and removing packages.
- SVG, PixiJS, and optional Three.js WebGL rendering.
- Semantic states: idle, welcome, listening, thinking, speaking, coding, reviewing, debugging, building, success, warning, error, and sleeping.
- Triggers for blink, gaze, nod, shake, celebrate, point, speaking, and particle effects.
- Reduced-motion, focus-mode, frame-rate, and animation-intensity controls.
- Optional Blender 3.6+ discovery, GLB/SVG/PNG export, and SVG-to-editable-scene handoff.
- Local-only files, strict Webview security policy, validated messages, and automatic SVG fallback.

## Requirements

### End users

| Requirement | Notes |
| --- | --- |
| VS Code 1.96+ or a compatible Cursor build | VS Code is the release-tested host. |
| A trusted workspace folder | Required for importing, generating, or exporting local assets. |
| Blender 3.6+ | Optional; only required for Blender production tools. |

### Building from source

| Requirement | Version |
| --- | --- |
| Git | Current stable release |
| Node.js | 22.x |
| pnpm | 11.7.0 |

## Install the extension

### Option 1: Install a release VSIX

1. Download `codex-avatar-studio-<version>.vsix` from the [GitHub Releases page](https://github.com/uset82/avatar-studio/releases).
2. Open VS Code or Cursor.
3. Open **Extensions**.
4. Select the Extensions `…` menu and choose **Install from VSIX…**.
5. Select the downloaded file and reload the IDE if prompted.

VS Code users can also install from a terminal:

```bash
code --install-extension codex-avatar-studio-0.1.0.vsix --force
```

### Option 2: Build the VSIX yourself

```bash
git clone https://github.com/uset82/avatar-studio.git
cd avatar-studio
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm package:vsix
```

The package is created at:

```text
dist/codex-avatar-studio-0.1.0.vsix
```

Install it from the Extensions menu or run:

```bash
code --install-extension dist/codex-avatar-studio-0.1.0.vsix --force
```

### Option 3: Run an Extension Development Host

```bash
git clone https://github.com/uset82/avatar-studio.git
cd avatar-studio
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm build
```

Open the repository in VS Code and press **F5** to start the Extension Development Host.

## First launch

1. Open a workspace folder and trust it when appropriate.
2. Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`.
3. Run **Codex Avatar: Open Assistant**.
4. The built-in coder orb appears in the Codex Avatar activity-bar panel.

If the panel is not visible, run **Codex Avatar: Toggle Assistant**, followed by **Codex Avatar: Reload Avatar**.

## How it works

```text
IDE commands and activity
          │
          ▼
VS Code extension host
  validates settings, events, paths, and avatar packages
          │
          ▼
Secure local Webview
          │
          ├── SVG renderer and built-in fallback
          ├── PixiJS renderer for compatible packages
          └── Lazy Three.js WebGL renderer for validated GLB packages
```

The extension host owns filesystem access, native file pickers, Blender processes, workspace trust checks, and safe Webview URIs. The Webview only receives validated messages and local assets that belong to the active package.

If WebGL, a GLB file, an animation clip, or an optional runtime fails, the extension falls back to the package SVG and then to the built-in coder orb.

## Everyday use

### Use the built-in avatar

Open the assistant and keep **Coder Orb** selected. Use the Command Palette to preview states and triggers:

- **Codex Avatar: Set State**
- **Codex Avatar: Start Thinking**
- **Codex Avatar: Start Speaking**
- **Codex Avatar: Mark Success**
- **Codex Avatar: Mark Error**
- **Codex Avatar: Trigger Blink**, **Nod**, **Shake**, **Celebrate**, or **Point**

### Create an avatar from a picture

1. Select **Create from Picture** in the assistant or run **Codex Avatar: Create Avatar from Picture**.
2. Choose a local PNG, JPG, JPEG, or WebP file.
3. Adjust the tracing controls and review the SVG preview.
4. Enter the avatar name, id, author, version, and license or rights statement.
5. Select **Save & Use**.

Picture tracing creates a useful static SVG. It does not automatically segment, rig, or convert a picture into a production 3D character.

### Import an avatar package

1. Select **Import Avatar**.
2. Choose a folder containing `avatar.manifest.json`, or select the manifest itself.
3. Find the package in **Avatar library**.
4. Select **Validate**, then **Use Avatar**.

Every WebGL package must include both a validated local GLB and a package-local SVG fallback. See [Avatar Package Specification](docs/AVATAR_PACKAGE_SPEC.md) for the complete schema.

### Export and share an avatar package

1. Select a custom avatar marked **Ready**.
2. Select **Export Avatar**.
3. Confirm that you have permission to redistribute the artwork.
4. Save the `.codex-avatar.zip` file.

Recipients should extract the ZIP and import its package folder. Exporting a package does not grant new rights to its artwork.

## Optional Blender workflow

End users do not need Blender MCP. The extension’s **Blender Tools** panel can discover Blender, test the executable, and run local exports directly.

1. Install Blender 3.6 or newer.
2. Open **Blender Tools** in the assistant.
3. Select **Auto-detect**, or browse to the Blender executable.
4. Select **Test Connection**.
5. Choose a `.blend` scene and export GLB, SVG, PNG, or supported combinations.

Blender jobs run locally with bounded timeouts, safe argument arrays, staged output, validation, and cleanup. The source `.blend` is not overwritten.

**Create Blender Scene from SVG** creates an editable curve-based starting scene. It is not automatic 2D-to-3D conversion or automatic character rigging.

### Optional restricted Blender MCP for Codex contributors

The repository contains a project-scoped Codex MCP configuration. It pins `blender-mcp==1.6.4`, connects only to `localhost:9876`, disables telemetry, and exposes a four-tool allowlist. Arbitrary Blender Python requires approval.

Prerequisites:

- Blender installed locally.
- [`uv`](https://docs.astral.sh/uv/) with `uvx` available on `PATH`.
- A local Codex workspace opened from this repository.

Install or verify the audited Blender add-on:

```bash
pnpm setup:blender-mcp
pnpm verify:blender-mcp
```

Then restart Blender and begin a new Codex task before the first MCP smoke test. Full setup and safety details are in [Blender Pipeline](docs/BLENDER_PIPELINE.md).

## Settings

The assistant panel separates everyday behavior from advanced settings:

- **Enabled** — show or pause the assistant.
- **Focus mode** — stop continuous motion while concentrating.
- **Intensity** — low, medium, or high motion.
- **Speech bubble** — show contextual assistant messages.
- **Reduced motion** — respect the operating-system preference.
- **Runtime** — SVG, PixiJS, or WebGL.
- **Frame rate** — 30 or 60 FPS.
- **Effects and diagnostics** — particles, debug overlay, and runtime reporting.

Avatar and runtime selection are workspace-scoped when a workspace is open. General behavior preferences remain global.

## Local file layout

Generated and imported content stays inside the active workspace:

```text
.codex-avatar/
├── avatar-registry.json
├── avatars/<avatar-id>/
│   ├── avatar.manifest.json
│   ├── svg/avatar.svg
│   ├── webgl/avatar.glb       # optional
│   └── preview.png            # optional
├── cache/
├── exports/
└── previews/
```

`.codex-avatar` content is workspace data and is ignored by this repository. Review an avatar’s author and license before sharing it.

## Privacy and security

- No account is required.
- Source pictures, SVG files, GLB files, and Blender scenes are processed locally.
- The Webview cannot request arbitrary local files.
- Remote asset-generation services are not used.
- Workspace trust gates filesystem changes and Blender execution.
- Manifests, paths, messages, SVG, GLB, PNG, and package sizes are validated.
- Optional runtime failure never prevents the extension from loading.

See [Security and Privacy](docs/SECURITY_PRIVACY.md) for the full threat model.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Assistant panel is missing | Run **Codex Avatar: Open Assistant** or **Toggle Assistant**. |
| Avatar is blank or stuck | Run **Codex Avatar: Reload Avatar**. |
| Import, create, or export is disabled | Open a folder and confirm that the workspace is trusted. |
| Picture conversion fails | Try a smaller PNG/JPG/JPEG/WebP and review the reported validation message. |
| Blender is not found | Use **Blender Tools → Browse** or **Auto-detect**. |
| A GLB cannot load | Validate the package and its SVG fallback; the stage should remain usable in SVG mode. |
| Motion is too distracting | Enable **Focus mode**, lower intensity, or enable reduced motion. |

More help is available in [Troubleshooting](docs/TROUBLESHOOTING.md) and the [User Guide](docs/USER_GUIDE.md).

## Development and verification

```bash
pnpm install --frozen-lockfile
pnpm run ci
pnpm smoke:webview
pnpm smoke:blender
pnpm package:vsix
pnpm validate:vsix
pnpm smoke:vsix
pnpm smoke:clean-profile
```

`pnpm smoke:blender` is skipped gracefully when a supported Blender installation is unavailable. Release packaging intentionally excludes `.codex-avatar`, private character assets, `.blend` files, and package GLBs.

Project documentation:

- [Developer Setup](docs/DEVELOPER_SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Avatar Package Specification](docs/AVATAR_PACKAGE_SPEC.md)
- [Blender Pipeline](docs/BLENDER_PIPELINE.md)
- [QA and Release](docs/QA_RELEASE.md)
- [Implementation Checklist](docs/PLAN_CHECKLIST.md)

## License and third-party software

The source repository is currently **all rights reserved**; see [LICENSE](LICENSE). Publishing the repository does not automatically grant permission to redistribute its source code or artwork. If you are the project owner and want community reuse or contributions, select and publish an explicit open-source license before inviting redistribution.

Third-party dependencies and the audited project skills are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
