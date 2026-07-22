# apps/extension/AGENTS.md — VS Code Extension Rules

- Register commands in `package.json` and `src/extension.ts`.
- Keep Webview CSP strict.
- Never load remote scripts in Webview.
- Use `webview.asWebviewUri()` for local assets.
- Use typed messages between extension and Webview.
- Do not assume private Codex extension APIs exist.
- Use generic VS Code IDE events first.
- All optional runtimes must fail gracefully.
