# What is DESIGN.md?

A design system document that AI agents read to generate consistent UI across your project.

![](https://app-companion-430619.appspot.com/docs/design-systems-design-md.png)

Every project has a visual identity: colors, fonts, spacing, component styles. Traditionally, this lives in a Figma file, a brand PDF, or a designer’s head. None of these are readable by an AI agent.

**`DESIGN.md` changes that.** It’s a plain-text design system document that both humans and agents can read, edit, and enforce. Think of it as the design counterpart to `AGENTS.md`:

| File          | Who reads it  | What it defines                      |
| ------------- | ------------- | ------------------------------------ |
| `README.md` | Humans        | What the project is                  |
| `AGENTS.md` | Coding agents | How to build the project             |
| `DESIGN.md` | Design agents | How the project should look and feel |

## What it gives you

When a design agent like Stitch reads your `DESIGN.md`, every screen it generates follows the same visual rules: your color palette, your typography, your component patterns. Without it, each screen stands alone. With it, they look like they belong together.

`DESIGN.md` is a  **living artifact** , not a static config file. It evolves as your design evolves. The agent generates it, you refine it, and it’s re-applied to screens as you iterate.

## How they’re created

There are three paths to a `DESIGN.md`, from effortless to precise.

![Creating a design system from a prompt in Stitch](https://app-companion-430619.appspot.com/docs/design-systems-create.png)

### Let the agent generate it

Describe the vibe. The agent translates your aesthetic intent into tokens and guidelines.

**PROMPT**

A playful coffee shop ordering app with warm colors, rounded corners, and a friendly feel

Stitch generates a complete design system (colors, typography, spacing, component styles) and summarizes it as a `DESIGN.md`.

### Derive from branding

If you already have a brand, provide a URL or image. The agent extracts your palette, typography, and style patterns to build the `DESIGN.md` from what already exists.

![Importing a design system from a website URL in Stitch](https://app-companion-430619.appspot.com/docs/design-system-import-from-website.png)

### Write it by hand

Advanced users can author a `DESIGN.md` directly, encoding exact design preferences. Every section is just markdown. No special syntax, no tooling required.

## Example

Below is a minimal `DESIGN.md` for a dark-themed productivity app:

```
# Design System
## OverviewA focused, minimal dark interface for a developer productivity tool.Clean lines, low visual noise, high information density.
## Colors-**Primary** (#2665fd): CTAs, active states, key interactive elements-**Secondary** (#475569): Supporting UI, chips, secondary actions-**Surface** (#0b1326): Page backgrounds-**On-surface** (#dae2fd): Primary text on dark backgrounds-**Error** (#ffb4ab): Validation errors, destructive actions
## Typography-**Headlines**: Inter, semi-bold-**Body**: Inter, regular, 14–16px-**Labels**: Inter, medium, 12px, uppercase for section headers
## Components-**Buttons**: Rounded (8px), primary uses brand blue fill-**Inputs**: 1px border, subtle surface-variant background-**Cards**: No elevation, relies on border and background contrast
## Do's and Don'ts- Do use the primary color sparingly, only for the most important action- Don't mix rounded and sharp corners in the same view- Do maintain 4:1 contrast ratio for all text
```

This is what the agent reads when generating your next screen. For the complete format specification, see [The format](https://app-companion-430619.appspot.com/docs/design-md/format/).






A `DESIGN.md` file has two faces. The **markdown** is what you read and edit, a human-friendly summary of your design system. Underneath, Stitch maintains  **structured tokens** , the precise values it uses to enforce consistency during generation.

This page documents what goes in the markdown.

## Sections

Every `DESIGN.md` follows the same structure. Sections can be omitted if they’re not relevant to your project, but the order should be preserved.

### Overview

A holistic description of the design’s look and feel. This is where you describe the personality: is it playful or professional? Dense or spacious? This section guides the agent’s high-level decisions when no specific token applies.

```
## OverviewA calm, professional interface for a healthcare scheduling platform.Accessibility-first design with high contrast and generous touch targets.
```

### Colors

The primary, secondary, tertiary, and neutral palettes. Each color should include its hex value and its role describing what the agent should use it for.

```
## Colors-**Primary** (#2665fd): CTAs, active states, key interactive elements-**Secondary** (#6074b9): Supporting actions, chips, toggle states-**Tertiary** (#bd3800): Accent highlights, badges, decorative elements-**Neutral** (#757681): Backgrounds, surfaces, non-chromatic UI
```

The agent also generates **named colors** from these base values: `surface`, `on-primary`, `error`, `outline`, and dozens more. These follow Material color role conventions and are available in the structured tokens.

### Typography

The font families and their roles across the typographic hierarchy: display, headline, title, body, and label levels.

```
## Typography-**Headline Font**: Inter-**Body Font**: Inter-**Label Font**: Inter
Headlines use semi-bold weight. Body text uses regular weight at 14–16px.Labels use medium weight at 12px with uppercase for section headers.
```

The relationship between headline and body fonts matters. Using the same family (like Inter) conveys uniformity. Mixing families (e.g., a serif headline with a sans-serif body) creates visual contrast the agent will intentionally carry through.

### Elevation

How the design conveys depth and hierarchy. Some designs use shadows; others stay flat.

```
## ElevationThis design uses no shadows. Depth is conveyed through border contrastand surface color variation (surface, surface-container, surface-bright).
```

If elevation is used, specify the shadow properties (spread, blur, color) and which components should be elevated.

### Components

Style guidance for component atoms. Focus on the components most relevant to your application.

| Component               | What to specify                                                                 |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Buttons**       | Variants (primary, secondary, tertiary), sizing, padding, corner radius, states |
| **Chips**         | Selection, filter, and action variants                                          |
| **Lists**         | Item styling, dividers, leading/trailing elements                               |
| **Inputs**        | Text fields, text areas, labels, helper text, error states                      |
| **Checkboxes**    | Checked, unchecked, indeterminate states                                        |
| **Radio buttons** | Selected and unselected states                                                  |
| **Tooltips**      | Positioning, colors, timing                                                     |

```
## Components-**Buttons**: Rounded (8px), primary uses brand blue fill, secondary uses outline-**Inputs**: 1px border, surface-variant background, 12px padding-**Cards**: No elevation, 1px outline border, 12px corner radius
```

You can suggest components based on your project’s context. For example, a navigation bar for a mobile app or a data table for a dashboard.

### Do’s and Don’ts

Practical guidelines and common pitfalls. These act as guardrails when creating designs.

```
## Do's and Don'ts- Do use the primary color only for the single most important action per screen- Don't mix rounded and sharp corners in the same view- Do maintain WCAG AA contrast ratios (4.5:1 for normal text)- Don't use more than two font weights on a single screen
```

## The dual representation

The markdown you see is one side. Stitch also stores a structured version of the same information: hex values, font enums, spacing scales, and the full named color palette. When you edit the markdown, Stitch reconciles both representations.

This means you can be approximate in the markdown (“warm colors, rounded feel”) and Stitch will translate that into precise tokens. Or you can be exact (`#2665fd`, `8px radius`) and Stitch will respect those values literally.

Both representations describe the same design system. The markdown is for collaboration. The tokens are for enforcement.









# View, edit, and export

Work with your design system in the Stitch UI. View tokens, tweak values, and export with your project.

## View the design system

Open the **Design System** panel to see the active design system for any screen. The panel shows the resolved tokens: colors, fonts, roundedness, spacing, and component patterns.

If the project has multiple design systems, the panel displays the one applied to the currently selected screen.

## Set a default design system

To apply a design system to all future screens in a project, select it as the project default. New screens generated after this point will automatically inherit its tokens.

Existing screens are not retroactively updated. To bring them into alignment, apply the design system to them individually.

## Edit via the Design System panel

The Design System panel supports direct edits to the active design system. Changes you make here update both the structured tokens and the `DESIGN.md` summary.

Editable properties include:

* **Color palette** : primary, secondary, tertiary, and neutral base colors
* **Typography** : headline, body, and label font families
* **Roundedness** : corner radius scale

For more granular changes (component guidelines, do’s and don’ts, or the overview narrative), edit the `DESIGN.md` markdown directly.

## Export with your project

When you export a project, the `DESIGN.md` file is included in the zip alongside the generated screens. This gives downstream consumers (developers, other design tools, or other agents) a portable record of the design system.

The exported `DESIGN.md` is a standalone document. It doesn’t depend on Stitch to be useful.





# Design Modes

Select the right engine for your creative workflow.

![](https://app-companion-430619.appspot.com/docs/design-modes-pink-swoosh@2x.png)

Stitch isn’t just one AI model; it is a suite of design engines.

In the generation settings, you will find the **Design Mode** selector. Think of these not just as different “versions,” but as different specialized tools. Some are built for speed, some for raw creativity, and others for deep logic and reasoning.

## Thinking with 3 Pro

**Best for:** Complex logic, deep reasoning, and your “Production” candidate.

This is the heavy lifter. Powered by Gemini 3 Pro, this mode prioritizes  **reasoning over speed** . It takes a little longer to generate because it is “thinking” through the implications of your prompt—how the navigation should flow, what the hierarchy implies, and how the colors interact.

If you are building a complex dashboard or a nuance-heavy landing page, this is where you should be. The wait is worth the pixel-perfect logic it returns.

## Redesign (Nano Banana Pro)

**Best for:** Modernizing old apps, stylistic experiments, and “vibes” based workflows.

The Redesign agent is your best friend when it comes to Vibe Design. It is incredible for taking a dated interface and applying a specific design aesthetic.

### The Style Word Bank

The Redesign agent thrives on specific art-direction keywords. Instead of saying “make it look cool,” try combining terms from these categories to define a distinct visual language.

**Layout & Structure**

* **Bento Grid:** Modular, boxy, card-based layouts. Distinct compartments that organize content into a cohesive, grid-like hierarchy.
* **Editorial:** High-fashion magazine feel. Large serif headings, generous whitespace, asymmetrical image placement.
* **Swiss Style:** Objectively clear. Heavy reliance on grid systems, sans-serif typography (Helvetica-ish), and flush-left text.
* **Split-Screen:** Distinct vertical division, often pairing a solid color block with full-bleed imagery.

**Texture & Depth**

* **Glassmorphism:** Translucency, background blur (backdrop-filter), and subtle white borders. “Frosted glass.”
* **Claymorphism:** Soft, inflated 3D shapes with inner shadows. Friendly, approachable, and tactile.
* **Skeuomorphic:** Realistic textures (leather, paper, metal) and controls that look like physical switches.
* **Grainy/Noise:** Adding film grain or texture overlays to gradients to reduce the “digital” shine and add warmth.

**Atmosphere & Era**

* **Brutalist:** Raw, unpolished, default system fonts, high contrast, hard edges. “Ugly-cool.”
* **Cyberpunk:** Dark mode, neon accents (cyan/magenta), glitch effects, tech-heavy interfaces.
* **Y2K:** Late 90s/Early 2000s optimism. Chrome textures, bubble letters, bright blues and pinks, pill-shaped buttons.
* **Retro-Futurism:** 80s Synthwave. Sunsets, wireframe grids, VHS aesthetics, glowing lines.

**Color & Contrast**

* **Duotone:** The entire UI is composed of two contrasting colors (and their shades).
* **Monochromatic:** Using a single base hue (e.g., “Shades of Electric Blue”) for a cohesive, branded look.
* **Pastel Goth:** Soft, milky pastel colors paired with stark black typography and borders.
* **Dark Mode OLED:** True black backgrounds (#000000) rather than dark grey, optimized for high contrast and pop.

**PROMPT**

**Action**Redesign this dashboard.

**Style**Use a modern Bento Grid layout.

**Details**Dark mode background. Use the Inter font for the headers.

## 2.5 Pro

**Best for:** High-fidelity HTML and A/B comparisons.

Gemini 2.5 Pro produces exceptionally high-quality code and design fidelity. It is often useful to generate a prompt in **Thinking with 3 Pro** and then run the exact same prompt in **2.5 Pro** to see two different high-level interpretations of your idea.

## Fast

**Best for:** Rapid wireframing and Figma exports.

The Rapid mode is optimized for compatibility if your primary goal is to export your initial sketches directly to **Figma** for manual refinement.



# Using Variations

Variations are one of the most powerful and fun to use features in Stitch. They allow you to generate multiple design options at once, breaking you out of a linear workflow and showing you possibilities you might not have imagined.

You are really good at exploring multiple versions of a design and comparing them, so it seems a waste to only generate one option at a time!

Currently, you can generate anywhere from one to five different options at a time. This feature is your sandbox for “What if?” moments.

## When to use variations

While the standard Chat is great for specific, granular updates (like changing a button color), Variations are best used for:

* **Getting Unstuck:** If you don’t know what to change, but you know the current design isn’t working.
* **Exploration:** When you want to see three different layout concepts for the same content.
* **Pivoting:** When you want to change the entire vibe (e.g., from “Corporate Blue” to “Neon Cyberpunk”) in one go.

## Controlling the Creative Range

Each time you generate variations, you specify the **Creative Range** to give Stitch. This tells the AI how far to stray from your current design:

* **Refined (Low Range):** Keeps the structure intact but plays with fonts, subtle spacing, and colors. Use this for polish.
* **Creative (High Range):** Absolute “let’s see what’s possible” freedom. This allows Stitch to completely restructure the layout, swap imagery, and overhaul the theme.

## Writing prompts for Variations

Unlike the standard editing process where we recommend making “one major change at a time,” Variations are the place to make  **big swings** . You can combine theme changes and layout changes into a single prompt because you are generating multiple options to choose from.

**Sets the vibe**

**Specific color request**

**Target specific screen**

**Clear, specific instruction**

Update the app theme to a **luxury aesthetic** using a **strict black and white palette.** **On the Episode List screen,** change the layout to a **minimalist grid.**

**Pro Tip:** Even when asking for broad changes, be specific about the  *direction* . Instead of saying “Make it different,” say “Make it minimalist” or “Make it bold.”

## Iterating on a winner

The power of variations doesn’t stop after the first click. Once Stitch presents you with five options, you might find that Option 3 has the perfect layout, but Option 5 has the better color scheme.

1. **Pick the best base:** Select the variation that is closest to your vision.
2. **Vary the variation:** You can run variations *on top* of a variation. Select your winner, lower the **Creative Range** to “Refined,” and ask Stitch to bring in the color scheme you liked from the other option.
