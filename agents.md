# Project Agents

WebDesigner uses stable workflow roles, but model assignment is dynamic. Agents own stages and artifacts. The routing policy chooses the actual provider and model at runtime.

## Core Rule
- Roles are **not** hard-bound to Gemini, Claude, Codex, Qoder, or any single provider.
- Each role declares required capabilities. Runtime selection happens through `.antigravity/runtime/provider-registry.json` and `.antigravity/runtime/routing-policy.json`.
- For visually led frontend work, agents must also follow the constraints in `openaidesign.md` and may attach the installed `frontend-skill` as an overlay on the stage contract.

## 1. Architect Agent
**Stage ownership**: `plan`

**Responsibilities**:
- Normalize a user request into `TaskIntent`
- Produce a layered `StackSelection`
- Choose the initial execution path inside the curated v1 support surface
- Write decision rationale into the `ArtifactManifest`

**Required capabilities**:
- High reasoning
- Strong structured output
- Tool use

## 2. Designer Agent
**Stage ownership**: `design`

**Responsibilities**:
- Use the configured `DesignProvider`
- Default to Stitch when available
- Start frontend design work with a visual thesis, content plan, and interaction thesis when the request is design-led
- Produce a clear design system and narrative structure before code handoff
- Prefer uploaded or generated imagery over hotlinked web assets unless the user explicitly asks otherwise
- Fall back to a design brief, token outline, component inventory, and optional mood board/motion plan when Stitch is unavailable
- Emit design artifacts that a different model can convert into code later

**Required capabilities**:
- Vision or UI reasoning
- Tool use
- Optional image generation

## 3. Builder Agent
**Stage ownership**: `build`

**Responsibilities**:
- Scaffold the generated workspace in the selected stack
- Convert approved design artifacts into framework-idiomatic code
- Preserve brand hierarchy, restrained section structure, dominant imagery, and intentional motion from the design artifacts
- Apply the `animate-ui` skill when the stack selection includes that integration; keep registry installs scoped to the generated React workspace
- Apply the `img2threejs` skill when the stack selection includes that integration; run forge scripts from the skill root and emit the Three.js factory only into the generated workspace
- Inspect rendered frontend work across desktop and mobile viewports when browser tooling is available
- Keep the control plane separate from the generated project
- Emit implementation artifacts and workspace paths into the `ArtifactManifest`

**Required capabilities**:
- Strong coding
- Tool use
- Reliable structured output

## 4. Security Agent
**Stage ownership**: `security`

**Responsibilities**:
- Build a threat model for the generated workspace and its configured stack
- Validate security findings before surfacing them as actionable issues
- Produce patch proposals and remediation notes for human review
- Record security artifacts in the `ArtifactManifest`

**Required capabilities**:
- High security analysis
- Strong reasoning
- Tool use

## 5. Reviewer Agent
**Stage ownership**: `review`

**Responsibilities**:
- Validate behavior, accessibility, framework conventions, brand hierarchy, and release readiness
- Confirm the first viewport remains coherent on desktop and mobile and that hero/header composition is not overcrowded
- Check rendered UI with browser-style verification when tooling is available
- Ensure generated outputs stay inside v1 support boundaries
- Confirm the `ArtifactManifest` is sufficient for a handoff or resume

**Required capabilities**:
- Strong reasoning
- Strong code review
- Optional vision for UI review

## 6. Deploy Agent
**Stage ownership**: `deploy`

**Responsibilities**:
- Select the right deployment target for the chosen stack
- Generate deployment artifacts for the generated workspace
- Preserve the boundary between Antigravity host concerns and deployable app concerns

**Required capabilities**:
- Tool use
- Infra reasoning
- Configuration generation
