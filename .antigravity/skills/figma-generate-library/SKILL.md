---
name: figma-generate-library
description: "Build or update a professional-grade design system in Figma from a codebase. Use when the user wants to create variables/tokens, build component libraries, create individual components with proper variant sets and variable bindings, set up theming (light/dark modes), document foundations, or reconcile gaps between code and Figma. Also use when the user asks to create or generate any component in Figma — even a single one — since components require proper variable foundations, variant states, and design token bindings to be production-quality. This skill teaches WHAT to build and in WHAT ORDER — it complements the `figma-use` skill which teaches HOW to call the Plugin API. Both skills should be loaded together."
disable-model-invocation: false
---

# Design System Builder — Figma MCP Skill

Build professional-grade design systems in Figma that match code. This skill orchestrates multi-phase workflows across 20–100+ `use_figma` calls, enforcing quality patterns from real-world design systems (Material 3, Polaris, Figma UI3, Simple DS).

**Prerequisites**: The `figma-use` skill MUST also be loaded for every `use_figma` call. It provides Plugin API syntax rules (return pattern, page reset, ID return, font loading, color range). This skill provides design system domain knowledge and workflow orchestration.

**Always include `figma-generate-library` in the comma-separated `skillNames` parameter when calling `use_figma` as part of this skill. If this skill was loaded via an MCP resource, you MUST prefix the name with `resource:` (e.g. `resource:figma-generate-library`).** This is a logging parameter — it does not affect execution.

---

## 1. The One Rule That Matters Most

For every phase, follow this communication contract.

Before starting a phase:
- Post a user-facing checklist titled `Phase N Checklist`.
- Include every task/subtask that will be attempted in that phase.
- Include the phase exit criteria.
- Do not begin mutating work for the phase until this checklist has been posted.
- If the phase requires explicit approval, ask for approval after the checklist and wait.

During execution:
- Before each major subsection, post a short update naming the exact section being worked on, using this format:
  `Working on Phase N.X: <section name>`
- Keep updates concise, but make the current work visible.
- When a subsection completes, mark it as completed in the running checklist if the interface supports checklist/status updates; otherwise mention completion in the next progress update.

At the end of each phase:
- Post a `Phase N Summary` with:
  - Completed tasks
  - Created or changed Figma objects
  - Validations performed
  - Decisions or conflicts resolved
  - Remaining risks or follow-ups
