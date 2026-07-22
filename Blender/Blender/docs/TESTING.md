# Testing Matrix

## Automated coverage

The default repository gate is `pnpm run ci`. It runs formatting, lint, typecheck, all workspace unit/integration suites, and production builds.

- `avatar-core`: state transitions and priority, IDE event mappings, protocol schemas, manifest/runtime fallback, settings-compatible configuration, reduced motion, and audio smoothing.
- `asset-pipeline`: supported image paths, workspace boundaries, SVG sanitization/layers, image metadata, cancellation, output limits, and local vectorization.
- `runtime-pixi`: clip mapping, priorities, one-shot behavior, visibility pause, WebGL/WebGPU initialization fallback, bounded canvas dimensions, timeout cleanup, texture cache LRU/byte limits, and repeated lifecycle/switching.
- `extension`: activation/command wiring, CSP markers, workspace trust, package import/rejection/cache deletion, Blender argument boundaries, IDE event debounce/reaction, and reload subscription ownership.
- `webview`: production bundle, lazy optional runtime chunks, bridge actions, no remote network APIs, visibility pause, timeout wiring, and SVG recovery boundaries.

## Platform matrix

| Environment | Status in this workspace | Command or note |
| --- | --- | --- |
| Windows 11 / Node 22 / pnpm 11 | Verified | `pnpm run ci` |
| Windows headless browser | Run when Edge is installed | `pnpm smoke:webview` |
| VSIX package activation | Verified with the extracted packaged extension and VS Code API mock | `pnpm package:vsix` then `pnpm smoke:vsix` |
| VS Code clean-profile install | Verified when the VS Code CLI is installed | `pnpm package:vsix` then `pnpm smoke:clean-profile` (uses `code.cmd` / `code`, never `Code.exe`) |
| VS Code/compatible editor install | Host install remains environment-dependent | Prefer `pnpm smoke:clean-profile`, or the editor CLI with isolated dirs |
| macOS | Not available in this workspace | Run CI and the manual matrix on a macOS host |
| Linux | Not available in this workspace | Run CI and the manual matrix on a Linux host |
| VS Code Stable | Compatible target; host smoke is environment-dependent | Use the VSIX smoke command |
| VS Code-compatible editor | Supported where VS Code extension APIs and Webview CSP are compatible | Verify the editor-specific install path |

## Manual scenarios

Run the assistant in light, dark, and high-contrast themes; with reduced motion; in low-performance and no-animation modes; and with GPU acceleration disabled where the host permits. Confirm the SVG avatar remains functional, optional runtime failure returns to SVG, settings persist after reload, and no duplicate canvas remains after repeated panel opens.

Known limitations: macOS/Linux and alternate editor validation require those hosts; exact GPU memory is only estimated by runtime diagnostics; Blender export tests require a local Blender installation and are not part of the default CI gate.
