# Codex GPT + Blender MCP in WebDesigner

**Describe anything. Codex builds it. Vision closes the loop.**

Most Blender demos begin with a game character, because a robot knight appearing from a sentence is easier to sell than a properly lit shampoo bottle.

That is also the narrowest way to read what is happening.

The larger shift is that **Codex / GPT** can be connected to Blender through MCP inside WebDesigner, given a description of a scene, allowed to build the first version inside the real application, shown the viewport it produced, and then asked to correct the parts that do not match the original request.

In this project that path is not a one-off chat trick. It is the `blender-mcp` skill:

- Activated when `StackSelection.integrations` includes `blender-mcp`, when `TaskIntent.constraints.requiresBlenderMCP` is true, or when the user explicitly asks for Blender scene work
- Routed toward a **vision + tool-use** model (preferred: **GPT-5.4** under the OpenAI / Codex agent path)
- Bound to a restricted Blender MCP server on `localhost:9876`
- Expected to emit `blender-scene-spec`, `blender-render`, `blender-review-log`, and optional `exported-asset` entries into the `ArtifactManifest`

WebDesigner stays capability-first: roles are not hard-bound to a single vendor forever. For this skill, GPT-class models with strong coding, vision, and tool use are the practical default — the same class of agent already used for long-running IDE work under Codex.

For most people, the wall in front of 3D was never imagination. It was Blender itself: the shortcuts, node graphs, modifiers, coordinate systems and several hundred controls standing between a clear idea in your head and an object that does not look like it was assembled during an evacuation.

Codex does not remove the craft of 3D work, but it changes when that craft becomes necessary. You can begin with direction instead of interface knowledge, get an editable first version in front of you, and spend your time judging the result rather than searching for the panel that controls light intensity.

---

## What the bridge actually does

Blender MCP is built from two main pieces: an addon running inside Blender and an MCP server that passes the model’s tool calls into the application through a socket connection.

WebDesigner’s configuration is deliberately narrower than a free-for-all creative plugin:

| Piece | Project default |
|-------|-----------------|
| Host | `localhost` only |
| Port | `9876` |
| Transport | `stdio` via `uvx blender-mcp` (pinned addon / setup under `Blender/scripts/`) |
| Inspection tools | `get_scene_info`, `get_object_info`, `get_screenshot` (no approval) |
| Mutation tool | `execute_blender_code` (**requires approval**) |
| Remote asset / gen | Poly Haven, Sketchfab, Hyper3D, Hunyuan, telemetry — **disabled** |
| Exports | `.codex-avatar/exports/blender/` or the generated workspace asset directory |

Once connected, Codex can create, modify and delete objects, inspect the scene, apply materials, move cameras and lights, and run Python against Blender’s `bpy` API — but only through that allowlist.

The important capability is not object creation by itself.

The important capability is that Blender MCP can return **screenshots of the viewport**, which means the model does not have to send commands into the application and blindly assume that everything worked. It can build a scene, inspect the visible output, notice that the camera is aimed too high or that the subject is disappearing into the background, change the relevant settings and produce another version.

That feedback loop is what separates this from asking Codex to write a Blender script.

A script can create technically valid geometry while producing an awful image. It can place a camera inside the product, point the lights at the wall and finish successfully because the code ran without errors. Once Codex can see the render, the success condition changes from “the command executed” to “the result resembles what the user described.”

The workflow becomes simple enough to explain in one sentence:

> Describe the result, let Codex construct it, show Codex what it made, and keep adjusting the scene until the obvious gap has narrowed.

---

## The useful range is wider than game assets

Game characters dominate demos because they are immediately recognizable. For WebDesigner the useful targets are closer to shipped product work.

### Product visualization

Describe a speaker, perfume bottle, watch or fictional device. Ask Codex to create the main geometry, apply materials, build a studio-lighting setup and frame several camera angles. After the first capture, request targeted revisions: more transparent casing, less edge distortion, reflection moved off the logo, darker grade for a website header.

Those are ordinary client revisions — except Codex edits the **existing** Blender scene instead of regenerating a completely different image and hoping the product remains recognizable.

### Interior concepts

Block out a room, place furniture, establish materials, choose an initial sun angle, produce several compositions. Then ask for denser layout, warmer lighting, lower furniture or an evening version without manually rebuilding the space.

### Motion design

Procedural forms, extruded typography, animated arrays, abstract tunnels, geometric loops, floating chrome for a landing page that needs to look over-budget. These scenes are often systems of parameters rather than hand-sculpted objects — a good fit for an agent that writes Python, drives modifiers and inspects frames.

### Simple functional objects

A phone stand, enclosure, clip or mounting bracket from dimensions becomes an editable mesh quickly. This is also where “looks correct” and “is correct” diverge. A convincing render is not proof that the holes line up.

### WebDesigner end-to-end

