---
name: code-generator
description: Converts approved design artifacts into idiomatic code inside the generated workspace selected by the plan stage.
---
# Code Generator

## Contract
- **Stage**: `build`
- **Reads**: design artifacts, `StackSelection`, workspace path
- **References**: `references/PATTERNS.md`
- **Emits artifacts**: `implementation-log`, `file-map`, optional `ui-verification-log`

## Rules
- Implement inside the generated workspace, not in the control plane.
- Respect the selected frontend and backend runtimes.
- Use the manifest to describe file ownership and handoff points.
- Preserve the design-system tokens, visual hierarchy, and motion intent captured by the design artifacts.
- Prefer local, uploaded, or generated visual assets over remote hotlinks unless the user explicitly wants external image URLs.
- When the task is a design-led frontend, keep the first viewport restrained: no hero cards by default, no cluttered overlays, and no weak brand hierarchy.
- When browser or computer-use tooling is available, inspect the rendered UI across desktop and mobile before handoff.

## Process
1. Read the design artifacts and current `ArtifactManifest`, including any mood board, content plan, or motion plan.
2. Apply framework-specific patterns from `references/PATTERNS.md`.
3. Generate code in the selected workspace.
4. Verify the rendered result when a frontend surface exists: check desktop/mobile viewports, content overlap, CTA reachability, navigation or state flow, and motion behavior.
5. Emit an implementation log, file map, and `ui-verification-log` when verification was performed.
