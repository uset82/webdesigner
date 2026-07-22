# GitHub Project Setup — Codex Avatar Studio

## Purpose

Create a GitHub Project that lets Codex and the user implement the assistant phase by phase with visible status, labels, milestones, and checkboxes.

## Recommended project

```txt
Title: Codex Avatar Studio — IDE VTuber-lite Assistant
Owner: @me or repository owner
Repository: OWNER/REPO
```

## Board views

- [ ] Roadmap by Phase
- [ ] Kanban by Status
- [ ] Workstream Board
- [ ] Design + Asset Pipeline
- [ ] Runtime Engineering
- [ ] QA / Release

## Fields

Create these fields:

```txt
Status: Backlog, Ready, In Progress, In Review, Done, Blocked
Phase: 0 GitHub + Agents, 1 Repo shell, 2 Extension shell, 3 Webview UI, 4 Avatar core, 5 SVG fallback, 6 IDE events, 7 Rive runtime, 8 Image-to-SVG, 9 SVG layer standard, 10 Blender pipeline, 11 VTuber-lite behavior, 12 WebGL/WebGPU, 13 Live2D adapter, 14 Settings, 15 Asset manager, 16 Testing, 17 Hardening, 18 Packaging
Workstream: architecture, github, codex-agents, extension, webview, avatar-core, svg, rive, blender, live2d, webgl-webgpu, ux-design, qa, release
Priority: P0 critical, P1 important, P2 useful, P3 later
Risk: low, medium, high
```

## Labels

Use `scripts/github/github-labels.json` as source of truth.

## Milestones

- [ ] M0 — GitHub + Codex operating system
- [ ] M1 — MVP IDE extension shell
- [ ] M2 — SVG fallback + Rive runtime
- [ ] M3 — Asset conversion pipeline
- [ ] M4 — Blender + WebGL/WebGPU pipeline
- [ ] M5 — Live2D optional VTuber-lite adapter
- [ ] M6 — Settings, QA, packaging

## Initial issues

Use `scripts/github/github-issues.json` as source of truth.

## Optional GitHub CLI flow

```bash
export OWNER="uset82"
export REPO="your-repo-name"
export PROJECT_TITLE="Codex Avatar Studio — IDE VTuber-lite Assistant"

bash scripts/github/create-codex-avatar-project.sh
```

The script is intentionally conservative. If a GitHub CLI command fails because of permissions or CLI version, create the project manually using this document.

## Codex review

Add this section to PR comments when you want Codex review:

```txt
@codex review for extension stability, Webview CSP, optional runtime fallback, local-only asset processing, and reduced-motion compliance.
```
