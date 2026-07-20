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

## Figma Skills

### `figma-use`
- **Stages**: `design`, `build`, `review`
- **Role**: Foundational prerequisite for executing JavaScript in Figma files via the Plugin API
- **Inputs**: Plugin API script
- **Outputs**: Serialized return values, node IDs
- **Artifacts**: `figma-use-log`

### `figma-generate-design`
- **Stages**: `design`, `build`
- **Role**: Discovers design system components and tokens, importing them and assembling full pages/screens incrementally
- **Inputs**: Task brief, code, design system components
- **Outputs**: Composed Figma screen layouts
- **Artifacts**: `figma-design-brief`, `figma-design-tokens`, `figma-component-inventory`

### `figma-generate-library`
- **Stages**: `design`, `build`
- **Role**: Builds or updates design system component libraries, variables, tokens, and modes in Figma from code
- **Inputs**: Component specification, code tokens
- **Outputs**: Variables, component variant sets, bindings
- **Artifacts**: `figma-library-structure`, `figma-variable-summary`

### `figma-use-figjam`
- **Stages**: `design`, `build`
- **Role**: Specialized context and rules for FigJam board creation, section/sticky management, and tree-mapping
- **Inputs**: FigJam board description
- **Outputs**: Flowcharts, sections, sticky nodes, connectors
- **Artifacts**: `figma-figjam-log`

### `figma-use-slides`
- **Stages**: `design`, `build`
- **Role**: Specialized context and rules for Figma Slides deck creation, speaker notes, and parent-nested slide grids
- **Inputs**: Deck outline, speaker notes
- **Outputs**: Structured presentation slides
- **Artifacts**: `figma-slides-log`

## Global Optional Skills

### `frontend-skill`
- **Stages**: `design`, `build`, `review`
- **Role**: Adds art-direction, hierarchy, motion, and restraint rules for visually led frontend work
- **Inputs**: task brief, design artifacts, optional visual references or existing images
- **Outputs**: stronger visual thesis, content plan, interaction thesis, and section-level quality checks
- **Notes**: This skill complements `stitch-design` and `code-generator`; it does not replace WebDesigner's artifact and handoff contracts.

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
- **Notes**: Activates through the `requiresImageToThreeJS` constraint and `img2threejs` stack integration. Scripts live under `.antigravity/skills/img2threejs/forge` (Python 3.10+ stdlib) and are mirrored into `skills/img2threejs` for plugin discovery. Three.js is installed only in the generated workspace. Not used for Flutter, photogrammetry meshes, or pure CSS motion.

Official Stitch-oriented or OpenAI-oriented skills can be attached when they fit the active workflow, but they do not replace WebDesigner's stage contracts, routing policy, or artifact manifest.
