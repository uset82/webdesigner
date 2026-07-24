---
name: gsap-animation
description: Add GSAP (GreenSock Animation Platform) timelines, scroll-driven effects, SVG morphing, text split animations, smooth scrolling, draggable interactions, and physics to web applications. Use for complex animations, ScrollTrigger / ScrollSmoother scenes, SplitText typography effects, Flip transitions, MorphSVG / DrawSVG, or when StackSelection includes the gsap-animation integration. Compatible with Next.js, React/Vite, and Vanilla JS/HTML.
---

# GSAP Animation

## Contract

- **Stage**: `build`, `design`
- **Reads**: `TaskIntent`, `StackSelection`, design artifacts, motion plan, generated workspace
- **Emits artifacts**: `gsap-animation-config`, `animation-verification-log`
- **Upstream**: [GSAP Documentation](https://gsap.com/docs/v3/)
- **Local Asset Repository**: `gsap-public` (contains core GSAP + bonus plugins like `ScrollSmoother`, `SplitText`, `MorphSVGPlugin`, `DrawSVGPlugin`, `InertiaPlugin`, `CustomEase`, `CustomBounce`, `CustomWiggle`, `ScrambleTextPlugin`, etc.)

## Included Plugins & Capabilities

1. **Core & Eases**: `gsap`, `useGSAP` (`@gsap/react`), `CustomEase`, `CustomBounce`, `CustomWiggle`, `EasePack` (`RoughEase`, `ExpoScaleEase`, `SlowMo`).
2. **Scroll & Layout**: `ScrollTrigger`, `ScrollSmoother`, `ScrollToPlugin`, `Flip`, `Observer`.
3. **Typography & Text**: `SplitText`, `TextPlugin`, `ScrambleTextPlugin`.
4. **Vector & SVG**: `MorphSVGPlugin`, `DrawSVGPlugin`, `MotionPathPlugin`, `MotionPathHelper`.
5. **Interactive & Physics**: `Draggable`, `InertiaPlugin`, `Physics2DPlugin`, `PhysicsPropsPlugin`, `PixiPlugin`, `EaselPlugin`, `GSDevTools`.

## Installation Methods

### 1. Standard npm Package Installation
For standard npm projects:
```bash
npm install gsap @gsap/react
```

### 2. Local Bonus Plugins (`gsap-public`)
When bonus plugins (`ScrollSmoother`, `SplitText`, `MorphSVGPlugin`, `DrawSVGPlugin`, `InertiaPlugin`, etc.) are needed:
- Copy the required ESM plugins from `gsap-public/gsap-public/esm/` into the generated workspace's `src/lib/gsap/` or `vendor/gsap/`.
- Import directly from the local path or bundle.

## React & Next.js Usage Pattern (`useGSAP`)

Always use `@gsap/react`'s `useGSAP` hook for React and Next.js applications to ensure automatic cleanup and context scoping:

```tsx
'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export default function HeroSection() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Target elements scoped inside container
    const split = new SplitText('.hero-title', { type: 'lines,words,chars' });

    gsap.from(split.chars, {
      duration: 1,
      y: 50,
      opacity: 0,
      stagger: 0.03,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: container.current,
        start: 'top 80%',
      }
    });
  }, { scope: container });

  return (
    <div ref={container} className="hero">
      <h1 className="hero-title">Elevate Your Visual Interface</h1>
    </div>
  );
}
```

## Vanilla JS / HTML Usage Pattern

For HTML/JS workspaces:
```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script>
  gsap.registerPlugin(ScrollTrigger);

  gsap.to(".box", {
    x: 300,
    duration: 2,
    scrollTrigger: {
      trigger: ".box",
      start: "top center",
      end: "bottom top",
      scrub: true
    }
  });
</script>
```

## Performance & Accessibility Rules

1. **`prefers-reduced-motion` Compliance**: Always check user motion preferences via `window.matchMedia('(prefers-reduced-motion: reduce)')`. If enabled, skip long transitions or set `duration: 0`.
2. **Context Cleanup**: In React/Next.js, always scope animations inside `useGSAP()` or call `ctx.revert()` in cleanup functions to prevent memory leaks and duplicate triggers.
3. **GPU Acceleration**: Animate transform properties (`x`, `y`, `scale`, `rotation`, `opacity`) instead of layout properties (`top`, `left`, `width`, `height`) whenever possible.
4. **ScrollSmoother Rules**: `ScrollSmoother` requires `ScrollTrigger` and wrapper/content structure (`#smooth-wrapper` > `#smooth-content`). Ensure CSS `overflow: hidden` on wrapper.
