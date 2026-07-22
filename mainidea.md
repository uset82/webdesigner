# WebDesigner

## Vision
**WebDesigner** is an Antigravity-hosted control plane for generating applications across multiple runtimes. It is not a self-regenerating app core and it is not tied to a single model, provider, or framework. Its job is to normalize user requests, select a layered stack, route each workflow stage to the best available model, and emit structured artifacts so any later model can continue the task safely.

## What V1 Does
1. **Capability-first routing**: Model selection is based on capabilities, tool access, cost, latency, and availability, not fixed role-to-model bindings.
2. **Layered stack selection**: Requests are resolved into `experience type`, `frontend runtime`, `backend runtime`, `data layer`, `deployment target`, and `optional integrations`.
3. **Stitch-first design generation**: Stitch is the default design provider, but it sits behind a `DesignProvider` contract with a documented fallback path.
4. **Frontend quality loop**: Design-led work can use GPT-5.4-style mood boards, generated imagery, and browser verification without breaking the provider-agnostic runtime model.
5. **Dedicated security stage**: Generated workspaces pass through a first-class `security` stage that produces threat models, validated findings, and human-reviewed patch proposals.
6. **Structured handoffs**: Each stage emits artifacts to an `ArtifactManifest` so planning, design, build, security, review, and deployment can move across models without hidden context.
7. **Curated v1 surface**: The initial supported stack matrix is deliberately small and reliable.

## Runtime Architecture
- **Host Adapter**: Antigravity-specific planning, review, browser, tool, and execution features.
- **Orchestration Core**: `TaskIntent`, routing policy, provider registry, skill contracts, security workflow, and artifact manifests.
- **Generated Workspace**: The app or service created for the user in the selected stack. This workspace is separate from the control plane.

## V1 Support Surface
- **SEO/fullstack web**: Next.js
- **SPA web**: React + Vite
- **Cross-platform mobile**: Flutter
- **API/backend**: Node + Express
- **Supporting layers and integrations**: Prisma, MongoDB, MySQL, Google Maps, Animate UI, and img2threejs as optional layers, not peer framework choices

## Source of Truth
- Provider and model metadata lives in `.antigravity/runtime/provider-registry.json`.
- Routing defaults live in `.antigravity/runtime/routing-policy.json`.
- Stack options live in `.antigravity/runtime/stack-catalog.json`.
- Design provider configuration lives in `.antigravity/runtime/design-providers.json`.
- Contracts live in `.antigravity/runtime/INTERFACES.md` and `.antigravity/runtime/schemas/`.