The happy path is often:

```text
User brief
  → plan / stack (requiresBlenderMCP or integrations: blender-mcp)
  → design + build via blender-mcp skill
  → build → screenshot → inspect → fix loop
  → export GLB / PNG
  → generated SPA or Next.js workspace
  → optional img2threejs handoff for interactive Three.js code
```

The control plane stays separate from the deployable app. Blender is an optional production tool — not a hard dependency of the scaffolded site or the Codex Avatar Studio extension fallbacks.

Related: [Blender MCP + img2threejs Integration](./integration-img2threejs.md).

---

## What a real session looks like

The worst way to use Codex inside Blender is to request a complete cinematic commercial in one enormous prompt and wait for perfection.

That usually produces an enormous first attempt, which is not quite the same thing.

A better session follows the skill’s staged process:

1. **Connection** — `get_scene_info` must succeed
2. **Composition** — main objects, camera, basic layout
3. **Materials** — initial Principled-style assignments
4. **Lighting** — studio or environment rig
5. **Refinement** — screenshot-driven corrections (cap iterations)
6. **Export** — GLB / PNG (+ optional `.blend` copy), never overwrite the user’s only source scene

Example brief (matches the project scenario):

> Create a premium product render of a transparent handheld gaming console with visible internal components, studio lighting, and a dark reflective surface. Export the final scene as a GLB for a Three.js product page.

Codex can create the basic body, screen, controls and internal pieces, assign initial materials, position the camera and establish a lighting rig. It then captures the viewport and evaluates what is visible.

Under the prompt, Codex is mostly writing Python against Blender’s API:

```python
import bpy

bpy.ops.mesh.primitive_cylinder_add(radius=0.7, depth=1.6)
bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
bpy.context.object.data.energy = 800
bpy.ops.object.camera_add(location=(5, -6, 3))
bpy.context.scene.camera = bpy.context.object
```

The script itself is basic. The useful part begins after `get_screenshot`, when the model inspects the image, adjusts camera, lighting or materials, and runs again.

**Build → render → inspect → fix.**

The first result might be recognizably correct while still having several obvious problems: transparent casing hiding internals, wide lens making the console look thick, a hot reflection across the screen.

Those become specific scene changes — transmission and roughness, separated lighting for shell vs internals, longer focal length, camera backed off, softened key light — then another capture.

This is the same maker-and-checker pattern that made coding agents more useful than one-shot generators, except the feedback is visual rather than a test suite. WebDesigner records the loop as artifacts so a later Builder or Reviewer stage can continue without guessing what happened in Blender.

After each screenshot the skill expects an explicit decision:

| Decision | Meaning |
|----------|---------|
| `continue` | Matches intent; advance stage |
| `refine` / `refine-scene` | Targeted fixes; iterate |
| `request_input` | Need user clarification |
| `stop` | Cannot achieve result; explain limitation |

The model does not need the perfect scene on the first attempt. It needs access to the current result, tools that can change it, and enough persistence to repeat the process instead of declaring victory because Blender did not crash.

**GPT-5.4** is a logical primary model for this workflow in WebDesigner: high coding, high vision, high tool use, preferred on `build`, and present in the `blender-mcp` skill override so routing favors screenshot-capable agents over pure text coders.

---

## What “fixes itself” actually means

The headline makes self-correction sound more magical than it is.

Codex is not developing artistic taste while staring at the render. It is identifying **visible mismatches**, reasoning about which Blender settings probably caused them, and attempting a **targeted** correction.

This works reasonably well when the mistake points toward a concrete action:

- Object outside the frame → move or reframe the camera
- Intersecting geometry → change position or scale
- Clipped highlights → reduce light energy or change angle
- Missing material → verify assignment and slots

It becomes much less reliable when the problem is subjective. A composition can feel weak, an animation can lack weight, a product can look cheap, and a technically polished render can still be completely forgettable. Codex may propose a longer lens, softer shadows or a different background — but Blender has no `make_this_less_generic` operator.

The feedback loop is good at reducing visible mistakes.

It is less effective at rescuing a boring idea.

That distinction matters because the last part of professional creative work is rarely about whether the object exists. It is about whether the proportions feel intentional, whether the motion has rhythm, whether the lighting communicates anything, and whether the scene looks different from the other five hundred renders generated with the same vague request for something “premium.”

---

## Where describing it stops being enough

**Precision.** Codex can create a simple printable part from measurements, but anything expected to fit a real mechanism still needs tolerance checks and physical validation. The skill contract is explicit: visualization, not CAD.

**Topology.** A scene can look good from one camera while containing messy geometry, unnecessary subdivisions, broken normals or a hierarchy that looks like three conflicting instructions mid-task. Fine for a still; painful for rigging, simulation, clean export or handoff to another artist.

