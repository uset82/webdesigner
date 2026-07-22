# Codex Security Notes

OpenAI announced **Codex Security** in research preview on **March 6, 2026**. In WebDesigner it is modeled as the default provider path for the dedicated `security` stage.

## How WebDesigner Uses It
- Build a threat model for the generated workspace
- Validate findings before reporting them
- Produce patch proposals rather than assuming direct auto-remediation
- Emit portable artifacts that a later review model can inspect

## Runtime Rules
- Prefer Codex Security when it is available in the active environment.
- Fall back to capability-routed security-capable models when it is unavailable.
- Keep security artifacts in the `ArtifactManifest`.
- Treat proposed fixes as reviewable outputs, not silent mutations.
