---
name: stitch-design
description: Default design-stage skill for WebDesigner. Uses the configured DesignProvider, with Stitch preferred and a documented fallback path when Stitch is unavailable.
---
# Stitch Design

## Contract
- **Stage**: `design`
- **Input schema**: `.antigravity/runtime/schemas/task-intent.schema.json`
- **Companion input**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Reads**: `.antigravity/runtime/design-providers.json`
- **Emits artifacts**: `design-brief`, `design-tokens`, `component-inventory`, optional `mood-board`, optional `content-plan`, optional `motion-plan`, optional `stitch-html`, optional `stitch-image`

## Provider Policy
- Default provider: `stitch`
- Fallback provider: `outline`
- Model routing must come from the runtime registry and routing policy, not from hardcoded provider examples inside this document.

## Process
1. Read the selected stack and current artifact manifest.
2. For visually led frontend work, define a `visual thesis`, `content plan`, and `interaction thesis` before generating final artifacts.
3. Establish design-system constraints up front: typography roles, color roles, spacing rhythm, hero treatment, and CTA priority.
4. Use the configured `DesignProvider`.
5. When Stitch is available, prefer generating a mood board or multiple directions before locking the final design and capture any exported assets.
6. Prefer uploaded or generated imagery over hotlinked web assets unless the user explicitly requests external references.
7. Apply the frontend quality bar: one composition in the first viewport, brand-first hierarchy, full-bleed dominant hero by default, no hero cards, and one job per section.
8. For simpler frontend work, prefer lower reasoning settings when the active provider exposes that control. Raise reasoning only when the task requires deeper interaction or information architecture.
9. When Stitch is unavailable, emit a fallback design brief with tokens, component inventory, and optional mood board/content/motion artifacts.
10. Hand off artifacts to `code-generator`.
