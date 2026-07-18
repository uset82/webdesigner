# Layered Selection Matrix

Use these rules to derive a `StackSelection` inside the v1 support surface.

- IF `requires_seo` OR `requires_ssr` -> `experienceType=seo-fullstack-web`, `frontendRuntime=nextjs`
- IF `requires_spa_web` AND NOT `requires_seo` -> `experienceType=spa-web`, `frontendRuntime=react-vite`
- IF `requires_cross_platform_mobile` -> `experienceType=cross-platform-mobile`, `frontendRuntime=flutter`
- IF `requires_backend_only` -> `experienceType=api-backend`, `frontendRuntime=none`, `backendRuntime=node-express`
- IF `needs_backend_for_nextjs` -> `backendRuntime=nextjs-route-handlers`
- IF `needs_backend_for_react_or_flutter` -> `backendRuntime=node-express`
- IF `needs_relational_data` -> add `prisma` and choose `mysql` or another configured relational store
- IF `needs_document_data` -> add `mongodb`
- IF `needs_maps` -> add `google-maps`
- IF no visual provider is requested -> `designProvider=stitch`
