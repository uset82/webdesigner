---
name: deploy-advisor
description: Selects a deployment target for the chosen stack and emits deployable configuration artifacts for the generated workspace.
---
# Deploy Advisor

## Contract
- **Stage**: `deploy`
- **Input schema**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Companion input**: generated workspace path and `ArtifactManifest`
- **Reads**: `references/PLATFORMS.md`
- **Emits artifacts**: `deploy-config`, `deploy-instructions`

## Rules
- Deployment choices are made for the generated workspace, not the control plane unless explicitly requested.
- Stay within the curated v1 deployment matrix.
- Record the chosen platform and generated files in the `ArtifactManifest`.
