# Nightglass — Project Design System

> A precision-built midnight interface: matte near-black surfaces, crisp low-weight typography, hairline structure, and one electric-aqua signal.

Nightglass is the default visual language for new UI in this project. It is an original system informed by the structure of agent-readable design references at https://styles.refero.design/, not a copy of any product brand.

## 1. How Agents Use This File

Before producing UI:

1. Identify whether the task is a landing page, editorial page, or product application.
2. Write a one-sentence visual thesis.
3. Define the content or workspace hierarchy.
4. Choose two or three purposeful motions.
5. Build with the --ng-* tokens in `../assets/tokens.css`.
6. Render at mobile and desktop sizes, then run the quality checklist at the end of this file.

Nightglass is a default, not a reason to ignore context. An explicit user brief, a supplied reference, accessibility needs, and an established product identity take precedence.

## 2. Visual Thesis

Nightglass feels like a precision instrument used after dark:

- Material: matte carbon, softly lifted graphite, thin metallic edges.
- Energy: calm, responsive, exact, never sterile.
- Contrast: paper-white content over deep surfaces with one aqua signal.
- Texture: functional product imagery, sparse atmospheric light, almost no ornament.
- Density: compact controls inside spacious compositions.

The interface should still feel premium when every decorative shadow is removed. Hierarchy comes first from composition, typography, spacing, cropping, and contrast.

## 3. Core Principles

### One dominant idea

Every section or application region gets one job, one focal point, and one primary action. Do not make several equal elements compete for attention.

### Cardless by default

Use page sections, columns, dividers, lists, media, and negative space before introducing a card. A card is justified when its boundary communicates interaction, selection, grouping, or elevation.

### The accent is a signal

Electric aqua is reserved for the primary action, active navigation, focus, or a deliberately highlighted data point. Do not scatter it through decoration. Success, warning, danger, and information colors are semantic only.

### Product truth over decoration

For ordinary UI, prefer real product surfaces, relevant diagrams, data, or in-context photography over abstract blobs, fake 3D objects, and decorative dashboards. When the user explicitly requests 3D, follow 3D.md and make the authored scene—not ornamental chrome—the visual anchor.

### Utility copy in product UI

Application headings orient the operator: Plan status, Selected metrics, Review queue, Last sync. Marketing metaphors and campaign language do not belong inside routine workflows.

## 4. Token Contract

The --ng-* custom properties in `../assets/tokens.css` are the stable public interface. Consume these tokens directly or through the optional Tailwind v4 aliases in `../assets/tailwind-v4.css`.

### Color

| Token | Value | Role |
|---|---:|---|
| --ng-color-canvas | #090B0E | Page and application canvas |
| --ng-color-surface-1 | #101318 | Navigation, panels, grouped content |
| --ng-color-surface-2 | #171B21 | Elevated and nested surfaces |
| --ng-color-surface-3 | #20252D | Selected rows and stronger surface separation |
| --ng-color-surface-hover | #242A33 | Hovered neutral controls and rows |
| --ng-color-overlay | rgba(2, 5, 7, 0.76) | Modal and drawer backdrop |
| --ng-color-border | #2A3039 | Default hairline structure |
| --ng-color-border-strong | #3A424F | Focus-adjacent and high-emphasis boundaries |
| --ng-color-text | #F4F7FB | Primary headings and content |
| --ng-color-text-secondary | #C6CDD7 | Supporting content |
| --ng-color-text-muted | #9AA3AF | Metadata, helper copy, inactive controls |
| --ng-color-text-faint | #68717D | Disabled and low-priority information |
| --ng-color-accent | #7EE7D7 | Primary action and active signal |
| --ng-color-accent-hover | #9AF0E2 | Primary action hover |
| --ng-color-accent-pressed | #64CBBD | Primary action pressed |
| --ng-color-on-accent | #07100F | Content placed on the accent |
| --ng-color-focus | #A6FFF1 | Keyboard focus ring |
| --ng-color-success | #67D391 | Successful state only |
| --ng-color-warning | #F4C76B | Warning state only |
| --ng-color-danger | #F07178 | Destructive or failed state only |
| --ng-color-info | #70A5FF | Informational state only |

Never use a semantic color as decorative branding. Every semantic color needs an icon, label, or other non-color cue.

### Typography

