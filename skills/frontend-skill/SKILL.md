---
name: frontend-skill
description: Steers frontend design and code implementation toward visually distinctive, premium interfaces. Incorporates Anthropic's narrative/structural guidelines and Leonxlnx's Taste-Skill dials (Variance, Motion, Density) and aesthetics.
---
# Frontend Skill

## Contract
- **Stage**: `design`, `build`, `review`
- **Input schema**: `.antigravity/runtime/schemas/task-intent.schema.json`
- **Output schema**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Emits artifacts**: `mood-board`, `content-plan`, `motion-plan`, `taste-dial-configuration`

## Aesthetic Steering Dials
Steer the visual language by setting the following three dials on a scale of 1-10:
1. **Variance (1-10)**: Low values enforce layout stability and familiar UI patterns (SaaS, grid-based). High values enable editorial asymmetry, experimental compositions, and unexpected transitions.
2. **Motion (1-10)**: Low values keep animations functional (simple hovers/fades). High values introduce scroll-parallax, canvas fluid-dynamics, page transitions, and complex interactive shader states.
3. **Density (1-10)**: Low values produce minimal, spacious layouts with generous whitespace (landing pages, portfolios). High values build high information-density, tool-like grids, and cockpit-style dashboards.

### Core Aesthetics & Vibes
Force the model to commit to a specific, cohesive visual thesis:
- **Minimalist**: Focuses on whitespace, clean lines, type contrast, flat surfaces, cardless structures.
- **Editorial**: Large serif headings, asymmetrical imagery, rich whitespace, offset layouts.
- **SaaS**: Bento grids, subtle depth (surface, container, container-bright), rounded borders, clean icons.
- **Brutalist**: Raw defaults, high contrast, hard edges, thick borders, oversized monospaced text.
- **Retro-Futuristic**: Sunsets, glowing grid paths, wireframe vectors, neon accents, synthwave palette.
- **Soft**: Inflated 3D roundedness, soft claymorphic depth, pastel/milky gradients.

## Hard Rules (The "Anti-Slop" Principles)
- **One Composition**: The first viewport must read as a single, cohesive composition. The hero media must default to edge-to-edge full bleed.
- **Brand First**: On branded pages, the brand name must be a hero-level signal. If the brand disappears after hiding the nav, the hierarchy has failed.
- **No Cards by Default**: Never use cards in the hero. Cards are only allowed when they are containers for user interaction. Default to section columns, dividers, and lists.
- **Typography & Background**: Avoid generic defaults (Inter, Roboto, Arial, system) unless matching an existing design. Do not rely on flat, single-color backgrounds; use rich gradients, patterns, or real visual anchors.
- **Hero Budget**: The first viewport contains only the brand, one headline, one short supporting sentence, one CTA group, and one dominant image. No secondary marketing cards, logo arrays, or promo badges.

## Process
1. **Define Visual Thesis**: Analyze the project brief and declare:
   - Visual Thesis (one sentence on mood, material, energy).
   - Core Vibe selection.
   - Values for Variance, Motion, and Density dials.
2. **Content Planning**: Outline the narrative flow (Hero -> Support -> Detail -> Social Proof -> Final CTA).
3. **Interaction Thesis**: Define 2-3 key motions (entrance reveal, scroll parallax, hover transition) using Framer Motion or pure CSS.
4. **Implement Design System**: Map hex values, font stacks, and border radii using CSS custom properties (`--brand-*`).
5. **Verify**: Test on desktop and mobile viewports. Ensure sticky headers or floating assets do not overlap primary text.
