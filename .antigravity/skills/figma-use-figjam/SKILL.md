---
name: figma-use-figjam
description: "This skill helps agents use Figma's use_figma MCP tool in the FigJam context. Can be used alongside figma-use which has foundational context for using the use_figma tool."
disable-model-invocation: false
---

# use_figma — Figma Plugin API Skill for FigJam

This skill contains FigJam-specific context for the `use_figma` MCP tool. The [figma-use](../figma-use/SKILL.md) skill provides foundational context for plugin API execution via MCP as well as the full Figma plugin API for more advanced use-cases that are not described here.

**Always include `figma-use-figjam` in the comma-separated `skillNames` parameter when calling `use_figma` for FigJam operations. If this skill was loaded via an MCP resource, you MUST prefix the name with `resource:` (e.g. `resource:figma-use-figjam`).** This is a logging parameter used to track skill usage — it does not affect execution.

> **FigJam URL is `figma.com/board/...`.** Do NOT call `figma.createPage()` in FigJam — it throws `TypeError: figma.createPage no such property 'createPage' on the figma global object`. `createPage()` is a Design-file API only (`figma.com/design/...`). FigJam files have a single implicit page; organize content with sections instead.

## Inspecting FigJam Files

**`get_figjam` is the inspection tool for FigJam files.** It returns the full node tree as XML, including IDs of pages, sections, stickies, connectors, and other nodes you need to reference in subsequent `use_figma` calls.

- **Use `get_figjam` upfront** before writing any `use_figma` code that needs to reference existing nodes (page IDs, section IDs, etc.). Don't try to discover IDs by running an inspection script — `console.log` output from `use_figma` is **not returned to the agent** (see [figma-use Critical Rule #4](../figma-use/SKILL.md)). Only the `return` value comes back.
- **`get_metadata` does NOT work on FigJam files** — it is design-mode only and will fail immediately with "unsupported for FigJam files".
- **`get_screenshot` requires a valid `nodeId`** — passing an empty nodeId returns "invalid nodeId" error. Get IDs from `get_figjam` first.
- If you forgot to `return` an ID from a previous `use_figma` call and need it now, call `get_figjam` rather than re-running an inspection script.

## Loading Reference Docs Efficiently

Load only the references your task needs — but when you do need to load multiple, **issue all reads in a single parallel tool-call batch**, not sequentially across turns. For a typical board-creation task, that means a single message containing reads for `plan-board-content` plus the 3-4 specific node-type references you'll use.