- Then show the required phase artifact for that phase and continue automatically.
- Only ask for explicit approval after Phase 0 or if a genuine decision fork arises (see [Section 6](#6-decision-forks)). For Phases 1–4, the default is to continue automatically after the summary.

### Stable Task IDs

Use one task ID format everywhere: `P{phase}.{step}`.

Rules:
- Use lettered step IDs only: `P0.a`, `P0.b`, `P1.a`, `P3.d`.
- Do not use plain bullet points for task lists.
- Every phase checklist, progress update, validation note, and phase summary MUST reference the same task IDs

**No setup exception:** Creating a new Figma file, importing a library, creating pages, variables, collections, styles, or components all count as creation/mutation. Do not treat any of them as harmless setup.

**This is NEVER a one-shot task.** Building a design system requires 20–100+ `use_figma` calls across multiple phases, with mandatory progress between them. Any attempt to create everything in one call WILL produce broken, incomplete, or unrecoverable results. Break every operation to the smallest useful unit, validate, get feedback, proceed.

---

## 2. Mandatory Workflow

Work through the phases in order. Do not move to the next phase until the current phase's required actions and acceptance checks are complete. If a phase cannot pass, stop and report the blocker. Do not approximate, skip, or defer a failed phase unless the user explicitly approves the limitation. No best-effort substitutions. No quiet approximations. No handoff with missing source truth, missing visual truth, fake assets, approximate typography, broken interactions, or unverified states.

### Phase 0: DISCOVERY (always first — no `use_figma` writes yet)

- [ ] 0a. Analyze codebase → extract tokens, components, naming conventions
- [ ] 0b. Inspect Figma file → pages, variables, components, styles, existing conventions
- [ ] 0c. Search subscribed libraries → use `search_design_system` for reusable assets
- [ ] 0d. Lock v1 scope → exact token set + component list recorded before any creation
- [ ] 0e. Map code → Figma → every conflict (code disagrees with Figma) resolved and recorded
- [ ] 0f. Print a **gap analysis** to chat: what exists in code but not Figma, what exists in Figma but not code, and every conflict from 0e with its resolution

### Phase 1: FOUNDATIONS (tokens first — always before components)

- [ ] 1a. Create variable collections and modes
- [ ] 1b. Create primitive variables (raw values, 1 mode)
- [ ] 1c. Create semantic variables (aliased to primitives, mode-aware)
- [ ] 1d. Set scopes on ALL variables (never `ALL_SCOPES`)
- [ ] 1e. Set code syntax on ALL variables
- [ ] 1f. Create effect styles (shadows) and text styles (typography)
- [ ] 1g. Print a **variable summary** to chat: N collections, M variables, K modes, broken down by collection
- [ ] 1h. Print the **style list** to chat: every effect style and text style created, with names
- [ ] Exit criteria met: every token from the agreed plan exists, all scopes set, all code syntax set

### Phase 2: FILE STRUCTURE (before components)

- [ ] 2a. Create page skeleton: Cover → Getting Started → Foundations → --- → Components → --- → Utilities
- [ ] 2b. Create foundations documentation pages (color swatches, type specimens, spacing bars)
- [ ] 2c. Capture a `get_screenshot` of every foundations page and print the **page list** to chat alongside the screenshots
- [ ] Exit criteria met: all planned pages exist, foundations docs are navigable

### Phase 3: COMPONENTS (one at a time — never batch)

For EACH component (in dependency order: atoms before molecules), run the checklist below. Finish the current component before starting the next.

- [ ] 3a. Create dedicated page
- [ ] 3b. Build base component with auto-layout + full variable bindings
- [ ] 3c. Create all variant combinations (`combineAsVariants` + grid layout)
- [ ] 3d. Add component properties (TEXT, BOOLEAN, INSTANCE_SWAP)
- [ ] 3e. Link properties to child nodes
- [ ] 3f. Add page documentation (title, description, usage notes)
- [ ] 3g. Validate: `get_metadata` (structure) + `get_screenshot` (visual)
- [ ] 3h. Optional: lightweight Code Connect mapping while context is fresh
- [ ] Exit criteria met: variant count correct, all bindings verified, screenshot looks right

### Phase 4: INTEGRATION + QA (final pass)

- [ ] 4a. Finalize all Code Connect mappings
- [ ] 4b. Accessibility audit (contrast, min touch targets, focus visibility)
- [ ] 4c. Naming audit (no duplicates, no unnamed nodes, consistent casing)
- [ ] 4d. Unresolved bindings audit (no hardcoded fills/strokes remaining)
- [ ] 4e. Final review screenshots of every page

---

## 3. Critical Rules

**Plugin API basics** (from use_figma skill — enforced here too):
- Use `return` to send data back (auto-serialized). Do NOT wrap in IIFE or call closePlugin.
- Return ALL created/mutated node IDs in every return value
- Page context resets each call — always `await figma.setCurrentPageAsync(page)` at start. **Call it at most once per script**: each component or doc page is its own `use_figma` call. Never loop over `figma.root.children` and switch pages inside a mutating script — split that work into one focused call per target page (see [figma-use → gotchas.md → Set current page once per `use_figma` call](../figma-use/references/gotchas.md#set-current-page-once-per-use_figma-call--split-multi-page-work-across-calls))
- `figma.notify()` throws — never use it
- Colors are 0–1 range, not 0–255
- Font MUST be loaded before any text write: `await figma.loadFontAsync({family, style})`. Use `await figma.listAvailableFontsAsync()` to discover available fonts and verify exact style strings — if a load fails, query available fonts to find the correct name or a fallback.

**Design system rules**:
1. **Variables BEFORE components** — components bind to variables. No token = no component.
2. **Inspect before creating** — run read-only `use_figma` to discover existing conventions. Match them.
3. **One page per component** *(default)* — exception: tightly related families (e.g., Input + helpers) may share a page with clear section separation.
4. **Bind visual properties to variables** *(default)* — fills, strokes, padding, radius, gap.