| Token | Value | Role |
|---|---:|---|
| --ng-font-sans | Inter Variable, Inter, system sans | Interface and display text |
| --ng-font-mono | JetBrains Mono, system monospace | Code, identifiers, and technical metadata |
| --ng-weight-regular | 400 | Body and standard controls |
| --ng-weight-medium | 500 | Headings and emphasized controls |
| --ng-weight-semibold | 600 | Compact labels only |
| --ng-text-xs | 0.75rem | Captions and metadata |
| --ng-text-sm | 0.875rem | Controls and secondary copy |
| --ng-text-base | 1rem | Default body |
| --ng-text-lg | 1.125rem | Lead and emphasized body |
| --ng-text-xl | 1.25rem | Small section headings |
| --ng-text-2xl | 1.5rem | Panel and page subheadings |
| --ng-text-3xl | 2rem | Section headings |
| --ng-text-4xl | clamp(2.5rem, 5vw, 4rem) | Hero and major display text |
| --ng-text-display | clamp(3rem, 7vw, 4.5rem) | Brand-led landing display |
| --ng-leading-tight | 1 | Display text |
| --ng-leading-snug | 1.2 | Headings |
| --ng-leading-normal | 1.5 | Controls and body |
| --ng-leading-relaxed | 1.65 | Long-form reading |
| --ng-tracking-tight | -0.022em | Text at 2rem and above |
| --ng-tracking-normal | 0 | Body and controls |
| --ng-tracking-wide | 0.08em | Short uppercase labels |

Use no more than two typefaces. Headings use weight 500, tight tracking, and compact line height rather than heavy bold. Body copy is 1rem / 1.5. Long-form copy uses a maximum width of --ng-reading-max and line height --ng-leading-relaxed.

### Spacing

The base unit is 4px. Use the named scale instead of inventing intermediate gaps.

| Token | Value |
|---|---:|
| --ng-space-0 | 0 |
| --ng-space-1 | 0.25rem |
| --ng-space-2 | 0.5rem |
| --ng-space-3 | 0.75rem |
| --ng-space-4 | 1rem |
| --ng-space-5 | 1.25rem |
| --ng-space-6 | 1.5rem |
| --ng-space-8 | 2rem |
| --ng-space-10 | 2.5rem |
| --ng-space-12 | 3rem |
| --ng-space-16 | 4rem |
| --ng-space-20 | 5rem |
| --ng-space-24 | 6rem |
| --ng-space-32 | 8rem |

Recommended rhythm:

- Related inline elements: --ng-space-2 or --ng-space-3.
- Control groups: --ng-space-3 or --ng-space-4.
- Panel padding: --ng-space-4 on mobile, --ng-space-6 on desktop.
- Major content regions: --ng-space-12 to --ng-space-16.
- Landing sections: --ng-space-20 to --ng-space-24.

### Layout and breakpoints

| Token | Value | Role |
|---|---:|---|
| --ng-page-max | 75rem | 1200px maximum page width |
| --ng-reading-max | 42rem | Long-form reading width |
| --ng-copy-max | 34rem | Hero and concise copy width |
| --ng-header-height | 4rem | Persistent header budget |
| --ng-control-height | 2.75rem | 44px minimum standard control |
| --ng-sidebar-width | 16rem | Desktop primary navigation |
| --ng-inspector-width | 22rem | Desktop secondary context |
| --ng-breakpoint-sm | 40rem | 640px |
| --ng-breakpoint-md | 48rem | 768px |
| --ng-breakpoint-lg | 64rem | 1024px |
| --ng-breakpoint-xl | 80rem | 1280px |

Use fluid layout first and breakpoints only when content requires a structural change. Full-bleed sections extend to viewport edges; inner content may use --ng-page-max.

### Shape and elevation

| Token | Value | Role |
|---|---:|---|
| --ng-radius-sm | 0.25rem | Tags and compact controls |
| --ng-radius-md | 0.5rem | Buttons, fields, menus |
| --ng-radius-lg | 0.75rem | Panels, dialogs, media frames |
| --ng-radius-full | 9999px | Avatars and true pills only |
| --ng-shadow-hairline | inset 0 0 0 1px border | Surface separation |
| --ng-shadow-surface | subtle 12px lift | Menus and small popovers |
| --ng-shadow-floating | restrained 24px lift | Dialogs and floating layers |
| --ng-shadow-focus | 3px aqua ring | Keyboard focus |

