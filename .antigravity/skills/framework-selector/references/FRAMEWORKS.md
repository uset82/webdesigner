# V1 Stack Catalog Summary

This reference mirrors `.antigravity/runtime/stack-catalog.json`.

## Experience Types
- **seo-fullstack-web**: SSR or SEO-sensitive web applications
- **spa-web**: client-heavy web applications where SSR is not required
- **cross-platform-mobile**: iOS and Android delivery from one codebase
- **api-backend**: service or API generation without a first-class frontend

## Frontend Runtimes
- **nextjs**: default for `seo-fullstack-web`
- **react-vite**: default for `spa-web`
- **flutter**: default for `cross-platform-mobile`
- **none**: valid for `api-backend`

## Backend Runtimes
- **nextjs-route-handlers**: default backend pair for Next.js builds
- **node-express**: default backend pair for React/Vite, Flutter, or backend-only builds
- **none**: valid when the request is purely static or design-first

## Supporting Layers
- **prisma**: ORM or data access layer, not a top-level app framework
- **mongodb**: document data integration
- **mysql**: relational data integration
- **google-maps**: product integration, not a runtime choice
- **animate-ui**: optional component-registry integration for animated React UI (`requiresAnimatedUI`)
- **img2threejs**: optional image-to-3D integration for procedural Three.js reconstruction (`requiresImageToThreeJS`)

## Deployment Targets
- **vercel**: preferred for Next.js
- **vercel-or-netlify**: acceptable for React/Vite
- **cloud-run-or-docker**: preferred for Node/Express
- **mobile-store**: required for Flutter distribution
