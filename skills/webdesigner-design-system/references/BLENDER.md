# Project Blender Capability

This file is the project contract for local authored 3D work in Blender. Read it with [`3D.md`](3D.md) before any Blender task. Blender is optional, local developer tooling; it is not a runtime dependency and it does not replace Mint's generated-asset pipeline.

## When Blender Activates

Use Blender only when the user explicitly requests authored or edited 3D work that benefits from a DCC tool, including:

- precise modeling or topology changes;
- UV layout, texture-coordinate repair, or material tuning;
- armatures, weights, constraints, rigging, or animation;
- scene, motion, mesh, material, or export inspection;
- repair or conversion of an existing 3D asset;
- GLB, FBX, OBJ, STL, USD, or `.blend` delivery.

Ordinary interface work, CSS depth, parallax, shader-like decoration, and decorative web 3D activate neither Blender nor Mint. Gaussian-splat worlds always remain in the Mint workflow.

## Hybrid Mint and Blender Routing

| Request | Route |
| --- | --- |
| Generate a new model, world, PBR material, asset pack, animation, audio, or SFX | Mint, following [`3D.md`](3D.md) |
| Precisely author or edit geometry, UVs, weights, rigs, animation, or materials | Blender |
| Inspect, repair, retopologize, or export an existing asset | Blender |
| Build a Three.js viewer, configurator, simulation, or experience | Three.js app director; use Mint or Blender only for explicitly required asset work |
| Build a game or game-like experience | Three.js game director; use Mint or Blender only for explicitly required asset work |
| Generate a Gaussian-splat world | Mint only, and only when the user explicitly requests a world or environment |

Do not post-process a successful Mint asset unless the user requests the change or a verified runtime requirement makes the derivative necessary. Preserve the Mint original, its stable logical key, and its manifest entry. Record Blender-created derivatives separately and state why each derivative exists.

One explicit Blender request authorizes the named edit or deliverable, not unrelated scene changes, remote downloads, extra asset variants, or network-backed generation.

## Required Local Setup

The restricted project-scoped bridge template is bundled at `../assets/blender-config.toml`. Merge its Blender section into the target project's `.codex/config.toml` only when the user explicitly requests Blender capability; preserve all existing project settings.

- server: `blender-mcp==1.6.4` through `uvx --python 3.11`;
- host: `localhost:9876`;
- optional server with telemetry disabled;
- automatic approval only for scene, object, and viewport inspection;
- explicit approval required for every `execute_blender_code` call.

The Blender add-on is pinned to commit `6641189231caf3752302ae20591bc87fda85fc4e` with SHA-256 `BBA60831F5F89A74DEDA0294B131668A086CF46EB35A6A01ABBD0D21D9E92630`.

Use the local tools as follows:

1. Run the bundled `../scripts/setup-blender-mcp.mjs --verify-only` with Node to verify Blender, `uvx`, the pinned add-on hash, and enabled state. Installation or replacement is never an implicit task step.
2. If the local server is unavailable, run the bundled `../scripts/start-blender-host.ps1` from the target project root. It resolves Blender from `BLENDER_PATH`, `PATH`, then Blender 4.5's standard Windows location.
3. The launcher reuses a Blender-owned listener, refuses unrelated listeners, and refuses to start a second Blender process when an existing Blender session lacks a listener.
4. Otherwise it opens the visible Blender GUI with Python auto-execution disabled and waits up to 30 seconds for the add-on's auto-started server.
5. Never run Blender in background mode for MCP work and never terminate Blender automatically.

If the host cannot start, report the local capability as unavailable and continue any independent work. Do not weaken the safety settings or silently fall back to a remote provider.

## Tool Safety and Approval

Always use the least-powerful tool that can answer the question.

1. Inspect the scene with `get_scene_info`.
2. Inspect relevant objects with `get_object_info`.
3. Inspect the visible result with `get_viewport_screenshot`.
4. Only then propose or run `execute_blender_code` when the requested change requires it.