Use hairline borders and surface steps before shadows. Do not put a large radius on every container. Pills are for binary filters, compact status, and tags—not for ordinary buttons or navigation.

### Motion

| Token | Value | Role |
|---|---:|---|
| --ng-duration-fast | 160ms | Hover and micro-feedback |
| --ng-duration-base | 220ms | Menus, tabs, drawers, layout response |
| --ng-duration-reveal | 520ms | Page and section entrances |
| --ng-duration-slow | 650ms | One major atmospheric transition |
| --ng-ease-standard | cubic-bezier(0.2, 0.8, 0.2, 1) | General movement |
| --ng-ease-emphasized | cubic-bezier(0.16, 1, 0.3, 1) | Entrances and expansion |
| --ng-motion-distance | 1rem | Maximum default reveal travel |

Visually led pages should include:

1. One entrance sequence that establishes hierarchy.
2. One scroll-linked, sticky, or depth behavior that reinforces the story.
3. One hover, reveal, or layout transition that clarifies affordance.

Product applications may use only the motions that improve state understanding. Do not animate routine data merely to create activity.

When prefers-reduced-motion is enabled, durations collapse to near-zero and scroll-linked transforms stop. Functionality and state changes must remain clear.

### Layering

| Token | Value | Role |
|---|---:|---|
| --ng-z-header | 40 | Sticky navigation |
| --ng-z-overlay | 50 | Backdrop |
| --ng-z-modal | 60 | Modal or drawer |
| --ng-z-toast | 70 | Temporary notifications |

Do not create local z-index values above this scale without documenting the stacking context.

## 5. Landing Page Composition

Use this sequence unless the content demands another narrative:

1. Hero: brand or product, promise, primary action, and one dominant visual.
2. Support: one concrete feature, offer, or proof point.
3. Detail: workflow, atmosphere, product depth, or story.
4. Final action: one clear conversion or next step.

### Hero

- The hero canvas runs edge to edge.
- Constrain only the copy column to --ng-copy-max.
- Brand or product name is the loudest identity signal.
- The headline stays to two or three lines on desktop and reads in one glance on mobile.
- Use one dominant visual plane: a real product view, relevant photography, or a purposeful data composition.
- Keep text over calm visual areas and maintain AA contrast.
- If a fixed header is present, subtract --ng-header-height from the viewport budget.
- Do not add hero cards, stat strips, logo clouds, pill collections, or a floating dashboard by default.

### Supporting sections

- Give every section one responsibility: explain, prove, deepen, or convert.
- Alternate composition through scale, cropping, and alignment—not through a parade of card grids.
- Use full-width product or media moments between quieter text sections.
- Keep supporting copy to one short sentence where possible.
- The final action should repeat the primary promise without repeating the entire hero.

## 6. Product Application Composition

Applications begin with the work, not a marketing hero.

Default structure:

- Primary navigation: orientation and the few highest-frequency destinations.
- Primary workspace: the task, data, editor, queue, or canvas.
- Secondary context: inspector, details, history, filters, or help.
- One clear accent action: create, run, save, publish, or confirm.

### Density

- Use calm surfaces and compact controls inside generous region spacing.
- Prefer one continuous workspace with dividers over a mosaic of cards.
- Keep tables and lists dense enough to scan but never below a 44px interactive row height on touch layouts.
- Collapse the secondary inspector into a drawer below --ng-breakpoint-lg.
- Collapse primary navigation into a compact rail or drawer only when labels remain discoverable.

### Utility copy

- Headings name the area or action.
- Supporting text explains scope, freshness, behavior, or decision value.
- Empty states say what is missing, why it matters, and the next action.
- Error messages state what happened and how to recover.
- Avoid aspirational slogans inside operational surfaces.

## 7. Component Recipes

These are behavior and composition contracts, not production component implementations.

### Primary action

- Background: --ng-color-accent.
- Content: --ng-color-on-accent.
- Height: at least --ng-control-height.
- Radius: --ng-radius-md.
- Padding: --ng-space-3 vertically and --ng-space-4 horizontally.
- Type: --ng-text-sm, weight --ng-weight-medium.
- Hover: --ng-color-accent-hover.
- Pressed: --ng-color-accent-pressed.
- Focus: --ng-shadow-focus.
- Limit: one filled primary action per view or decision region.

### Secondary and ghost actions

