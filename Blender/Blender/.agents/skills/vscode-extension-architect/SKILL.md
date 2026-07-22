---
name: vscode-extension-architect
description: Use for VS Code extension commands, Webview providers, settings, activation, secure CSP, and IDE event integration for Codex Avatar Studio.
---

# VS Code / Codex Extension Architect

## When to use

Use this skill when implementing `apps/extension`, command registration, Webview panel, extension settings, output channels, or IDE event listeners.

## Goals

- Build a stable VS Code-compatible extension.
- Keep optional runtimes behind graceful fallbacks.
- Avoid private extension APIs.
- Use secure Webview patterns.

## Workflow

1. Inspect existing extension/package setup.
2. Register commands and views.
3. Implement Webview provider with strict CSP.
4. Add typed message bridge.
5. Add settings and output channel.
6. Run extension compile/build checks.
7. Mark checkboxes in `docs/PLAN_CHECKLIST.md`.

## Done criteria

- Extension activates.
- Commands appear.
- Webview loads.
- No CSP errors.
- Acceptance criteria are marked.
