---
name: web-shader-extractor
description: Extracts WebGL shaders, Canvas effects, and interactive WebGL pipelines from live websites using Chrome DevTools MCP, and ports them to standalone projects.
---
# Web Shader Extractor

## Contract
- **Stage**: `design`, `build`
- **Input schema**: `.antigravity/runtime/schemas/task-intent.schema.json`
- **Output schema**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Emits artifacts**: `shader-source`, `render-pipeline`, `standalone-webgl-reproduction`

## Rules
- Perform a read-only capture. Do not disrupt or modify target site functionality during extraction.
- Extract fragment and vertex shader sources, active uniform structures, texture inputs, and render state variables.
- Recreate the shader effects as a 1:1 standalone reproduction first. Do not optimize, refactor, or strip libraries until a fully functioning 1:1 baseline is achieved.
- Maintain correct canvas responsiveness, scroll-linked handlers, and viewport scaling in the final output.
- When browser verification is active, visually cross-check the reproduced canvas side-by-side with screenshots of the target site.

## Process
- **Intake**: Identify the target web page URL and target WebGL canvas/interactive layer.
- **Interception**: Open the target page in a browser session, injecting WebGL interceptors via Chrome DevTools MCP to capture compiling shader code and active render loop uniforms.
- **Extraction**: Log shader source code (vertex, fragment, compile logs), active parameters (uniforms, attributes), and associated layout or scroll-event tracking.
- **Scaffolding & Porting**: Build a clean standalone HTML/JS project container in the workspace using the identical shader sources and matching render configuration (using Three.js, vanilla WebGL, or the original frameworks).
- **Verification**: Run a local preview, inspect rendering outcomes, and verify that animations, responsiveness, and shaders function as expected.
- **Handoff**: Emit the extracted code artifacts and record details (including shader dependencies, structures, and controllers) to the `ArtifactManifest`.
