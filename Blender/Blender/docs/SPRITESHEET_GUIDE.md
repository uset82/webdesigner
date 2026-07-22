# Spritesheet Guide

The PixiJS runtime consumes a local raster or SVG atlas plus a JSON metadata file. The metadata file is an entrypoint in an avatar package; it is not executable code.

## Atlas layout

Use a regular grid. For example, a 4×4 atlas with 64×64 frames is 256×256 pixels. Frame `0` is the first cell, then frames advance left-to-right and top-to-bottom:

```text
 0  1  2  3
 4  5  6  7
 8  9 10 11
12 13 14 15
```

Keep the artwork original. The repository's built-in orb is a clean-room geometric example; do not copy characters, models, textures, or motion from third-party projects.

## Metadata

Create `pixi/avatar-spritesheet.json` next to `pixi/avatar-spritesheet.svg` (or a local raster image):

```json
{
  "schemaVersion": 1,
  "image": "avatar-spritesheet.svg",
  "frameWidth": 64,
  "frameHeight": 64,
  "clips": {
    "idle_loop": { "name": "idle_loop", "frames": [0, 1, 0], "fps": 6, "loop": true },
    "think_loop": { "name": "think_loop", "frames": [2, 3, 2], "fps": 4, "loop": true },
    "greet_once": { "name": "greet_once", "frames": [4, 0], "fps": 8, "loop": false, "priority": 2 }
  }
}
```

The state names map to clips using the built-in convention: `idle_loop`, `greet_once`, `listen_loop`, `think_loop`, `talk_loop`, `type_loop`, `inspect_loop`, `debug_loop`, `scan_loop`, `celebrate_once`, `concerned_loop`, `error_once`, and `sleep_loop`. Missing state clips fall back to `idle_loop`. Trigger clips use names such as `blink_once`, `look_left_once`, `nod_once`, `talk_start`, and `clear_effects`.

`loop: false` clips are one-shots. Higher `priority` clips can protect an important one-shot from a lower-priority interruption. When a one-shot completes, the deterministic controller returns to the active state clip.

## Limits and checks

- `image` must be a local relative path; URLs, absolute paths, and `..` traversal are invalid.
- Each frame dimension must be positive and no larger than 4096.
- The runtime accepts no more than 4096 unique frames and 16,384 total clip frame references.
- The image dimensions must contain every referenced frame.
- Include the spritesheet JSON, image, and any SVG preview in the avatar manifest checksums when distributing a package.

Use the built-in files under `apps/extension/media/avatars/pixi/` as a small original reference. The [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md) explains how to connect this entrypoint to a package.
