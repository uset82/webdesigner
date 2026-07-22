# packages/asset-pipeline/AGENTS.md — Asset Pipeline Rules

- Keep all processing local.
- Validate input file types.
- Sanitize output paths.
- Treat bitmap tracing as reference/icon workflow, not final character rig workflow.
- Warn on path explosion and huge SVGs.
- Generate manifest entries.
- Do not call external APIs.
