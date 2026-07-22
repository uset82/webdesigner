---
name: figma-use-slides
description: "This skill helps agents use Figma's use_figma MCP tool in the Slides context. Can be used alongside figma-use which has foundational context for using the use_figma tool."
disable-model-invocation: false
---

# use_figma — Figma Plugin API Skill for Slides

This skill contains Slides-specific context for the `use_figma` MCP tool. The [figma-use](../figma-use/SKILL.md) skill provides foundational context for plugin API execution via MCP as well as the full Figma plugin API for more advanced use-cases that are not described here.

**Always include `figma-use-slides` in the comma-separated `skillNames` parameter when calling `use_figma` for Slides operations. If this skill was loaded via an MCP resource, you MUST prefix the name with `resource:` (e.g. `resource:figma-use-slides`).** This is a logging parameter used to track skill usage — it does not affect execution.

## Choosing How to Build a Slides Deck

If your environment also provides a `generate_deck` tool, choose **one** approach per deck request — do not call both for the same deck.

### When to use which

**`use_figma` + this skill (default):** Handles any Slides task — new decks, edits to existing decks, brand-matched designs, reference-file styling, iterative refinement, speaker notes, and full creative control over layout, color, and typography. Use this for most requests.

**`generate_deck`:** Generates a complete deck in a single call using prebuilt, curated templates. Useful for quick, straightforward decks where the user doesn't need custom design, brand matching, or reference-file styling. It cannot use custom templates, cannot reference other Figma files for design direction, and does not support iterative editing or follow-up modifications through the conversation.

When in doubt, default to `use_figma` + this skill — it covers everything `generate_deck` can do and more.

### Pick one and commit

Once you choose an approach for a deck, complete the entire request with that approach. Do not generate a deck with `generate_deck` and then also create or populate a file with `use_figma` — the user ends up with duplicate, conflicting artifacts and a confusing experience.

## Critical Rules (Slides-specific)

1. **Newly created Slides files have a default light theme.** When a Slides file is created via `create_new_file`, a default light theme is automatically initialized. This theme is structural scaffolding — you should overwrite the theme's color variables and text styles with your own design direction for the deck you're building. Do not rely on or be influenced by the default light theme tokens.
2. **MUST `appendChild` BEFORE setting `x`/`y` — for every node, at every level of nesting.** Newly created nodes are silently auto-parented to a slide context at absolute `(240, 240)` (the slide grid's `GRID_PADDING`). Writing `x`/`y` before `appendChild` causes the value to be stored against that hidden origin; the node then lands at `(intended − 240, intended − 240)` once you attach the real parent. The bug is **intermittent** — some frames in the same script escape it, so a working test is not proof you're safe. **Signature to recognize:** if any node ends up `(−240, −240)` from where you set it, your code set `x`/`y` before the final `appendChild`. Do NOT try to compensate by adding 240 back — that produces worse output on retry. Fix the order instead. See [slide-gotchas.md](references/slide-gotchas.md#position-after-appendchild-critical) for the helper pattern that makes the order impossible to get wrong.
3. **SLIDE_GRID and SLIDE_ROW are opaque nodes** — do not access `.fills`, `.effects`, or layout properties on them. Only `SLIDE` nodes (type `'SLIDE'`) extend `BaseFrameMixin`. **Exception:** `SLIDE_ROW.name` IS settable — that's how plugins rename slide sections (e.g. `slideRow.name = "Intro"`). See [slide-lifecycle.md](references/slide-lifecycle.md).
4. **`get_metadata` does NOT work on Slides files.** Use `use_figma` read-only scripts for validation. Return created node positions in `closePlugin()` output and verify no overlapping bounding boxes.
5. **Do NOT call `figma.createPage()` in Slides.** It throws `TypeError: figma.createPage no such property 'createPage' on the figma global object` — `createPage()` is a Design-file API only (`figma.com/design/...`); the Slides URL is `figma.com/slides/...`. Use the slide grid (`SLIDE_GRID` / `SLIDE_ROW` / `SLIDE`) to organize deck structure instead — see [slide-lifecycle.md](references/slide-lifecycle.md) and [slide-grid.md](references/slide-grid.md).
6. **Never delete existing slides to rebuild them.** When asked to improve, redesign, or restyle a deck, modify the existing slides in place. Only delete slides when the user explicitly asks to "start over" or "redo from scratch."

## Design Thinking

Not every task needs the same depth of design thinking. Before doing anything, identify which gear you're in:

- **Content/property edits** — changing text, swapping a color, updating a number, fixing alignment, resizing an element. Skip design thinking. Just make the change and match what's already there.
- **Structural additions** — adding slides, reworking a section's layout, changing the deck's color palette, introducing a new visual element. This includes requests to "improve," "redesign," or "restyle" a deck — those are in-place edits to what's already there, not a new deck. Design thinking applies, but in *inherit* mode: the existing deck is your design language. Inspect it, match its palette, type, spatial habits, and motifs. Extend the deck's existing character rather than reinventing it.
- **New deck creation** — building a deck from scratch or from a blank file. Full design thinking applies as described below.

For structural additions to existing decks: run the inspection scripts (below) and take screenshots before making changes. The answers to "what color story?" and "what type treatment?" are already in the file — your job is to read them and stay consistent. The design principles in [slide-design.md](references/slide-design.md) describe what you're *matching*, not what you're *choosing*.

### New deck design process

Before writing any Plugin API code for a new deck, decide what it should *feel* like. Figma users have high visual expectations — a deck that looks like it came out of a generic template generator will stand out for the wrong reasons.

1. **Read the brief.** What is the deck communicating, and to whom? An investor pitch, a team retrospective, a product launch, and a technical deep-dive all demand different visual treatments. The design should be inseparable from the content.
2. **Check for a design language.** Before inventing anything, look at what the user already gave you. Brand guidelines in the prompt — color palettes, typography specs, logo rules, tone descriptors — are design decisions that have already been made. A link to a reference Figma file is a design language you should study, not glance at. The more specific the user's inputs, the less you should invent on your own. When the user provides a reference, your job shifts from *designer* to *interpreter*: extract the design language and apply it faithfully to new content.
3. **Take a position — on what's left.** If the user supplied a full brand system, your creative latitude is in layout, pacing, and composition — not in color or type. If they gave you a single reference slide for inspiration, you have more room but should still echo its character. If they gave you nothing, then you own every decision — choose a color story, a type treatment, a way of organizing space, and follow through on it across every slide. A deck with a clear perspective (even a quiet one) always reads better than one that plays it safe on every decision. The scope of "take a position" scales inversely with what the user provided.
4. **Give it a signature.** Every good deck has at least one element you'd recognize if you saw it out of context: a distinctive palette, an unexpected layout cadence, a recurring shape language. When working from brand guidelines, the signature should *come from* that brand language — amplify something that's already there rather than adding something foreign. When designing from scratch, decide what the signature is before you start building.
