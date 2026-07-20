---
name: remotion-video-generator
description: Programmatically creates React-based animations and video compositions, rendering them into MP4, WebP, or GIF formats using Remotion.
---
# Remotion Video Generator

## Contract
- **Stage**: `build`, `deploy`
- **Input schema**: `.antigravity/runtime/schemas/stack-selection.schema.json`
- **Output schema**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Emits artifacts**: `remotion-composition`, `video-rendering-log`, `rendered-video-asset`

## Rules
- Define frame rates (`fps`), width, height, and durations programmatically.
- Use Remotion animation tools (`spring`, `interpolate`, `useCurrentFrame`, `useVideoConfig`) rather than raw CSS keyframes to ensure sub-frame rendering precision.
- Optimize asset loading: preload video elements, audio files, and large image buffers before composition timeline starts.
- Ensure audio components (`<Audio />`) are correctly layered and synced with visual transitions.

## Process
1. **Scaffolding**: Install Remotion dependencies (`remotion`, `@remotion/cli`, `@remotion/player`) in the generated workspace.
2. **Root Entry Config**: Create `index.ts` / `Root.tsx` to register compositions with canonical IDs, height, width, frame-rate, and duration parameters.
3. **Timeline Development**: Write React animation layers using the composition timeline context. Split scenes into reusable components.
4. **Interactive Validation**: Run `npx remotion preview` to spin up the local player interface, enabling rapid visual checking of the playback.
5. **Asset Compilation**: Build production video assets by executing render commands (e.g., `npx remotion render <composition-id> out/video.mp4`).
6. **Handoff**: Save output files to the build folder and update the `ArtifactManifest` with composition logs.
