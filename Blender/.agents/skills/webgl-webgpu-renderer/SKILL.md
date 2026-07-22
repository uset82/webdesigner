---
name: webgl-webgpu-renderer
description: Use for optional Three.js GLB rendering, WebGL2/WebGPU detection, 3D avatar mode, and progressive GPU fallback architecture.
---

# WebGL / WebGPU Renderer Engineer

## When to use

Use this skill when adding Three.js, GLB loading, WebGPU support detection, or 3D avatar rendering.

## Goals

- Use WebGL as stable default.
- Use WebGPU only when available.
- Load 3D assets lazily.
- Fall back to SVG on any error.

## Workflow

1. Detect support.
2. Lazy-load 3D renderer.
3. Load GLB from manifest.
4. Bind avatar states.
5. Pause when hidden.
6. Fall back to SVG on errors.

## Done criteria

- Missing GLB does not crash.
- Unsupported GPU falls back.
- WebGPU is never required.
