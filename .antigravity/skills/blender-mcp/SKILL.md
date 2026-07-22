---
name: blender-mcp
description: Create, iterate, and export 3D scenes in Blender via MCP with visual feedback loops. Use for product visualization, interior concepts, motion design, hero renders, or when StackSelection includes the blender-mcp integration. Requires a running Blender instance with the MCP addon enabled.
license: MIT
version: 1.0.0
---

# blender-mcp — Blender Model Context Protocol Integration

Build, render, inspect, and fix 3D scenes in Blender through MCP tool calls with a visual
self-correction loop. The agent describes the scene, Blender creates it, the agent sees the
render, and corrections continue until the result matches the original intent.

**Primary path in WebDesigner: Codex / GPT-5.4** (vision + coding + tool use), routed via
`skillOverrides.blender-mcp` in `.antigravity/runtime/routing-policy.json`. Still host-portable:
Claude Code, Codex IDE, OpenCode, or WebDesigner can run the same MCP loop. Wherever this doc
says "viewport screenshot" or "agent vision", use whatever visual feedback the MCP server provides.

**Narrative / product essay:** [docs/codex-gpt-blender-mcp.md](./docs/codex-gpt-blender-mcp.md)

## WebDesigner Contract

- **Stage**: `design` (3D concept development), `build` (scene creation and iteration)
- **Reads**: `TaskIntent`, `StackSelection`, design brief, reference images, generated workspace
- **Emits artifacts**: `blender-scene-spec`, `blender-render`, `blender-review-log`, `exported-asset`
- **MCP dependency**: `blender` MCP server (via `uvx blender-mcp` or local addon)
- **Activation**: `StackSelection.integrations` contains `blender-mcp`, or `TaskIntent.constraints.requiresBlenderMCP` is true, or the user explicitly asks for Blender scene creation

### WebDesigner Rules

- Require a running Blender instance with the MCP addon connected on `localhost:9876`.
- Use only project-scoped MCP tools: `get_scene_info`, `get_object_info`, `get_screenshot`, `execute_blender_code`.
- Treat `execute_blender_code` as arbitrary local code execution; respect approval prompts when configured.
- Keep PolyHaven, Sketchfab, Hyper3D, Hunyuan, and other network-backed integrations disabled per project policy.
- Export GLB/PNG assets to `.codex-avatar/exports/blender/` or the generated workspace's asset directory.
- Work on explicit copies; never overwrite user-selected source scenes.
- Record render screenshots, comparison sheets, and export paths in the `ArtifactManifest`.

### WebDesigner Process

1. Confirm `integrations` contains `blender-mcp` or user explicitly requested Blender scene work.
2. Verify Blender MCP connection via `get_scene_info`.
3. Parse the user description into a scene specification (objects, materials, lighting, camera).
4. Follow the iterative build loop: create → render → inspect → fix.
5. Export final assets (GLB, PNG, optional blend) to the generated workspace.
6. Emit `blender-scene-spec`, `blender-render`, and `blender-review-log` artifacts.

## When To Use

- Product visualization: bottles, electronics, furniture, fictional devices
- Interior concepts: room layouts, furniture arrangements, lighting studies
- Motion design: procedural forms, extruded typography, geometric loops
- Hero renders: landing page backgrounds, marketing materials
- Asset creation: 3D props for web/game projects, WebGL/Three.js source assets
- Prototyping: quick 3D mockups before committing to detailed procedural code

## Core Promise

Build from description in stages — never attempt a complete scene in one prompt:

1. **Composition first**: Block out main objects, camera angle, basic layout.
2. **Materials and lighting**: Apply initial materials, establish lighting rig.
3. **Render and inspect**: Capture viewport/render, identify visible mismatches.
4. **Targeted corrections**: Adjust specific settings (camera, lighting, materials) based on inspection.
5. **Iterate**: Repeat render-inspect-fix until the result matches intent.

State explicitly when output is approximate or stylized. A single description cannot specify
every detail — ask for clarification instead of making arbitrary choices.

## Required Inputs

- Scene description (objects, mood, purpose, camera angle preferences)
- Output format: product shot, interior render, animated loop, exportable asset
- Quality level: quick prototype, polished render, production asset

## The Loop (MCP tools do execution; agent vision does judgment)

### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp__blender__get_scene_info` | Inspect current scene state |
| `mcp__blender__get_object_info` | Get details about specific objects |
| `mcp__blender__get_screenshot` | Capture viewport for visual feedback |
| `mcp__blender__execute_blender_code` | Run Python code against Blender's bpy API |

### Iteration Process

1. **Scene setup**: Create base geometry with `execute_blender_code`:
   ```python
   import bpy
   bpy.ops.mesh.primitive_cylinder_add(radius=0.7, depth=1.6)
   bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
   bpy.context.object.data.energy = 800
   bpy.ops.object.camera_add(location=(5, -6, 3))
   bpy.context.scene.camera = bpy.context.object
   ```

2. **Render capture**: Use `get_screenshot` to see current state.

3. **Visual inspection**: Analyze the screenshot with agent vision:
   - Is the subject framed correctly?
   - Are materials reading as intended?
   - Is lighting flattering or problematic?
   - Does composition match the description?

4. **Correction**: Issue targeted fixes based on inspection:
   - Camera too close? Increase distance, decrease focal length.
   - Harsh shadows? Soften light, adjust angle.
   - Material too shiny? Reduce roughness, check reflection.
   - Object hidden? Adjust position, check visibility.

5. **Record review**: Log the iteration with scores and decision:
   - `continue`: Result matches intent, proceed to next stage.
   - `refine-scene`: Adjustments needed, continue iteration.
   - `request-input`: Need clarification from user.
   - `stop`: Cannot achieve requested result, explain limitation.

## Gates (do not skip)

- **Connection check**: Verify Blender MCP is reachable before scene work.
- **Screenshot feedback**: Corrections must be based on actual render output, not assumptions.
- **User approval**: Major direction changes require confirmation.
- **Export validation**: Verify exported assets are valid (GLB header, PNG signature, file size).

## Limitations

- **Precision**: Blender MCP is good for visualization, not CAD-precision parts.
- **Topology**: Generated meshes may need cleanup for rigging/animation.
- **Organic modeling**: Characters and creatures require more iteration than products.
- **Animation timing**: Weight and timing require frame-by-frame review.
- **Taste**: The agent identifies mismatches but cannot guarantee aesthetic quality.

## Output

- **Renders**: PNG screenshots at configured resolution.
- **Exports**: GLB for Three.js/WebGL, optional blend file.
- **Artifacts**: Scene spec, review log, comparison sheets.
- **Not feasible**: When limitations prevent achieving the result, explain why and suggest alternatives.
