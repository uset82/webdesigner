---
name: framework-selector
description: Produces a layered stack selection for the curated WebDesigner v1 support matrix. Use this before any scaffolding or code generation.
---
# Framework Selector

## Contract
- **Stage**: `plan`
- **Input schema**: `.antigravity/runtime/schemas/task-intent.schema.json`
- **Output schema**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Reads**: `.antigravity/runtime/stack-catalog.json`
- **Emits artifacts**: `stack-selection`, `decision-log`

## Purpose
This skill no longer chooses a single mixed "framework" label. It resolves a request into:
- `experience type`
- `frontend runtime`
- `backend runtime`
- `data layer`
- `deployment target`
- `design provider`
- `optional integrations`

## V1 Scope
Keep selections inside the curated support matrix:
- `Next.js`
- `React/Vite`
- `Flutter`
- `Node/Express`

Supporting layers such as Prisma, MongoDB, MySQL, and Google Maps may be attached as integrations when the prompt requires them.

## Process
1. Normalize the user request into a `TaskIntent`.
2. Map constraints to an `experience type`.
3. Resolve each stack layer independently using `references/FRAMEWORKS.md` and `assets/decision-tree.md`.
4. Record rationale and fallbacks in the emitted artifacts.
5. Hand off to `project-scaffolder` once the layered selection is complete.
