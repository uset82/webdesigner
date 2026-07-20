# WebDesigner Runtime Spec

## Purpose
WebDesigner is an Antigravity-hosted control plane that coordinates planning, design, build, security, review, and deployment for generated applications. The control plane is stable. Generated workspaces are variable.

## Architecture Layers

### 1. Host Adapter
Responsible for:
- Antigravity planning and review loops
- browser and tool access
- host-specific execution semantics
- UI and logs for model handoffs

The host adapter may depend on Antigravity. The orchestration core may not.

### 2. Orchestration Core
Responsible for:
- normalizing requests into `TaskIntent`
- selecting a layered stack via `StackSelection`
- choosing providers and models using capability-first routing
- executing skill contracts
- recording handoff state in `ArtifactManifest`

### 3. Generated Workspace
Responsible for:
- housing the scaffolded app or service
- containing framework-specific code
- receiving deploy configs for the generated stack

The generated workspace is not the control plane.

## Core Flow
1. Intake: normalize the user request into `TaskIntent`.
2. Planning: emit `StackSelection` and decision artifacts.
3. Routing: resolve provider and model per stage through `routing-policy.json` plus `provider-registry.json`.
4. Design: call the configured `DesignProvider`, define the design system, and capture any required mood board, content plan, or motion plan.
5. Build: scaffold the generated workspace, implement code, and verify rendered frontend work when a browser-style tool loop is available.
6. Security: build a threat model, validate findings, and record patch proposals.
7. Review: validate quality, accessibility, brand hierarchy, release readiness, and manifest completeness.
8. Deploy: generate deployment artifacts for the chosen runtime.

## V1 Support Boundary
- `seo-fullstack-web` -> Next.js
- `spa-web` -> React/Vite
- `cross-platform-mobile` -> Flutter
- `api-backend` -> Node/Express

Supporting layers:
- `prisma`
- `mongodb`
- `mysql`
- `google-maps`
- `animate-ui` (optional component registry when `requiresAnimatedUI` is true)
- `img2threejs` (optional image-to-Three.js pipeline when `requiresImageToThreeJS` is true)

These are integrations or data layers, not primary runtime choices.

## Routing Principles
- Prefer capability match over vendor preference.
- Enforce tool access as a hard requirement.
- Respect user overrides when they do not violate hard stage constraints.
- Use configured fallbacks rather than implicit vendor swaps.

## Design Provider Principles
- Default provider is Stitch.
- Stitch configuration lives in `design-providers.json`.
- Design-stage routing uses the same capability-first policy as all other stages.
- Missing Stitch access must still produce portable design artifacts.

## Frontend Experience Principles
- For visually led landing pages and branded surfaces, establish a visual thesis, content plan, and interaction thesis before implementation.
- The first viewport should read as one composition with strong brand presence and one dominant visual anchor.
- Use uploaded or generated imagery first. Do not depend on hotlinked web images unless the user explicitly requests them.
- When the active model exposes configurable reasoning, start simple frontend work at lower reasoning and increase only when the interaction or information architecture requires it.
- When browser, computer-use, or similar tooling is available, verify desktop/mobile rendering, hero/header fit, overlap, and interaction quality before final handoff.

## Security Principles
- Default security provider path is Codex Security when available.
- Security runs as its own stage, not as a footnote inside generic review.
- Security outputs must include a threat model and validated findings.
- Patch proposals must be reviewable and recorded in the manifest.

## Handoff Principles
- Every completed stage updates the `ArtifactManifest`.
- A handoff is valid only if the next model can continue from the manifest plus saved artifacts.
- The system must not depend on hidden provider context.
