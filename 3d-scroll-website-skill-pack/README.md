# Build 3D Scroll-Animated Websites — Claude Code Skill Pack

Hey — you commented **"AI"** on the reel, so here's the full setup.

This pack contains the exact Claude Code skill I used to build the 3D scroll-animated site from the video, plus the 7 deep-dive guides on the stack, the scroll-animation math, the design system, and every pattern I layered in.

By the end of this README you'll have:

1. The skill installed in Claude Code
2. A new Next.js project scaffolded with the full stack
3. A working canvas frame-sequence scroll animation playing in your browser

Expected time: **~1 hour**, same as the reel.

---

## What's in this pack

```
skill-pack/
├── README.md                           ← you are here
└── 3d-scroll-website/
    ├── SKILL.md                        ← the skill (install this)
    └── references/
        ├── 01-tech-stack.md            ← every library + exact version
        ├── 02-animation-techniques.md  ← Framer Motion, CSS 3D, SVG paths, typewriter
        ├── 03-scroll-animation-deep-dive.md  ← the frame-sequence math
        ├── 04-design-patterns.md       ← neumorphic shadows, palette, typography
        ├── 05-component-architecture.md  ← file layout + SSR rules
        ├── 06-performance-optimization.md  ← RAF, direct DOM, preloading
        └── 07-claude-code-guide.md     ← prompting tips + workflow
```

---

## Step 1 — Install Claude Code

If you don't already have Claude Code installed, grab it here: https://claude.com/claude-code

Once installed, open a terminal and run `claude` once to log in.

---

## Step 2 — Install the skill

Claude Code loads skills from a folder in your home directory. Copy the skill folder there:

**macOS / Linux:**
```bash
mkdir -p ~/.claude/skills
cp -r 3d-scroll-website ~/.claude/skills/
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills"
Copy-Item -Recurse 3d-scroll-website "$HOME\.claude\skills\"
```

That's it. The next time you start Claude Code it'll pick up the skill automatically.

### Verify the install

Start Claude Code from any folder and ask:

> what skills do you have available?

You should see `3d-scroll-website` in the list. If you don't, double-check that `SKILL.md` is directly inside `~/.claude/skills/3d-scroll-website/` (not nested one folder deeper).

---

## Step 3 — Build your site

Open a terminal in an empty folder where you want the new project, start Claude Code with `claude`, and paste a prompt like:

> Build me a premium 3D scroll-animated landing page for a design agency called "Northlight." Use the 3d-scroll-website skill. The hero should have a canvas frame-sequence animation, then a projects showcase section, a bento features grid, testimonials, an FAQ, and a final call-to-action.

Or keep it simple:

> Scaffold a new 3D scroll-animated site using the 3d-scroll-website skill. I'll tell you what I want section by section.

Claude will read the skill, scaffold the Next.js project, install dependencies, wire up Lenis smooth scroll, and start building sections.

---

## Step 4 — Add your frame sequence

The hero canvas animation needs **pre-rendered frames** (100–120 JPG images exported from Blender, Cinema 4D, or After Effects). The skill handles all the code; you supply the frames.

Three ways to get frames:

1. **Render your own** — animate a 4-second shot in Blender at 24–30 fps, export as JPG sequence.
2. **Commission an artist** — any 3D freelancer can deliver a frame sequence in a day or two.
3. **Use a stock sequence** — some stock sites sell product-animation sequences ready to drop in.

Place the frames in `public/frames/` named `frame_0001.jpg`, `frame_0002.jpg`, etc. The skill file explains the exact naming convention under "Asset pipeline."

If you don't have frames yet, ask Claude to build the site with placeholder frames and swap them in later — everything will still work.

---

## Troubleshooting

**"The skill isn't showing up in Claude Code."**
Check that the path is exactly `~/.claude/skills/3d-scroll-website/SKILL.md`. Run `ls ~/.claude/skills/3d-scroll-website/` — you should see `SKILL.md` and a `references/` folder at the top level.

**"The scroll animation is janky."**
Check the performance rules in `references/06-performance-optimization.md`. Nine times out of ten it's one of: scroll handler updating React state on every tick, canvas missing DPR scaling, or frames not finishing preload before scrolling starts.

**"Next.js errors about App Router / RSC."**
The skill pins Next.js 16, which has breaking changes from earlier versions. If Claude is writing code that looks like Next 13/14 patterns, tell it to read `node_modules/next/dist/docs/` for the current API.

**"Something feels off on Safari / iOS."**
Lenis needs Safari-specific config (higher `lerp`, `syncTouch: false`). The skill covers this under "Smooth scroll (Lenis)" but if Claude skipped it, ask explicitly for the Safari-safe Lenis config.

---

## Want help going further?

Book a 30-min session and I'll walk through your project live:
**[calendly.com/abhishek-devini/30min](https://calendly.com/abhishek-devini/30min)**

— Abhishek / Devini
