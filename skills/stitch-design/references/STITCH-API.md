# Design Provider Notes

This document describes the `DesignProvider` contract used by WebDesigner. Configuration for providers, auth variables, and runtime identifiers lives in `.antigravity/runtime/design-providers.json` and `.antigravity/runtime/provider-registry.json`.

## DesignProvider Responsibilities
- Accept a normalized `TaskIntent`
- Read the selected `StackSelection`
- Produce portable design artifacts
- Record outputs in the `ArtifactManifest`
- Degrade cleanly when the preferred provider is unavailable

## Default Provider
- **Provider id**: `stitch`
- **Fallback provider id**: `outline`

## Required Outputs
- `design-brief`
- `design-tokens`
- `component-inventory`
- optional `mood-board`
- optional `content-plan`
- optional `motion-plan`
- optional `stitch-html`
- optional `stitch-image`

## Runtime Rules
- Do not hardcode model ids in this document.
- Do not store auth requirements only in prose.
- Routing for design-stage models must flow through the capability-based routing policy.
- Fallback output must still be sufficient for a different model to generate code later.
- For visually led frontend work, the artifact set should capture visual direction, narrative structure, and motion intent in addition to tokens and inventory.
