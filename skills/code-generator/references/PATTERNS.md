# V1 Code Translation Patterns

Apply these patterns only inside the selected generated workspace.

## Next.js
- Convert design artifacts into App Router components.
- Prefer server-rendered routes when the selected experience type is `seo-fullstack-web`.
- Use route handlers when the stack pairs Next.js with backend logic.

## React/Vite
- Convert design artifacts into client components suitable for SPA delivery.
- Pair with `Node/Express` when the stack requires a separate backend.

## Flutter
- Convert design artifacts into widget trees and theme tokens.
- Preserve the design token vocabulary so later review artifacts can compare mobile and web outputs consistently.

## Node/Express
- Generate API routes, middleware, and environment-driven configuration.
- Treat this as a backend runtime, not as a UI translation target.

## Shared Rules
- Keep the control plane outside the generated workspace.
- Use emitted artifacts to make later review independent of the original model.
