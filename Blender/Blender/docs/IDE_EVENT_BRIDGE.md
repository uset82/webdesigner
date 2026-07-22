# IDE Event Bridge

The extension listens only to public VS Code events and forwards normalized, local events to the avatar Webview:

- active editor changes, throttled document changes, saves, diagnostics, debug sessions, tasks, terminals, and workspace-trust grants;
- task process exit codes map to success or error states;
- diagnostics are trailing-debounced, typing is trailing-throttled, and inactivity moves the avatar through idle to sleeping;
- `codexAvatar.emitEvent` is an optional command hook for other extensions. It accepts a public `IdeAssistantEvent` name and an optional JSON-serializable payload.

The bridge does not read private Codex or editor-internal state. Assistant/Codex events can be supplied through the public command hook, while unsupported or unavailable VS Code event surfaces are ignored safely. Event payloads are passed to the existing Webview sanitization boundary before transport.
