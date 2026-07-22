# WebGL Pipeline and WebGPU Boundary

WebGL2 is the supported optional 3D avatar runtime. WebGPU remains deferred; selecting an unsupported or failed runtime must never prevent the assistant from loading.

## Selection and fallback

The active path is:

1. A workspace selects `webgl` and its schema-version-1 manifest provides both `entrypoints.webgl` and `entrypoints.svg`.
2. `AvatarStage` confirms WebGL2, then loads the Three.js renderer through `React.lazy`.
3. The renderer imports `GLTFLoader` only after the GLB entrypoint is known.
4. Missing WebGL2, an invalid/corrupt GLB, a lost context, or renderer initialization failure returns to the package SVG.
5. If the package itself is unavailable or invalid, the extension selects the built-in coder orb.

Generic Blender packages may advertise WebGL only when their GLB and package-local sanitized SVG both validate. The local Cholita package follows the same rule but remains under `.codex-avatar/` because its art rights are local/internal only.

## Motion and interaction

The renderer uses `AnimationMixer`. Looping state clips cross-fade; `welcome`, `success`, and `error` clips play once and return to idle. Trigger clips also play once. Missing mappings degrade to a restrained procedural idle instead of freezing or throwing.

The exact morph names are `Blink_L`, `Blink_R`, `Mouth_Open`, `Smile`, `Frown`, `Brow_Up`, and `Brow_Down`. Cursor pose drives eyes and head gaze, speech inputs drive `Mouth_Open`, and blink timing is randomized. Particle triggers remain normal Webview overlays rather than GLB content.

## Lifecycle and budgets

Rendering is capped by the selected 30/60 FPS preference and a bounded device pixel ratio. It pauses while the page is hidden or focus/no-animation mode suppresses motion, and it reduces continuous motion for reduced-motion users. Teardown cancels animation frames, disconnects resize observers, uncaches mixer actions, removes event listeners, and disposes geometries, materials, textures, renderer state, and the WebGL context.

Three.js and `@types/three` are pinned to `0.185.1`. The WebGL renderer and GLTF loader are emitted as lazy chunks, so SVG-only sessions do not execute them. No model, texture, loader, or runtime code is fetched from a remote service.
