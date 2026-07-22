# Codex IDE Prompt

Use this prompt to continue Codex Avatar Studio without returning to a deleted legacy plan.

```text
Continue Codex Avatar Studio from the current repository state.

Read first:
- AGENTS.md
- docs/PLAN_CHECKLIST.md, especially Current state and the first incomplete required phase
- the scoped AGENTS.md for every directory you may edit
- the repository skill(s) matching that phase

Known baseline:
- The extension and built-in avatar are already alive.
- Local image tracing helpers already exist.
- Avatar package import/validation/activation helpers already exist.
- Blender runner/scripts already exist as an incomplete scaffold.
- Do not recreate the monorepo, state machine, Webview shell, or tracer migration.

Work rules:
1. Inspect git status and preserve unrelated user changes and local assets.
2. Implement only the first incomplete required phase unless the user names another phase.
3. Build a complete user-visible vertical slice; command/helper existence alone is not completion.
4. Keep all asset processing local, preserve source files, and retain SVG fallback.
5. Keep Blender and advanced runtimes optional.
6. Run phase-appropriate tests and record command/manual evidence in docs/PLAN_CHECKLIST.md.
7. Mark checkboxes only after the implementation and verification succeed.

End with:
Completed phase:
Completed tasks:
Verification commands and observed results:
Files changed:
Open blockers:
Next unchecked task:
```

Skill routing for the active plan:

- Phases 1–2: `$vscode-extension-architect` and `$webview-avatar-designer`
- Phases 3–4: `$svg-vector-pipeline` plus the extension/Webview skills
- Phase 5: `$webview-avatar-designer`
- Phases 6–8: `$blender-technical-artist` plus the extension/Webview skills
- Phase 9: `$qa-release-engineer`
