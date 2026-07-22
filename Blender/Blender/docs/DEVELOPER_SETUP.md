# Developer Setup

## Prerequisites

- Windows, macOS, or Linux for the TypeScript workspace; Windows is the primary tested host.
- Node.js `22.22.0`, as pinned by `.nvmrc` and the root engine range `>=22 <23`.
- pnpm `11.7.0`.
- VS Code `1.96` or newer for extension development.
- Microsoft Edge is required only for `pnpm smoke:webview`.

Install the pinned tools, then verify them:

```bash
node --version
pnpm --version
```

## Clone, install, and build

```bash
git clone <repository-url>
cd Blender
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm run ci
```

`pnpm run ci` checks formatting, lint, type safety, unit/integration tests, and all workspace builds. The main workspace packages are `apps/extension`, `apps/webview`, `packages/avatar-core`, `packages/asset-pipeline`, and `packages/runtime-pixi`.

## Develop the extension

Run `pnpm dev:extension` for the extension TypeScript watcher, or use the VS Code launch configuration and press `F5`. In the Extension Development Host, run `Codex Avatar: Open Assistant`.

Useful focused commands:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run smoke:webview
```

The source-of-truth runtime contract is `packages/avatar-core/src/runtime.ts`. The Pixi implementation is isolated in `packages/runtime-pixi`; the Webview imports it dynamically so the SVG fallback can load when optional initialization fails.

## Package and inspect a VSIX

```bash
pnpm run package:vsix
pnpm run validate:notices
pnpm run validate:vsix
pnpm run smoke:vsix
pnpm run smoke:clean-profile
pnpm run package:vsix:pre
```

The stable package uses the extension version from `apps/extension/package.json`. The pre-release command emits a `-pre.1` artifact without changing source version files. `smoke:clean-profile` installs the stable VSIX into a temporary VS Code profile through the CLI shim (`code.cmd` / `code`) so the command exits; do not call `Code.exe` for packaging checks. See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before distributing an artifact.

## Change workflow

1. Read `AGENTS.md` and the applicable skill instructions.
2. Read the relevant section of [PLAN_CHECKLIST.md](PLAN_CHECKLIST.md).
3. Keep optional runtimes isolated and preserve SVG fallback behavior.
4. Add or update tests with behavior changes.
5. Run `pnpm run ci`, the relevant smoke command, and package validation before committing.