- Secondary actions use --ng-color-surface-2 with --ng-color-border.
- Ghost actions use a transparent background and reveal --ng-color-surface-hover on hover.
- Neither competes with the primary action.
- Destructive actions remain neutral until the destructive decision is immediate; then use --ng-color-danger with a text label.

### Text fields and selection controls

- Use --ng-color-surface-1, --ng-color-border, --ng-radius-md, and --ng-control-height.
- Labels remain visible; placeholders are examples, never replacements for labels.
- Focus uses --ng-color-focus and does not rely only on a border-color change.
- Place helper or error text directly after the field and associate it programmatically.
- Show disabled state through both color and affordance.

### Navigation

- Use typography, spacing, and one active indicator before adding containers.
- The active destination may use --ng-color-accent, a border, and aria-current.
- Keep persistent headers quiet and let the page identity remain dominant.
- Mobile navigation must expose a visible label for the menu trigger.

### Panels and cards

- Surface hierarchy: canvas → surface 1 → surface 2.
- Default separation: --ng-shadow-hairline or a single border.
- Default panel radius: --ng-radius-lg.
- Do not nest more than two visibly boxed surface levels.
- If removing a card does not reduce meaning, remove it.

### Tables and lists

- Align numbers consistently and use the mono family for identifiers when helpful.
- Use dividers and subtle hover states instead of boxing every row.
- Preserve labels when a table reflows on mobile; use an intentional horizontal region only when comparison requires columns.
- Sort state, selection, and status need text or icons in addition to color.

### Badges and status

- Radius: --ng-radius-sm, not full pill by default.
- Type: --ng-text-xs, weight --ng-weight-medium.
- Keep labels short and literal.
- Semantic colors are low-intensity backgrounds or small indicators paired with readable text.

### Dialogs, drawers, and popovers

- Backdrop: --ng-color-overlay.
- Floating surface: --ng-color-surface-2 with --ng-shadow-floating.
- Trap focus, label the surface, support Escape where appropriate, and restore focus on close.
- Drawers enter over the workspace; they do not push critical content off-screen unless resizing is the explicit interaction.

### Toasts

- Use only for non-blocking confirmation or recovery information.
- Do not make a toast the sole location of an error that needs action.
- Pause dismissal on hover or focus and respect reduced motion.

## 8. Imagery, Icons, and Data

### Imagery

- Use at least one strong, real-looking visual anchor for brand, venue, editorial, or lifestyle work.
- Prefer in-context photography or genuine product surfaces over abstract decoration.
- Crop for a stable tonal area when text overlays an image.
- Avoid images with embedded signage, logos, or typography competing with the interface.
- Use multiple purposeful images instead of one collage.
- Provide meaningful alt text; use empty alt text only for genuinely decorative imagery.

### Product screenshots

- Show real functionality and legible state.
- Frame screenshots with --ng-color-border and --ng-radius-lg.
- Do not hide weak information hierarchy behind glow, perspective distortion, or a fake device shell.

### Icons

- Use a consistent line icon family.
- Icons support scanning or action recognition; ornamental icons are removed.
- Icon-only controls need accessible names and visible tooltips when meaning is not universal.

### Charts

- Use --ng-color-accent for the most important series.
- Use semantic colors only when the data is semantic.
- Differentiate series with labels, line patterns, shapes, or direct annotation—not color alone.
- Reduce gridline contrast and remove decorative 3D effects.

## 9. 3D and Immersive Experiences

3D is an explicit capability, not a default decoration. Activate this section only when the user requests a 3D asset, world, material, animation, audio deliverable, game, viewer, configurator, simulation, walkthrough, editor, or another Three.js experience. Follow 3D.md for routing, generation authority, asset handling, and QA.

### Visual thesis

A Nightglass 3D experience feels like a focused inspection space: the scene owns the canvas, controls stay quiet at its edge, and the aqua accent signals one action or active inspection mode.

### Canvas-first composition

- Let the scene fill the working region and remain the dominant visual plane.
- Use compact bottom-centered controls for simple viewers and walkthroughs.
- Place loading, ready, and recoverable error status directly above the controls.
- Open secondary details from an info button into a compact centered dialog.
- Avoid permanent sidebars in a canonical asset viewer.
- Add navigation, headers, marketing copy, or product chrome only when the experience requires them.
- Keep every overlay clear of the primary subject and essential interaction area.

### Nightglass overlay

