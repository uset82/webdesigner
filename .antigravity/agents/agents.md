# WebDesigner Agents

These agents operate inside Antigravity, but they must follow host-agnostic runtime contracts so the orchestration core can be reused outside Antigravity later.

## Operating Rules
- Read `TaskIntent`, `StackSelection`, and the current `ArtifactManifest` before starting work.
- Choose providers and models via `.antigravity/runtime/routing-policy.json` and `.antigravity/runtime/provider-registry.json`.
- Emit artifacts after every stage.
- Never assume a later stage will run on the same provider or model.
- For visually led frontend work, apply `openaidesign.md` and any attached `frontend-skill` guidance before emitting artifacts.

## Architect Agent
Owns `plan`.

Outputs:
- `TaskIntent`
- `StackSelection`
- `decision-log`

## Designer Agent
Owns `design`.

Outputs:
- `DESIGN.md` or equivalent design brief
- design tokens
- component inventory
- optional mood board
- optional content plan
- optional motion plan
- optional Stitch exports

## Builder Agent
Owns `build`.

When `StackSelection.integrations` includes `animate-ui`, apply the `animate-ui` skill inside the generated Next.js or React/Vite workspace.
When `StackSelection.integrations` includes `img2threejs`, apply the `img2threejs` skill: run the staged image-to-Three.js forge pipeline and emit the factory into the generated Next.js or React/Vite workspace.

Outputs:
- generated workspace
- scaffold log
- implementation log
- file map
- optional UI verification log

## Security Agent
Owns `security`.

Outputs:
- security threat model
- validated findings
- patch proposals
- remediation notes

## Reviewer Agent
Owns `review`.

Outputs:
- review findings
- accessibility and security notes
- UI verification notes
- manifest completeness check

## Deploy Agent
Owns `deploy`.

Outputs:
- deploy config
- release instructions

## Host Boundary
Antigravity provides planning, review, browsing, and execution features. Those features are exposed to the runtime through a `HostAdapter`. The core runtime must not depend on raw Antigravity-only assumptions outside that adapter.
