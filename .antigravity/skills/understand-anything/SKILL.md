---
name: understand-anything
description: Traverses, parses, and indexes codebases to compile interactive knowledge graphs of architecture layers, file relationships, and domain logic flows.
---
# Understand Anything

## Contract
- **Stage**: `plan`, `review`
- **Input schema**: `.antigravity/runtime/schemas/task-intent.schema.json`
- **Output schema**: `.antigravity/runtime/schemas/artifact-manifest.schema.json`
- **Emits artifacts**: `codebase-knowledge-graph`, `architecture-summary-report`

## Rules
- Perform static code scanning only. Do not run, evaluate, or execute workspace binary logic.
- Map relationships across multiple levels: file imports, class inheritances, function definitions, interface definitions, and call structures.
- Group codebase modules into human-readable logical/domain boundaries (e.g., frontend components, API endpoints, utilities, schema layers).
- Produce context-efficient descriptions so downstream coding agents can read semantic subgraphs rather than raw full-repo contexts.

## Process
1. **Repository Crawling**: Traverse the directory structure, matching active code files while ignoring build directories and third-party node_modules/virtual environments.
2. **Relationship Parsing**: Run static analysis scanners to compile imports, exports, module signatures, and class methods.
3. **Graph Construction**: Generate a knowledge graph mapping nodes (files, modules, objects) and edges (calls, imports, inheritances).
4. **Architectural Analysis**: Analyze logical layers and business flows (e.g., "auth flows", "routing channels", "database layers").
5. **Context Packaging**: Export the codebase graph in structured JSON/Markdown formats, and document in the `ArtifactManifest` to help other agents query details semantically.