- Build DOM controls with the existing --ng-* tokens; do not introduce a separate visual theme for 3D.
- Use --ng-color-surface-2, --ng-color-border, and --ng-shadow-hairline for compact floating controls.
- Reserve --ng-color-accent for the primary action, selected tool, or active inspection state.
- Keep controls at least --ng-control-height and use --ng-shadow-focus for keyboard focus.
- Keep provider branding, generation links, asset IDs, and provenance out of runtime UI unless explicitly requested.

### Scene and asset fidelity

- Treat generated models, materials, textures, animation, and audio as authored product assets.
- Do not hide weak composition behind bloom, fog, chromatic aberration, excessive depth of field, or constant camera motion.
- Use lighting, environment, camera, background, contact shadow, and reversible inspection modes to present an asset without rewriting it.
- Preserve successful generated materials instead of replacing them with decorative runtime shaders.
- Prefer discrete assets composed intentionally; use a generated world only after explicit world-level intent.

### Interaction and accessibility

- Make orbit, pan, zoom, selection, reset, pause, mute, and fullscreen behavior discoverable when present.
- Support pointer, keyboard, and touch without depending exclusively on hover.
- Give the canvas an accessible name and provide adjacent DOM text for essential scene meaning and state.
- Offer DOM equivalents for essential actions.
- Respect reduced motion in UI, camera transitions, parallax, and nonessential ambient movement.
- Provide a pause control for continuous nonessential animation.
- Detect WebGL and asset-loading failures and show a useful Nightglass recovery state instead of a blank canvas.
- Keep audio optional and never use it as the only channel for important feedback.

### Runtime restraint

- Bound pixel ratio and adapt quality to the target device.
- Dispose replaced scene resources and pause unnecessary work when hidden or offscreen.
- Resize from the canvas container rather than assuming the window owns the viewport.
- Keep loading progress truthful and do not announce readiness before required assets and interaction are usable.

## 10. Responsive Behavior

### Mobile first

- Start with a single content column.
- Use --ng-space-4 page gutters and panel padding.
- Keep primary actions reachable and at least 44px high.
- Avoid horizontal page scrolling. Tables and code may use a clearly bounded horizontal region.
- Replace side-by-side text and media with an intentional order, not an automatic visual shuffle.
- Keep display text within the --ng-text-4xl token on narrow screens unless the brand requires otherwise.

### Tablet

- Introduce two-column layouts only when both columns remain useful above --ng-breakpoint-md.
- Keep reading text at --ng-reading-max even when the viewport is wider.
- Inspectors may become sheets or drawers.

### Desktop

- Use --ng-page-max for contained content while allowing selected sections and media to bleed wider.
- Keep the main task visually dominant over navigation and inspectors.
- Do not fill empty width with low-value cards.

### Pointer and input differences

- Hover is enhancement, never the only way to reveal essential action.
- Use visible pressed and focus states.
- Support zoom to 200 percent without hiding content or controls.

## 11. Accessibility Contract

- Meet WCAG AA: 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries.
- Use --ng-color-text-muted only where its contrast is sufficient for the size and background.
- Use semantic landmarks and a logical heading order.
- Keep focus visible with --ng-shadow-focus.
- Make all interactive targets at least --ng-control-height in one dimension where practical.
- Preserve a sensible keyboard order and avoid positive tabindex values.
- Label fields, buttons, dialogs, regions, and icon-only controls.
- Pair status color with text, iconography, or pattern.
- Honor reduced motion and avoid autoplay that cannot be paused.
- Announce asynchronous results when they affect the current task.
- Preserve content and action at 200 percent zoom and narrow reflow widths.

## 12. Motion Choreography

### Landing-page default

- Entrance: brand, headline, support copy, and primary action reveal in reading order over --ng-duration-reveal with a maximum 60ms stagger.
- Depth: the dominant visual shifts no more than 24px or scales between 0.98 and 1 as it enters the viewport.
- Affordance: buttons and links respond over --ng-duration-fast; section reveals use --ng-duration-reveal.

### Product-application default

- Menus and popovers use --ng-duration-fast.
- Drawers, tabs, and shared layout changes use --ng-duration-base.
- New rows or status changes animate only when movement helps the user locate the change.
- Avoid global page fades during routine navigation.

### Reduced motion

- Remove parallax, scroll-linked transforms, and stagger.
- Collapse transition and animation durations to 1ms.
- Preserve state changes with immediate visual feedback.

