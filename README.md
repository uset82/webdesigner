# WebDesigner for Codex

WebDesigner is an installable Codex plugin for building polished websites, product interfaces, apps, and explicitly requested 3D experiences. It combines the Nightglass design system, a framework-aware orchestration server, responsive and accessibility guidance, optional Mint routing, and a source-pinned Blender specialist bundle.

## Install in one line

Requirements: [Codex CLI](https://developers.openai.com/codex/cli), Git, and Node.js 20 or newer.

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/uset82/webdesigner/main/install.ps1 | iex
```

### macOS or Linux

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/webdesigner/main/install.sh | sh
```

The installer uses Codex's native plugin commands. It registers or refreshes the `uset82/webdesigner` marketplace, installs `webdesigner@webdesigner-repo-marketplace`, and leaves existing projects untouched. Start a new Codex task after installation so the new skills and MCP tools are loaded.

Rerun the same one-line command at any time to update WebDesigner.

> Piping a remote script into a shell is convenient but should match your security policy. You can inspect [`install.ps1`](install.ps1) or [`install.sh`](install.sh) before running it.

## What gets installed

- `webdesigner-design-system`: the Nightglass interface workflow, 86 framework-neutral design tokens, Tailwind CSS v4 mappings, composition guidance, motion defaults, accessibility rules, prompt recipes, and design QA.
- `animate-ui`: an on-demand build workflow for selecting and adapting individual animated React components from the Animate UI Shadcn registry.
- Eight Blender specialists for modeling, materials, rigging, animation, motion inspection, export, technical art, and animation quality review.
- The WebDesigner MCP orchestration server, bundled as a self-contained Node.js artifact so installation does not run `npm install` on the user's computer.
- Existing Antigravity planning, framework selection, design-provider, code-generation, security, and deployment skills, packaged into the plugin's discoverable `skills/` directory.

The plugin does not scaffold or rewrite an application during installation. Agents apply the design system only when a task requests frontend or 3D work.

## Design behavior

WebDesigner defaults new and unspecified surfaces to Nightglass:

- matte midnight canvas and restrained layered surfaces;
- crisp Inter/system typography with JetBrains Mono fallback;
- one electric-aqua accent and one primary action per view;
- 4px spacing rhythm, restrained radii, and border-led elevation;
- responsive, keyboard-accessible, WCAG AA interfaces;
- purposeful motion with reduced-motion fallbacks;
- hierarchy and media instead of generic card mosaics.

Explicit user briefs and an existing product's coherent visual language always take precedence.

## Conditional animated UI behavior

Requests for animated Next.js or React/Vite interfaces enable the `animate-ui` integration. The build workflow previews and installs only the required `@animate-ui/...` registry items inside the generated application, then adapts them to the active design tokens and verifies keyboard and reduced-motion behavior.

Static UI requests, rendered-video tasks, Flutter applications, and backend-only work do not enable Animate UI automatically. No Animate UI component source or runtime dependency is bundled into the WebDesigner control plane.

## Conditional 3D behavior

Ordinary UI work never activates Mint or Blender merely for decorative depth.

- Generated models, PBR materials, animation, asset packs, audio, and explicitly requested Gaussian-splat worlds route to Mint when Mint is separately installed, authenticated, and exposes the required live capability.
- Precise geometry, UV work, materials, rigs, weights, animation editing, inspection, repair, and export route to the bundled Blender specialist skills.
- Successful Mint originals are preserved. Blender derivatives are created only when requested or required by a verified runtime constraint.
- Blender Python remains approval-gated, network-backed Blender providers remain disabled, and agents work on copies rather than overwriting selected `.blend` files.

Mint authentication, Blender, `uvx`, and the Blender MCP add-on are optional external capabilities; the one-line WebDesigner installer does not install applications, buy credits, store credentials, or enable remote asset providers. When a user explicitly requests Blender setup in a trusted project, the plugin includes a restricted configuration template, a pinned verifier, and a guarded visible-host launcher.

## Verify the installation

```bash
codex plugin list
```

Look for `webdesigner` from `webdesigner-repo-marketplace`, then start a new task and try:

```text
Design and build a responsive product dashboard using the WebDesigner system.
```

For a Blender installation smoke test, use a new task and request only read-only scene information and a viewport screenshot. Do not execute Blender code or modify a scene merely to test installation.

## Remove WebDesigner

```bash
codex plugin remove webdesigner@webdesigner-repo-marketplace
codex plugin marketplace remove webdesigner-repo-marketplace
```

The first command removes the plugin. The second removes its marketplace source; omit it if you want to keep receiving WebDesigner updates.

## Architecture

WebDesigner coordinates six lifecycle stages through structured intent, stack-selection, and artifact-manifest contracts:

1. Plan: normalize the request and choose a supported stack.
2. Design: establish the visual thesis, content structure, tokens, and interaction approach.
3. Build: generate framework-idiomatic implementation artifacts.
4. Security: validate findings and produce reviewable remediation.
5. Review: check behavior, accessibility, design coherence, and handoff completeness.
6. Deploy: prepare deployment guidance for the selected stack.

Model and provider selection remains capability-based. Roles are not permanently bound to one vendor or model.

## Repository structure

| Path | Purpose |
| --- | --- |
| `.codex-plugin/plugin.json` | Plugin identity and bundled component manifest |
| `.agents/plugins/marketplace.json` | Public repository marketplace catalog |
| `.mcp.json` | Installed WebDesigner MCP server configuration |
| `skills/webdesigner-design-system/` | Nightglass, conditional 3D references, tokens, and Blender setup resources |
| `skills/animate-ui/` | Conditional Animate UI registry workflow for animated React interfaces |
| `skills/blender-*/`, `skills/rigging-animation/` | Source-pinned Blender specialists |
| `skills/` | Discoverable design, Blender, planning, design-provider, build, security, and deployment workflows |
| `.antigravity/skills/` | Maintained source copies used by the orchestration runtime |
| `.antigravity/runtime/` | Routing policies, schemas, catalogs, and handoff contracts |
| `src/` | TypeScript CLI and MCP source |
| `dist/mcp/server.js` | Self-contained installed MCP runtime |
| `scripts/verify-package.mjs` | Manifest, skill, token, installer, and source-pin verification |

## Development

```bash
npm ci
npm run build
npm run verify
npm run test:mcp
npm audit --audit-level=high
```

The build compiles the TypeScript sources and bundles the MCP server with its runtime dependencies. `npm run verify` validates plugin and marketplace wiring, all discovered skill manifests and links, the 86-token CSS/Tailwind contract, installer commands, and third-party source pins. `npm run test:mcp` performs a real MCP initialize and tool-list exchange against the bundled server.

## Third-party notices

Blender specialist provenance, license notices, and the pinned Blender MCP add-on hash are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). No Blender binary, demo model, texture, motion, voice, or provider credential is distributed with this repository.
