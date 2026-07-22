---
name: security-audit
description: Runs the dedicated security stage for generated workspaces. Default provider path is OpenAI Codex Security when available, with generic model fallback routed by capability.
---
# Security Audit

## Contract
- **Stage**: `security`
- **Input schema**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Companion input**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Reads**: `references/CODEX-SECURITY.md`
- **Emits artifacts**: `security-threat-model`, `validated-finding`, `security-patch`, `remediation-note`

## Provider Policy
- Default provider path: `codex-security`
- Fallback path: capability-routed review models when Codex Security is unavailable
- Security outputs must be explicit and reviewable. Do not assume automatic fixes are applied.

## Process
1. Read the generated workspace, current `ArtifactManifest`, and selected stack.
2. Build a threat model for the active architecture and integrations.
3. Validate security findings before recording them as artifacts.
4. Emit patch proposals and remediation notes for human review.
5. Hand off to the general `review` stage.