## 13. Agent Prompt Recipes

Use these recipes as internal build direction. Do not paste their design commentary into product copy.

### Product workspace

Create a Nightglass operational workspace on --ng-color-canvas. Use quiet navigation, one dominant working region, and a secondary inspector that becomes a drawer below the large breakpoint. Use aqua for the single primary action and active state. Prefer rows, dividers, and plain layout over dashboard cards.

### Landing hero

Create a full-bleed Nightglass hero. Make the product name unmistakable, keep the headline to two or three lines, constrain copy to --ng-copy-max, include one clear action, and use one genuine product or photographic visual as the dominant plane. Keep the entire first composition within the initial viewport.

### Settings form

Create a compact settings surface with persistent labels, grouped sections separated by spacing or dividers, and one save action. Use surface steps only where grouping needs a boundary. Include clear helper, error, disabled, focus, and success behavior.

### Data view

Create a scan-friendly table or list using hairline dividers, aligned numbers, literal utility headings, direct filters, and one emphasized series or selected state. Preserve labels and comparison on mobile without turning every row into an unrelated card.

## 14. Do and Do Not

### Do

- Start with composition and hierarchy.
- Make the product or task unmistakable in the first viewport.
- Use one visual anchor and one accent.
- Keep copy short and product-specific.
- Use whitespace, scale, cropping, and alignment before chrome.
- Use real content and realistic states.
- Make motion noticeable enough to clarify hierarchy but fast enough to stay responsive.
- Remove a container when plain layout communicates the same structure.

### Do not

- Do not open with a generic SaaS card grid.
- Do not use hero cards, stat strips, floating dashboards, or logo clouds by default.
- Do not add decorative gradients behind routine application UI.
- Do not use several competing accents.
- Do not create pill soup.
- Do not use 16px-or-larger radii across ordinary panels.
- Do not hide brand weakness behind a beautiful image.
- Do not use ornamental icons.
- Do not repeat the same promise across sections.
- Do not use filler copy or design commentary as product copy.
- Do not use a carousel without narrative purpose.
- Do not introduce generated or interactive 3D unless the user explicitly requests it or the existing product requires it.
- Do not copy the branding, assets, screenshots, or language of a reference product.

## 15. Quick Start

Framework-neutral CSS:

- Import `../assets/tokens.css` before project styles.
- Use the --ng-* properties for all visual decisions.
- Set the application canvas to --ng-color-canvas and text to --ng-color-text.

Tailwind CSS v4:

- Import `../assets/tailwind-v4.css` from the Tailwind entry stylesheet.
- Use the ng-prefixed utilities generated by the adapter, such as bg-ng-canvas, text-ng-text, border-ng-border, rounded-ng-md, and shadow-ng-hairline.
- Continue using the base --ng-* properties for tokens without a Tailwind utility namespace.

The Tailwind adapter is optional and introduces no dependency by itself.

## 16. Design QA

### Hierarchy

- Is the product, task, or brand unmistakable in the first screen?
- Can a user understand the page by scanning headings, labels, and numbers?
- Does every section or region have one job?
- Is there exactly one dominant primary action per decision region?

### Composition

- Is there one clear visual anchor?
- Are cards necessary?
- Does the layout remain coherent without decorative shadows?
- Is empty space protecting hierarchy instead of being filled with low-value UI?

### Content

- Is all copy specific, concise, and useful?
- Do application labels sound operational rather than promotional?
- Are empty, loading, error, and success states covered?

### Interaction

- Are hover, focus, pressed, selected, disabled, and loading states distinguishable?
- Does motion improve hierarchy, orientation, or affordance?
- Is reduced motion fully functional?
- Can the experience be completed by keyboard?

### Responsive

- Has the view been inspected at 390px and 1440px widths?
- Is there any unintended horizontal overflow?
- Are touch targets at least 44px?
- Do sidebars, inspectors, tables, and media adapt intentionally?

### Accessibility

- Does text and meaningful UI meet WCAG AA contrast?
- Are labels and accessible names present?
- Is status communicated without color alone?
- Does focus remain visible and ordered?
- Does the page work at 200 percent zoom?

## 17. Reference and Originality

The document structure was informed by Refero Styles and its public agent-readable examples:

- https://styles.refero.design/
- https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1

Nightglass uses original naming, color choices, component guidance, and motion rules. References are for studying design-system structure and quality, not for copying brand identity.
