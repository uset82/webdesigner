# Agent Skills

WebDesigner skills are stage contracts, not vendor-specific prompt bundles. Each skill must declare its inputs, outputs, preconditions, postconditions, and emitted artifact types.

## Source of Truth
- Skill metadata lives in `.antigravity/runtime/skill-contracts.json`.
- Shared interfaces live in `.antigravity/runtime/INTERFACES.md`.
- Machine-readable schemas live in `.antigravity/runtime/schemas/`.

## V1 Skills

### `framework-selector`
- **Stage**: `plan`
- **Role**: Produces a layered `StackSelection` for the curated v1 stack matrix
- **Inputs**: `TaskIntent`
- **Outputs**: `StackSelection`
- **Artifacts**: `stack-selection`, `decision-log`

### `stitch-design`
- **Stage**: `design`
- **Role**: Invokes the default `DesignProvider` and produces a portable design artifact set
- **Inputs**: `TaskIntent`, `StackSelection`, optional prior `DESIGN.md`
- **Outputs**: design bundle
- **Artifacts**: `design-brief`, `design-tokens`, `component-inventory`, optional `mood-board`, optional `content-plan`, optional `motion-plan`, optional `stitch-html`, optional `stitch-image`

### `project-scaffolder`
- **Stage**: `build`
- **Role**: Creates the generated workspace for a selected stack
- **Inputs**: `StackSelection`, existing `ArtifactManifest`
- **Outputs**: scaffolded workspace path and command log
- **Artifacts**: `workspace-layout`, `scaffold-log`

### `code-generator`
- **Stage**: `build`
- **Role**: Turns approved design artifacts into idiomatic code inside the generated workspace
- **Inputs**: design artifacts, `StackSelection`, workspace path
- **Outputs**: implemented files and implementation summary
- **Artifacts**: `implementation-log`, `file-map`, optional `ui-verification-log`

### `security-audit`
- **Stage**: `security`
- **Role**: Builds a threat model, validates findings, and records patch proposals for the generated workspace
- **Inputs**: `StackSelection`, existing `ArtifactManifest`, workspace path
- **Outputs**: validated security findings and remediation proposals
- **Artifacts**: `security-threat-model`, `validated-finding`, `security-patch`

### `deploy-advisor`
- **Stage**: `deploy`
- **Role**: Maps the chosen stack to a supported deployment target and emits deployment config
- **Inputs**: `StackSelection`, workspace path
- **Outputs**: deploy config and release notes
- **Artifacts**: `deploy-config`, `deploy-instructions`

## Global Optional Skills

### `animate-ui`
- **Stage**: `build`
- **Role**: Adds selected animated React components from the `imskyleen/animate-ui` Shadcn registry when animated interface behavior is requested
- **Inputs**: `TaskIntent`, `StackSelection`, motion plan, generated Next.js or React/Vite workspace
- **Outputs**: installed component map and normal/reduced-motion verification log
- **Notes**: Activates through the `requiresAnimatedUI` constraint and `animate-ui` stack integration; it is not used for video, Flutter, or WebGL-only animation.

### `img2threejs`
- **Stage**: `build`
- **Role**: Rebuilds a reference object or character image as a quality-gated, animation-ready procedural Three.js model using staged sculpt passes and vision review
- **Inputs**: `TaskIntent`, `StackSelection`, reference image path, generated Next.js or React/Vite workspace
- **Outputs**: `ObjectSculptSpec`, TypeScript Three.js factory, review log, and optional comparison sheets
- **Notes**: Activates through the `requiresImageToThreeJS` constraint and `img2threejs` stack integration. Scripts live under `.antigravity/skills/img2threejs/forge` (Python 3.10+ stdlib). Three.js is installed only in the generated workspace. Not used for Flutter, photogrammetry meshes, or pure CSS motion.

### `frontend-skill`
- **Stages**: `design`, `build`, `review`
- **Role**: Enhances frontend visual steering and visual consistency using Anthropic's frontend-design structure and Leonxlnx's taste dials
- **Inputs**: task brief, design tokens, active design layout
- **Outputs**: visual/narrative thesis, custom dial settings (Variance [1-10], Motion [1-10], Density [1-10]), and vibe profile (Minimalist, Editorial, SaaS, Brutalist, Retro-Futuristic, Soft)
- **Notes**: Steers models away from generic AI boilerplate patterns.

### `web-shader-extractor`
- **Stages**: `design`, `build`
- **Role**: Extracts WebGL shaders, Canvas effects, and interactive WebGL pipelines from live websites, and ports them to standalone projects
- **Inputs**: target web page URL, optional canvas or shader selector
- **Outputs**: shader source code, render parameters/uniforms, and standalone visual reproduction code
- **Notes**: Developed by motion designer Xiao Lin (`lixiaolin94/skills`). Complements visual design and build stages for high-fidelity WebGL/shader reconstruction.

### `remotion-video-generator`
- **Stages**: `build`, `deploy`
- **Role**: Programmatically constructs and compiles video assets and React-based animations using Remotion
- **Inputs**: composition settings, React timeline component, dynamic timing properties
- **Outputs**: registered compositions, video rendering logs, and standalone MP4/WebP/GIF assets
- **Notes**: Designed for code-driven programmatic animation delivery.

### `understand-anything`
- **Stages**: `plan`, `review`
- **Role**: Scans and builds codebase dependency maps and logical structure knowledge graphs
- **Inputs**: directory target, logical boundaries, codebase reference paths
- **Outputs**: codebase knowledge graph, file maps, call graphs, and logical architecture reports
- **Notes**: Based on Egonex-AI codebase tools, optimizing contextual parsing.

### `figma-implement-design`
- **Stages**: `design`, `build`
- **Role**: Translates Figma designs into production-ready application code with 1:1 visual fidelity using Figma MCP server data and screenshots
- **Inputs**: Figma URL or desktop node selection, design tokens
- **Outputs**: implemented UI files, code parity logs, and layout verification screenshots
- **Notes**: Bridges the gap between designer intent and frontend delivery.

### `blender-mcp`
- **Stages**: `design`, `build`
- **Role**: Creates, iterates, and exports 3D scenes in Blender via MCP with visual feedback loops for product visualization, interior concepts, motion design, and asset creation
- **Inputs**: scene description, reference images, quality requirements, generated Next.js or React/Vite workspace
- **Outputs**: Blender scene spec, render screenshots, review log, exported GLB/PNG assets
- **Notes**: Activates through the `requiresBlenderMCP` constraint and `blender-mcp` stack integration. Requires a running Blender instance with MCP addon on `localhost:9876`. Uses iterative build→render→inspect→fix workflow with vision model feedback. **Preferred model path: Codex / GPT-5.4** (routing skill override); other vision-capable models remain fallbacks. Exports assets to generated workspace or `.codex-avatar/exports/blender/`. Not used for CAD-precision parts or automated character rigging. Essay: `.antigravity/skills/blender-mcp/docs/codex-gpt-blender-mcp.md`.

Official Stitch-oriented, OpenAI-oriented, or community skills can be attached when they fit the active workflow, but they do not replace WebDesigner's stage contracts, routing policy, or artifact manifest.

