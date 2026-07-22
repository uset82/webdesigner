# apps/webview/AGENTS.md — Webview UI Rules

- Use TypeScript and typed bridge messages.
- Respect VS Code theme variables.
- Respect `prefers-reduced-motion`.
- Render SVG fallback first.
- Lazy-load Rive, Live2D, and WebGL renderers.
- Never make network calls from the Webview.
- Avoid animation that blocks coding focus.
