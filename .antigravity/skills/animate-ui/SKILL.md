---
name: animate-ui
description: Add and adapt imskyleen/animate-ui registry components for intentional animated React interfaces. Use for animated UI, motion-rich web interfaces, micro-interactions, animated controls, page transitions, scroll reveals, or when StackSelection includes the animate-ui integration. Apply only to compatible Next.js or React/Vite workspaces using TypeScript and Tailwind; do not use for rendered video, Flutter, or WebGL-only animation.
---

# Animate UI

## Contract

- **Stage**: `build`
- **Reads**: `TaskIntent`, `StackSelection`, design artifacts, motion plan, generated workspace
- **Emits artifacts**: `animate-ui-component-map`, `animation-verification-log`
- **Upstream**: [Animate UI](https://github.com/imskyleen/animate-ui) and [installation docs](https://animate-ui.com/docs/installation)

## Rules

- Work only inside the generated application workspace; never install UI dependencies into the WebDesigner control plane.
- Require `nextjs` or `react-vite`, React, TypeScript, and Tailwind. If the workspace is incompatible, record the reason and implement a framework-native fallback.
- Use the Shadcn CLI and official `@animate-ui/...` registry items. Never copy raw component files from GitHub.
- Install only components that serve the approved motion plan. Do not add the full registry or introduce decorative animation noise.
- Preserve the active product identity and design tokens. For new Nightglass interfaces, map copied source to the `--ng-*` token contract.
- Preserve existing aliases, component conventions, and package-manager choice.
- Preview registry changes before writing. Do not overwrite local components without explicit approval.
- Inspect generated source and dependencies after installation; fix aliases, imports, client boundaries, and style-token mismatches.
- Preserve keyboard behavior, focus visibility, and readable static states. Respect `prefers-reduced-motion` and verify the reduced-motion path.

## Process

1. Confirm `integrations` contains `animate-ui` or that the user explicitly requested animated UI.
2. Read the active design-system guidance and inspect the workspace, package manager, `components.json`, Tailwind setup, and motion plan.
3. Initialize Shadcn only when required, using the workspace package runner.
4. Choose the smallest matching official registry item. Preview it first, for example:

   ```bash
   npx shadcn@latest add @animate-ui/primitives-texts-sliding-number --dry-run
   ```

5. Add the approved item with the same package runner, then adapt the copied source to the active design system.
6. Test the interaction at desktop and mobile sizes, with keyboard input and reduced motion enabled.
7. Record installed registry items and local file paths in `animate-ui-component-map`; record normal and reduced-motion results in `animation-verification-log`.
