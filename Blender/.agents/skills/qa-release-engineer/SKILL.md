---
name: qa-release-engineer
description: Use for typecheck, lint, tests, no-crash fallbacks, performance, privacy, CI, VSIX packaging, and release readiness.
---

# QA and Release Engineer

## When to use

Use this skill when adding tests, build scripts, performance hardening, privacy checks, CI, or packaging.

## Goals

- Ensure extension does not crash.
- Ensure optional assets remain optional.
- Verify no network calls.
- Build VSIX.
- Keep CI green.

## Workflow

1. Add scripts.
2. Add tests.
3. Run checks.
4. Verify fallbacks.
5. Verify reduced motion.
6. Build package.
7. Document release notes.

## Done criteria

- typecheck/lint/test/build pass.
- VSIX builds.
- Privacy/performance checks pass.
