---
name: webdesigner-design-system
description: Design, build, revise, and review polished websites, landing pages, product interfaces, dashboards, apps, and explicitly requested 3D experiences with the Nightglass visual system. Use for frontend creation or styling, design-system work, responsive UI, component composition, visual QA, Three.js presentation, or authored Blender asset workflows.
---

# WebDesigner Design System

Apply the bundled design contract before frontend work. Preserve an existing product identity when it is coherent; explicit user direction and established product conventions take precedence over Nightglass.

## Required workflow

1. Read `references/DESIGN.md` before proposing or editing a user interface.
2. Read `assets/tokens.css` before writing styles. Read `assets/tailwind-v4.css` when Tailwind CSS v4 is present.
3. State a visual thesis, content or workspace plan, and interaction thesis in implementation notes.
4. Build from hierarchy, typography, whitespace, dividers, and purposeful media. Avoid generic card mosaics and decorative clutter.
5. Preserve keyboard focus, semantic structure, WCAG AA contrast, 44px touch targets, reduced-motion behavior, and non-color status cues.
6. Verify the rendered result at narrow mobile and wide desktop widths when the task's QA authorization permits browser inspection.

Use the CSS custom properties in `assets/tokens.css` as the stable public interface. Copy the relevant asset file into the user's project when the design system must become a project dependency; do not edit the bundled source in place.

## 3D routing

Do not activate 3D tooling for ordinary UI, CSS depth, parallax, or decorative backgrounds.

- For an explicit generated model, material, animation, audio asset, pack, Three.js experience, or Gaussian-splat world, read `references/3D.md`. Use Mint only when its installed skill and live MCP capability are available. A generated world requires explicit world or environment intent.
- For precise modeling, UVs, material tuning, rigging, animation, inspection, repair, or export, read `references/BLENDER.md` and the relevant bundled Blender specialist skill.
- Preserve successful Mint originals. Create a Blender derivative only when the user requests it or a verified runtime constraint requires it.
- Keep MCP calls and provider details out of application runtime code and user-facing interfaces.

The optional Blender setup verifier and guarded Windows launcher live under `scripts/`. The restricted project configuration template is `assets/blender-config.toml`. Merge it into a project only when the user explicitly requests Blender capability; never overwrite an existing project configuration.

## Bundled references and assets

- `references/DESIGN.md`: visual thesis, layout, typography, components, motion, accessibility, prompt recipes, and QA.
- `references/3D.md`: conditional Mint/Three.js authorization, asset, UI, and QA contract.
- `references/BLENDER.md`: local DCC routing, approval, file-safety, host, and verification contract.
- `references/THIRD_PARTY_NOTICES.md`: Blender skill and bridge provenance.
- `assets/tokens.css`: framework-neutral Nightglass tokens.
- `assets/tailwind-v4.css`: optional Tailwind CSS v4 mapping.
- `assets/blender-config.toml`: restricted project-scoped Blender MCP template.
