---
name: project-scaffolder
description: Creates the generated workspace for a selected stack. Use after the plan stage has emitted a valid StackSelection.
---
# Project Scaffolder

## Contract
- **Stage**: `build`
- **Input schema**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Companion input**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Reads**: `references/TEMPLATES.md`
- **Emits artifacts**: `workspace-layout`, `scaffold-log`

## Rules
- The generated workspace is separate from the control plane repository.
- Only scaffold inside the selected v1 stack matrix.
- Persist the workspace path, commands used, and initialization result in the manifest.

## Process
1. Read the `StackSelection`.
2. Choose the scaffold command from `references/TEMPLATES.md`.
3. Create the generated workspace non-interactively when possible.
4. Emit `workspace-layout` and `scaffold-log`.
5. Hand off to `code-generator`.
