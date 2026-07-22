---
name: svg-vector-pipeline
description: Use for local image-to-SVG conversion, conservative SVG optimization, layer naming, manifest generation, and vector asset validation.
---

# SVG Vector Pipeline Engineer

## When to use

Use this skill for `packages/asset-pipeline`, SVG layer standards, image tracing, local SVG optimization, and avatar manifest generation.

## Goals

- Convert simple images to SVG locally.
- Optimize SVG safely.
- Validate animation-ready layer names.
- Warn on giant traces.
- Keep all processing local.

## Workflow

1. Validate input type.
2. Trace or process locally.
3. Optimize SVG.
4. Validate layer groups.
5. Generate manifest entry.
6. Show friendly warnings/errors.

## Cholita / mascot characters

Bitmap tracing is **not** enough for the Cholita / Skjermbilde mascot.

1. Keep the local PNG as visual reference only (prefer `.codex-avatar/`, never redistribute private source).
2. Author or update named layers in `LayeredMascotRenderer` (code-native SVG under Webview CSP).
3. Validate with the `mascot` profile:

```ts
validateSvgLayers(svg, { profile: "mascot" });
```

Required mascot layers include `avatar/root`, body parts (`skirt`, `cape`, `scarf`, `hands`, `feet`), face stack (`head`, `hat`, `hair/back`, `hair/front`, `eyes/*`, `mouth`), and `avatar/reactions`.

4. Run `animation-quality-gate` with `--profile mascot` before accepting motion.
5. Keep a static traced `svg/avatar.svg` only as RuntimeBoundary fallback — never claim the trace is the animated character.

## Done criteria

- Local SVG output exists.
- Optimized SVG exists.
- Warnings are useful.
- No network calls.
- Character animation work uses `mascot` layers, not unstructured traces.
