# Layered Mascot Prototype

The Skjermbilde Character prototype turns the supplied front-facing illustration into a responsive 2D mascot without uploading the source or requiring a GPU runtime. It is a hand-recreated, code-native SVG rig: the hat, hair, head, eyes, irises, eyelids, eyebrows, cheeks, mouth, scarf, cape, hands, skirt, feet, and reaction effects are independent named layers.

Layer IDs follow the asset-pipeline `mascot` profile (`avatar/root`, `avatar/hair/back`, `avatar/hair/front`, clothing, face, and `avatar/reactions`). Validate authored SVGs with `validateSvgLayers(svg, { profile: "mascot" })` and review motion with `animation-quality-gate --profile mascot`.

This is an authored 2D reconstruction, not automatic segmentation, a Live2D model, or a 3D rig. The original local trace remains the fallback image and is not injected into the page as executable SVG markup.

## What moves

- Idle breathing, small head drift, and randomized blinking.
- Pointer-following eyes with restrained head rotation.
- Thinking tilt and thought marks.
- Speaking nod plus mouth motion driven by the existing text/audio-level pose channel.
- Success bounce, check mark, and sparkles.
- Error shake, concerned mouth, eyebrows, and error mark.
- Warning and sleeping expressions.
- One-shot blink, look, nod, shake, celebrate, point, and particle reactions.

Reduced-motion mode removes continuous motion while retaining the visible expression for each state. Focus mode pauses ambient movement. When the page is hidden, animation is paused by the existing stage policy.

## How the extension selects it

The active local package id is `skjermbilde-character`. `AvatarStage` selects `LayeredMascotRenderer` for that id. Other packages continue through the generic safe SVG renderer. The layered renderer is wrapped in `RuntimeBoundary`; if it cannot render, the package's local `svg/avatar.svg` trace is used, and the built-in orb remains the final missing/corrupt-asset fallback.

The package manifest can stay SVG-first. No WebGL, WebGPU, Rive, Live2D, network, or cloud dependency is required.

## Reuse it in a website

The component is in `apps/webview/src/renderers/LayeredMascotRenderer.tsx`, with its self-contained visual rules in `LayeredMascotRenderer.css`. In a React/Vite website:

1. Copy the component and CSS file into the website, or expose them from a local workspace package.
2. Replace the four type imports from `../bridge/messages` with equivalent website types, or import the shared types from `@codex-avatar-studio/avatar-core`.
3. Render it inside a square or portrait container. The component scales through its `0 0 441 653` SVG view box.
4. Keep `state` in application state and pass normalized pointer/audio values through `poseInput`.
5. Keep the static `svg/avatar.svg` available as an `<img>` fallback if React or CSS animation is unavailable.

```tsx
import { useState } from "react";
import { LayeredMascotRenderer } from "./LayeredMascotRenderer";
import "./LayeredMascotRenderer.css";

export function WebsiteMascot() {
  const [state, setState] = useState<"idle" | "thinking" | "speaking" | "success" | "error">("idle");

  return (
    <div style={{ width: 360, aspectRatio: "441 / 653" }}>
      <LayeredMascotRenderer
        state={state}
        poseInput={{ cursorX: 0.5, cursorY: 0.5, mouthOpen: state === "speaking" ? 0.65 : 0 }}
        reducedMotion={window.matchMedia("(prefers-reduced-motion: reduce)").matches}
        intensity="medium"
        focusMode={false}
        lipSyncEnabled
        triggerEvent={null}
      />
      <button onClick={() => setState("thinking")}>Think</button>
      <button onClick={() => setState("speaking")}>Speak</button>
      <button onClick={() => setState("success")}>Success</button>
      <button onClick={() => setState("error")}>Error</button>
    </div>
  );
}
```

For eye tracking, map the page pointer to `cursorX` and `cursorY` values between `0` and `1`. For lip-sync, pass an already-derived `mouthOpen` value between `0` and `1`; the component does not request microphone access. The extension's `useAvatarBehavior` hook is a reusable example for throttled pointer tracking and local text/audio-level mouth movement.

## Plain web fallback

If React is unavailable, show the local static trace:

```html
<picture class="mascot-fallback">
  <img src="/avatars/skjermbilde-character/svg/avatar.svg" alt="Skjermbilde Character" />
</picture>
```

WebGL/WebGPU feature detection is unnecessary for this primary renderer because it uses normal inline SVG and CSS. A future GPU, Rive, or Live2D adapter can sit above the same SVG fallback contract without changing website state names.
