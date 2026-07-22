# Avatar Event Protocol

> Phase 2 protocol — version 1

The extension host and Webview communicate only through serializable, versioned messages. The shared schemas live in `packages/avatar-core/src/protocol.ts` and are used at both runtime boundaries.

## Envelope

Every message has a numeric `protocolVersion` field. The current value is `1`.

```json
{
  "protocolVersion": 1,
  "type": "avatar:setState",
  "state": "thinking"
}
```

Unknown message types, missing fields, wrong protocol versions, invalid state/trigger values, out-of-range pose values, and non-JSON payloads are rejected by Zod parsing. Rejection is logged and contained; it must not crash the extension or Webview.

## Extension → Webview messages

| Type | Payload |
| --- | --- |
| `avatar:initialize` | Full validated `AvatarConfig` and `AvatarManifest` bootstrap data |
| `avatar:setState` | One `AvatarState` |
| `avatar:trigger` | One `AvatarTrigger` |
| `avatar:setMessage` | A string or `null` |
| `avatar:setPoseInput` | Normalized cursor, mouth, speech, audio, or scroll values |
| `settings:update` | Full validated `AvatarConfig` |
| `assets:manifestLoaded` | Full validated `AvatarManifest` |
| `debug:event` | Non-empty event name and optional JSON payload |

## Webview → Extension messages

| Type | Payload |
| --- | --- |
| `webview:ready` | No additional fields |
| `command:toggleAssistant` | No additional fields |
| `command:resetSettings` | No additional fields |
| `command:openAssetsFolder` | No additional fields |
| `command:reloadAvatar` | No additional fields |
| `command:vectorizeImage` | No additional fields |
| `command:exportBlender` | No additional fields |
| `settings:update` | A validated partial `AvatarConfig` patch |
| `debug:log` | Non-empty message and optional JSON payload |

## Shared values

The required state set is:

```text
idle, welcome, listening, thinking, speaking, coding, reviewing,
debugging, building, success, warning, error, sleeping
```

The required trigger set is:

```text
blink, look-left, look-right, nod, shake, celebrate, point,
start-speaking, stop-speaking, show-particles, clear-effects
```

Pose inputs are normalized to `0..1`. Values outside that range are rejected at the protocol boundary rather than silently clamped.

## Runtime handling

Use the shared constructors when sending messages:

```ts
postMessage(createExtensionToWebviewMessage({ type: "avatar:setState", state: "thinking" }));
```

Use the shared parsers on every inbound runtime boundary:

```ts
const parsed = parseWebviewToExtensionMessage(unknownValue);
if (!parsed.success) {
  console.warn("Rejected Webview message", parsed.error.issues);
  return;
}
```

The protocol does not grant access to private Codex internals and does not transport remote asset URLs or executable code.

