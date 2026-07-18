---
name: blender-technical-artist
description: Use for Blender Python automation, SVG line-art export, GLB export, PNG previews, rig conventions, and Blender-to-WebGL asset pipeline.
---

# Blender Technical Artist

## When to use

Use this skill when working in `scripts/blender`, `blenderRunner.ts`, GLB export, SVG line art, or Blender asset documentation.

## Goals

- Make Blender a powerful optional asset tool.
- Export SVG/GLB/PNG locally.
- Provide clear errors when Blender is missing.
- Keep runtime independent of Blender.

## Workflow

1. Check Blender path setting.
2. Support `blender --version` validation.
3. Write Python scripts with CLI args.
4. Export to `.codex-avatar/exports/blender`.
5. Generate manifest entries.
6. Log output in VS Code Output Channel.

## Done criteria

- Missing Blender is graceful.
- Valid Blender can run exports.
- Export paths are local.
- Docs explain scene setup.
