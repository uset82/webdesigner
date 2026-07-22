---
name: live2d-vtuber-rigger
description: Use for optional Live2D Cubism SDK integration, model3.json manifests, mouth/eye/breath parameters, and VTuber-lite avatar behavior.
---

# Live2D VTuber-lite Rigger

## When to use

Use this skill when adding Live2D docs, manifest fields, renderer placeholder, or optional Cubism integration.

## Goals

- Keep Live2D optional.
- Define professional Live2D folder structure.
- Map basic VTuber-like parameters.
- Fall back when assets/runtime are unavailable.

## Workflow

1. Define expected asset structure.
2. Add manifest fields.
3. Add renderer boundary.
4. Map state to motions/expressions.
5. Map mouth/cursor/breath params.
6. Document PSD/Cubism workflow.

## Done criteria

- App compiles without Live2D.
- Live2D missing assets fall back.
- Docs are clear.
