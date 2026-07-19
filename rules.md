# Agent Rules

These rules apply to every provider and model used by WebDesigner.

## 1. Capability Routing First
- Do not bind roles to specific vendors in prompts or docs.
- Resolve model choice through the routing policy and provider registry.
- User override is allowed, but the runtime must still enforce hard capability and tool constraints.

## 2. Antigravity Boundary
- Antigravity is the primary host for v1.
- Antigravity-specific planning, review, browser, and tool semantics must stay behind the `HostAdapter`.
- The orchestration core must remain host-agnostic.

## 3. Layered Stack Selection
- Do not answer with a single mixed "framework" label when the real decision spans multiple layers.
- Every buildable request must resolve into:
  `experience type`, `frontend runtime`, `backend runtime`, `data layer`, `deployment target`, and `optional integrations`.
- Prisma, MongoDB, MySQL, and Google Maps are supporting layers or integrations, not top-level framework peers.

## 4. Artifact-Driven Handoffs
- Every stage must emit structured artifacts recorded in the `ArtifactManifest`.
- A later model must be able to resume work using only the manifest plus the generated artifacts.
- Do not rely on hidden chain-of-thought or provider-specific session memory.

## 5. Security Stage
- Generated code must pass through a dedicated `security` stage before final review or deployment.
- The security stage must emit a threat model, validated findings, and optional patch proposals.
- OpenAI Codex Security is the default provider path for this stage when available in the active environment.
- Security patch proposals must be reviewed before application; do not assume auto-remediation.

## 6. Curated V1 Scope
- V1 prioritizes reliable support for:
  `Next.js`, `React/Vite`, `Flutter`, and `Node/Express`.
- Additional frameworks may be documented, but they are out of the guaranteed generation path until contracts and routing are proven.

## 7. Design Provider Policy
- Stitch is the default design provider.
- Stitch must be accessed through the `DesignProvider` contract.
- Missing Stitch credentials or runtime support must degrade to a valid non-Stitch design artifact set.

## 8. Configuration Placement
- Provider identifiers, model identifiers, auth requirements, and routing defaults belong in structured config under `.antigravity/runtime/`.
- Prose docs may describe behavior, but structured config is the source of truth.

## 9. Frontend Quality Bar
- The first viewport of a landing page or branded page must read as one composition.
- The brand or product name must be a hero-level signal on branded pages.
- Landing pages default to a full-bleed hero or dominant visual plane; inset hero cards and floating promo blocks are not the default.
- The hero should usually contain only the brand, one headline, one short supporting sentence, one CTA group, and one dominant image.
- Cards are opt-in and should exist only when they materially help interaction.
- Each section gets one job, one dominant visual idea, and one primary takeaway.
- Use a real visual anchor instead of relying on gradients or abstract decoration alone.
- Visually led work should ship with 2-3 intentional motions, not generic animation noise.
- When `requiresAnimatedUI` is true on a compatible React stack, select the `animate-ui` integration and install only the registry components required by the motion plan.

## 10. Frontend Verification Loop
- Use uploaded or pre-generated images first. Otherwise generate images. Do not hotlink web images unless the user explicitly requests them.
- For simple websites, start with lower reasoning settings when the active model supports that control. Increase reasoning only when complexity requires it.
- When browser or computer-use tooling is available, inspect rendered frontend work across desktop and mobile before final review.
- Validate brand presence, hero/header fit, contrast, spacing, overlap, navigation, state handling, and motion behavior before sign-off.
