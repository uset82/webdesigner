# V1 Deployment Matrix

## Next.js
- **Preferred target**: Vercel
- **Why**: Closest fit for SSR, routing, and preview workflows

## React/Vite
- **Preferred targets**: Vercel or Netlify
- **Why**: Strong static hosting support with simple SPA deployment

## Node/Express
- **Preferred targets**: Docker or Cloud Run
- **Why**: Clear fit for long-running API services

## Flutter
- **Preferred targets**: App Store and Google Play for clients, optional Cloud Run for paired backend services
- **Why**: Mobile delivery is store-based, not static-site hosting

## Rule
Do not emit deployment guidance for out-of-scope runtimes as if they were first-class v1 guarantees.
