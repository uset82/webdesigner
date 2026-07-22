---
name: rive-animation-engineer
description: Use for Rive runtime integration, Rive state machine inputs, avatar state mapping, trigger mapping, and SVG fallback behavior.
---

# Rive Animation Engineer

## When to use

Use this skill for `RiveAvatarRenderer`, `.riv` manifest fields, state machine mapping, and animation state tests.

## Goals

- Use Rive as primary animated 2D runtime.
- Keep SVG fallback active.
- Map typed avatar states to Rive inputs.
- Avoid runtime crashes when `.riv` is missing.

## Workflow

1. Read manifest.
2. Load Rive lazily.
3. Map state input.
4. Map triggers.
5. Map cursor/mouth values.
6. Fall back on load error.

## Done criteria

- Missing `.riv` does not crash.
- State changes reach Rive.
- Trigger inputs work.
