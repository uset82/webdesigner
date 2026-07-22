# SKILLS.md

Codex Avatar Studio uses repository skills in `.agents/skills/<skill-name>/SKILL.md`.
Use these skills when a task matches the listed workstream.

| Skill | Use For |
| --- | --- |
| `vscode-extension-architect` | VS Code commands, activation, settings, Webview providers, CSP, and IDE event integration. |
| `webview-avatar-designer` | React/Vite Webview UI, avatar stage, assistant bubble, settings, reduced motion, and theme-aware UX. |
| `svg-vector-pipeline` | Local image-to-SVG conversion, conservative SVG optimization, layer naming, manifest generation, and vector validation. |
| `blender-technical-artist` | Blender Python automation, SVG line-art export, GLB export, PNG previews, rig conventions, and Blender-to-WebGL assets. |
| `blender-modeling` | Clean Blender topology, transforms, naming, and real-time modeling practices. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-materials` | glTF-safe Principled materials, texture budgets, and material validation. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-animation` | Actions, F-curves, loops, shape keys, NLA, and glTF-compatible animation. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-export` | GLB export, skin/morph constraints, and real-time asset budgets. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `animation-quality-gate` | Contact-sheet, silhouette, loop, flicker, and export-truth review. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `rigging-animation` | Armature hierarchy, weights, deformation, corrective shapes, and rig validation. Pinned from `omer-metin/skills-for-antigravity@e8dcf4e`. |
| `blender-motion-state-inspection` | Blender motion-state, frame-range, contact, and axis inspection. Pinned from `affaan-m/everything-claude-code@ed38744`. |
| `rive-animation-engineer` | Rive runtime integration, state machine inputs, avatar state mapping, triggers, and SVG fallback behavior. |
| `live2d-vtuber-rigger` | Optional Live2D model3 manifests, mouth/eye/breath parameters, and VTuber-lite fallback behavior. |
| `webgl-webgpu-renderer` | Optional Three.js GLB rendering, WebGL2/WebGPU detection, 3D avatar mode, and progressive GPU fallback. |
| Official PixiJS skills | PixiJS runtime and animation reference material: [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills). Reference only; never bundled as a runtime dependency. |
| `github-project-manager` | GitHub labels, milestones, issue templates, project fields, project board documentation, and PR workflow. |
| `qa-release-engineer` | Typecheck, lint, tests, no-crash fallbacks, performance, privacy, CI, VSIX packaging, and release readiness. |

`skills.md` is a lowercase pointer for humans. The actual skill instructions live in `.agents/skills`.

The skills above are development guidance only and are not copied into the VSIX. Their complete source pins and licenses are recorded in `THIRD_PARTY_NOTICES.md`.
