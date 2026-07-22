# AGENTS.md — Codex Avatar Studio

## Source of truth

- The only active implementation plan is [`docs/PLAN_CHECKLIST.md`](docs/PLAN_CHECKLIST.md).
- Do not recreate or follow deleted legacy/root plans. Historical plans remain in Git history only.
- Treat the current working extension as the baseline; inspect before changing and do not restart from Phase 0.

## Working rules

- Read the scoped `AGENTS.md` for any directory you edit.
- Use the relevant repository skill for extension, Webview, SVG, Blender, runtime, GitHub, or QA work.
- Implement the first incomplete required phase in the canonical plan unless the user names another phase.
- Mark a checkbox only after implementation and proportionate verification succeed; record evidence in the plan.
- Preserve unrelated user changes and local/untracked assets.
- Keep image, SVG, avatar-package, and Blender processing local. Do not add remote asset services.
- Preserve strict Webview CSP, typed bridge validation, workspace trust, safe local paths, SVG sanitization, reduced motion, and the built-in SVG fallback.
- Blender and advanced runtimes must remain optional and fail gracefully.
- Do not imply that bitmap tracing creates a rigged/animated character or that Blender automatically converts arbitrary pictures into production 3D avatars.

## Blender MCP

- Use only the project-scoped `blender` MCP server and its allowlisted tools.
- Treat `execute_blender_code` as arbitrary local code execution and require the configured approval prompt.
- Keep PolyHaven, Sketchfab, Hyper3D, Hunyuan, telemetry, and other network-backed Blender integrations disabled.
- Work on explicit copies under `.codex-avatar`; never overwrite a user-selected source scene.
- Keep local-only Cholita source, GLB, SVG, preview, and reports out of Git and VSIX artifacts.
