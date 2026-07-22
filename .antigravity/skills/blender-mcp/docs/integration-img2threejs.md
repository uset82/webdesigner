# Blender MCP + img2threejs Integration

This document describes the handoff patterns between Blender MCP scene creation and the img2threejs procedural Three.js pipeline.

For the Codex / GPT product narrative (describe → build → screenshot → fix → export), see [codex-gpt-blender-mcp.md](./codex-gpt-blender-mcp.md).

## Overview

Blender MCP and img2threejs serve complementary roles:

| Capability | Blender MCP | img2threejs |
|------------|-------------|-------------|
| **Input** | Natural language description | Reference image |
| **Output** | GLB/PNG assets, scene files | TypeScript Three.js factory |
| **Strength** | Complex scenes, lighting, materials | Procedural code, animation-ready |
| **Iteration** | Viewport screenshots | Comparison sheets |
| **Export** | Static assets | Editable code |

## Integration Patterns

### Pattern 1: Blender Render → img2threejs Reference

Use Blender MCP to create a high-quality reference render, then feed it to img2threejs for procedural code generation.

**Flow:**
1. User describes product/scene
2. Blender MCP builds scene with proper lighting and materials
3. Export high-resolution render as PNG
4. img2threejs uses render as reference image
5. Generate procedural Three.js factory matching the render

**Use case:** When you need both a marketing render AND interactive web 3D.

```json
{
  "constraints": {
    "requiresBlenderMCP": true,
    "requiresImageToThreeJS": true
  },
  "integrations": ["blender-mcp", "img2threejs"]
}
```

### Pattern 2: Blender GLB → Three.js Wrapper

Export GLB from Blender, then generate a Three.js loader wrapper with img2threejs-style runtime hooks.

**Flow:**
1. Blender MCP builds and refines 3D scene
2. Export as optimized GLB
3. Generate TypeScript wrapper with:
   - GLTFLoader integration
   - Animation controls
   - Material overrides
   - sculptRuntime-compatible API

**Use case:** Complex scenes that cannot be rebuilt procedurally.

### Pattern 3: Hybrid Build

Use Blender MCP for hero objects and img2threejs for procedural details.

**Flow:**
1. Blender MCP creates main subject (e.g., product body)
2. Export as GLB
3. img2threejs generates procedural environment/effects
4. Compose in unified Three.js scene

**Use case:** Product on procedural background, character in generated environment.

## Artifact Handoff

### Blender MCP Outputs
```
.codex-avatar/exports/blender/
├── scene.render.png          # Reference for img2threejs
├── scene.webgl.glb           # For direct Three.js loading
├── scene.preview.png         # Thumbnail
└── scene.export-report.json  # Metadata
```

### img2threejs Inputs
```json
{
  "referenceImage": ".codex-avatar/exports/blender/scene.render.png",
  "targetWorkspace": "generated/my-project/",
  "factoryOutput": "src/three/createSceneModel.ts"
}
```

## Skill Contract Composition

When both skills are active, the ArtifactManifest tracks dependencies:

```json
{
  "artifacts": [
    {
      "artifactId": "blender-render-001",
      "stage": "build",
      "artifactType": "blender-render",
      "producer": {
        "skillId": "blender-mcp"
      },
      "path": ".codex-avatar/exports/blender/product.render.png"
    },
    {
      "artifactId": "threejs-factory-001",
      "stage": "build",
      "artifactType": "threejs-factory",
      "producer": {
        "skillId": "img2threejs"
      },
      "path": "src/three/createProductModel.ts",
      "dependsOn": ["blender-render-001"]
    }
  ]
}
```

## Quality Gates

### From Blender MCP
- Render matches user description (vision-verified)
- GLB exports are valid (header check)
- Scene complexity is appropriate for web delivery

### For img2threejs Handoff
- Reference image passes suitability validation
- Render resolution is sufficient for detail extraction
- Lighting does not obscure critical features

## Limitations

- Blender MCP creates assets; img2threejs creates code
- GLB files cannot be edited like procedural factories
- Complex Blender materials may not translate to real-time
- Animation timing in Blender differs from code-driven timing

## Example Combined Intent

```json
{
  "taskId": "product-hero-combined",
  "title": "Product page with Blender render and interactive 3D",
  "prompt": "Create a cinematic hero render of this wireless speaker in Blender with dramatic lighting, then generate an interactive Three.js version for the product page that users can rotate.",
  "constraints": {
    "requiresBlenderMCP": true,
    "requiresImageToThreeJS": true,
    "requiresVision": true
  }
}
```