**Organic modeling.** Creatures, faces and natural surfaces depend on anatomy and subtle form that a single flat screenshot cannot fully judge. The silhouette may work; orbiting the camera may not.

**Animation.** The model can inspect frames, positions and keyframe values, but weight and timing live between frames. Use Blender-side animation QA skills (contact sheets, silhouette stability, flicker, export truth) when motion matters more than a pretty still.

So the honest version is not that Codex replaces the 3D artist.

It moves the starting point.

An experienced artist begins with something visible and spends hours on topology, composition, materials and motion instead of blank-viewport setup. A beginner gets past the interface wall. A small studio — or a WebDesigner pipeline generating a marketing site — tests more directions before committing production time.

The final stretch still belongs to whoever can tell the difference between technically finished and actually good.

---

## The security problem nobody puts in the demo

Blender MCP can execute arbitrary Python inside Blender. That is why the agent can control so much of the application — and why this setup deserves more caution than a normal creative plugin.

WebDesigner’s restricted path is intentional:

- Local host only
- Four-tool allowlist
- Inspection automatic; **`execute_blender_code` behind approval**
- Remote generation integrations off
- No overwriting user-selected source scenes
- Exports stay under trusted workspace roots (see Codex Avatar Studio pipeline docs)

That does not make the project magically safe. It makes the blast radius understandable.

An agent with access to Blender’s Python environment has meaningful execution capabilities on the machine running it. Save work. Do not experiment inside the only copy of a client project. Treat unfamiliar configurations as software with real permissions, not a harmless chat extension.

The model may only be building a glass perfume bottle.

It is still holding power tools.

---

## How this maps onto WebDesigner stages

| Stage | Role with Blender MCP |
|-------|------------------------|
| `plan` | Normalize brief into `TaskIntent`; set `requiresBlenderMCP` / stack integration |
| `design` | Scene thesis, content plan, camera/mood; optional Stitch UI around the 3D hero |
| `build` | MCP loop: compose → material → light → refine → export into generated workspace |
| `security` | Treat `execute_blender_code` as local code execution; keep approvals and allowlists |
| `review` | Vision check of renders vs brief; desktop/mobile page composition if assets land in UI |
| `deploy` | Ship the **app** workspace; Blender remains offline production tooling |

Skill contract artifacts: `blender-scene-spec`, `blender-render`, `blender-review-log`, `exported-asset`.

Setup entry points (Codex Avatar / contributor path):

```bash
pnpm setup:blender-mcp
pnpm verify:blender-mcp
```

Restart Blender, start a new Codex task, confirm the MCP panel is listening on `localhost:9876` with remote integrations disabled. Full pipeline notes live under `Blender/docs/BLENDER_PIPELINE.md`.

---

## The barrier was the interface

The important shift is not that Codex GPT can generate another 3D object.

The important shift is that a general-purpose coding agent — routed through WebDesigner’s capability-first stack — can enter professional creative software, manipulate the real project, inspect the visible result and continue working from what it sees — then export assets into a generated product workspace instead of leaving a one-off `.blend` orphaned on disk.

Blender remains complicated, but more of that complication can sit behind the conversation and the skill contract. You do not need the exact modifier, material node or Python function before the first version exists on screen. You describe the outcome and direct corrections once something is visible.

That changes where human value begins.

Less time translating ideas into interface operations. More time judging proportion, accuracy, movement, and whether the object deserves to exist — and whether it is good enough for a Next.js product page, a React SPA hero, or a WebGL avatar path.

Start with something deliberately unremarkable: a bottle under studio lighting, a chair in an empty room, a logo with real depth, or a product rotating on a dark surface. Let Codex build the first version, let it inspect the capture and correct the obvious problems, then take control where precision and taste matter more than tool access.

**Codex can operate Blender now — through WebDesigner’s `blender-mcp` path.**

Someone still has to tell it when the result looks stupid.

---

## Quick reference

| Item | Value |
|------|--------|
| Skill | `.antigravity/skills/blender-mcp/` |
| OpenAI agent overlay | `agents/openai.yaml` |
| MCP server id | `blender` |
| Preferred models (skill override) | `gpt-5.4` first, then other vision-capable fallbacks |
| Required capabilities | `vision`, `toolUse`, `reasoning` |
| Scenario fixture | `.antigravity/runtime/scenarios/blender-mcp.intent.json` |
| Host docs | `Blender/docs/BLENDER_PIPELINE.md`, `Blender/docs/SECURITY_PRIVACY.md` |
| Companion skill | `img2threejs` when interactive Three.js factories are needed |

### Starter prompts

- Product shot of a glass perfume bottle on marble with soft studio lighting; export PNG + GLB
- Minimalist living room with natural light and modern furniture; three camera angles
- Looping rotation of chrome geometric forms for a landing-page hero
- Transparent handheld console on dark reflective surface; export GLB for Three.js