`execute_blender_code` is arbitrary local Python execution. Its approval prompt is a permanent project boundary. Do not bypass, batch around, or reconfigure that prompt. Before requesting approval, state the intended scene changes and affected output paths.

Keep PolyHaven, Sketchfab, Hyper3D, Hunyuan, and every other network-backed add-on integration disabled. Do not enable telemetry, install add-ons, change Blender preferences, access arbitrary filesystem paths, or make network requests unless the user explicitly expands the scope.

## Scene and File Safety

- Never overwrite a user-selected `.blend` file or source asset.
- Copy source scenes and assets into `work/blender/<task>/` before editing. The launcher accepts a `.blend` argument only from this safe working tree.
- Use project-owned absolute paths in Blender operations. Do not write to home, temporary profile, or source-repository locations.
- Put standalone user-facing `.blend`, GLB, FBX, OBJ, STL, USD, and render deliverables in `outputs/3d/<task>/`.
- When integrating into an existing application, its established asset directories and naming conventions override the standalone output location.
- Preserve source assets. Use stable, descriptive names and record derivatives separately from `mint-assets.json` originals.
- Do not create `mint-assets.json` for Blender-only work. If the registry already exists, never rewrite Mint metadata to disguise a Blender derivative as the original.
- Save recoverable working checkpoints before destructive topology, rig, bake, or conversion operations.

## Specialist Skill Routing

Read only the relevant project-local skill instructions before acting:

| Need | Skill |
| --- | --- |
| Blender planning, procedural scene work, or cross-discipline coordination | `blender-technical-artist` |
| Mesh creation, topology, modifiers, UV preparation | `blender-modeling` |
| Materials, nodes, textures, UV/material validation | `blender-materials` |
| Keyframes, actions, constraints, NLA, animation editing | `blender-animation` |
| Armatures, skinning, weight painting, control rigs | `rigging-animation` |
| GLB, FBX, OBJ, STL, USD, or pipeline export | `blender-export` |
| Read-only motion/action/state inspection | `blender-motion-state-inspection` |
| Animation validation and contact-sheet review | `animation-quality-gate` |

These bundled skills are source-pinned. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for authorship and license notices.

## Authoring Contract

- Establish units, axes, scale, transforms, origin placement, and naming before detailed work.
- Prefer reversible modifiers and non-destructive operations until the deliverable requires application.
- Keep topology purposeful for the requested deformation, shading, and runtime budget.
- Preserve material slots, textures, vertex data, armatures, animations, custom metadata, and supplied geometry unless the brief requires a change.
- Validate normals, UVs, unapplied transforms, duplicate names, missing textures, non-manifold geometry, and unsupported export features when relevant.
- For rigs, validate bone hierarchy, weights, rest pose, deformation, action ranges, and root-motion expectations.
- For animation, check contact, sliding, looping, timing, interpolation, clipping, and reduced-motion or static alternatives in the consuming application.
- For web GLBs, verify the consuming loader remains Draco-compatible when the asset or existing pipeline requires Draco.
- Do not invent requested formats, animation sets, conversions, or tool capabilities. Inspect live capability and the current scene first.

## Verification and Handoff

Run verification proportional to the work, without modifying the source scene:

- confirm the expected scene, object, material, rig, action, and collection state;
- take a viewport screenshot for visual inspection;
- validate the saved working copy and every exported file exists at the intended project-owned path;
- run the relevant specialist validation or contact-sheet script when applicable;
- check export reloadability, transforms, scale, materials, textures, animation clips, and metadata;
- for application integration, build, typecheck, run focused tests, and verify the loader path and asset existence;
- preserve Mint's separate QA boundary for Mint-backed assets and Three.js browser QA approvals.

Installation smoke testing is read-only: scene information plus a viewport screenshot. Do not run Blender Python or modify a scene solely to prove installation.

In the handoff, report the source copied, working scene, generated derivatives, final outputs, Blender version, checks performed, and any approval-gated or manual checks that remain.
