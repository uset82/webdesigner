# Runtime Acceptance Tests

## Routing
- Verify planning chooses a reasoning-capable model with required tool access.
- Verify build chooses a coding-capable model and falls back according to `provider-registry.json`.
- Verify user overrides are rejected when they violate hard stage requirements.

## Handoffs
- Verify a second model can continue using only `ArtifactManifest` plus emitted artifacts.
- Verify every stage appends enough metadata to resume without hidden session context.

## Stack Selection
- Verify the planning stage emits a layered `StackSelection`.
- Verify the planner never reports Prisma, MongoDB, MySQL, or Google Maps as top-level framework choices.
- Verify animated interface requests on Next.js or React/Vite add `animate-ui` to `integrations`.
- Verify static UI, rendered-video, Flutter, and backend-only requests do not add `animate-ui` automatically.

## Design Provider
- Verify Stitch is preferred when available.
- Verify missing Stitch credentials produce fallback artifacts that still enable code generation.
- Verify design-led frontend requests emit visual-direction artifacts such as a mood board, content plan, or motion plan when applicable.

## Security
- Verify the `security` stage runs before final review or deployment.
- Verify Codex Security is preferred for the security stage when available.
- Verify security output includes a threat model and validated findings.
- Verify patch proposals are recorded as reviewable artifacts rather than silently applied.

## Host Boundary
- Verify Antigravity-only features are described in the host adapter layer, not in core runtime contracts.

## Frontend Verification
- Verify simple landing-page requests can stay on lower reasoning settings when the selected model supports that control.
- Verify generated frontend work is checked on desktop and mobile when browser or computer-use tooling is available.
- Verify hero/header composition, brand hierarchy, overlap safety, and motion behavior are explicitly reviewed before release handoff.
- Verify Animate UI components preserve keyboard behavior and provide a usable reduced-motion state.

## Scenarios
- `scenarios/seo-fullstack.intent.json` should resolve to `scenarios/seo-fullstack.expected-selection.json`.
- `scenarios/cross-platform-mobile.intent.json` should resolve to `scenarios/cross-platform-mobile.expected-selection.json`.
- `scenarios/animated-ui.intent.json` should resolve to `scenarios/animated-ui.expected-selection.json` and include the conditional `animate-ui` integration.
