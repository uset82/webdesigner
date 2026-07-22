# Live2D Pipeline

Live2D is an optional VTuber-lite runtime. The app must compile and run without Cubism SDK files, without Live2D assets, and without a configured Live2D runtime. SVG remains the fallback.

## Expected Folder

```txt
avatars/live2d/<avatar-id>/
├── model.model3.json
├── model.moc3
├── textures/
│   └── texture_00.png
├── motions/
│   ├── Idle.motion3.json
│   ├── Talk.motion3.json
│   └── Success.motion3.json
├── expressions/
│   ├── neutral.exp3.json
│   ├── happy.exp3.json
│   └── concerned.exp3.json
└── physics3.json
```

`model.model3.json` should reference the `.moc3`, texture, motion, expression, and physics files with paths relative to the model folder. Keep file names ASCII and stable; manifests may be loaded inside a VS Code webview where URL rewriting is strict.

## Manifest

Use `assets.live2d` and `live2d.model3` for the model3 entrypoint. `live2d.model` is accepted as a legacy alias, but new manifests should use `model3`.

```json
{
  "runtimePriority": ["live2d", "svg"],
  "assets": {
    "svg": "avatars/svg/placeholder-avatar.svg",
    "live2d": "avatars/live2d/default/model.model3.json"
  },
  "live2d": {
    "model3": "avatars/live2d/default/model.model3.json",
    "parameters": {
      "mouthOpen": "ParamMouthOpenY",
      "angleX": "ParamAngleX",
      "angleY": "ParamAngleY",
      "breath": "ParamBreath"
    },
    "motions": {
      "idle": "Idle",
      "speaking": "Talk",
      "success": "Success",
      "error": "Concerned"
    },
    "expressions": {
      "idle": "neutral",
      "speaking": "talking",
      "success": "happy",
      "warning": "concerned",
      "error": "concerned",
      "sleeping": "sleepy"
    }
  }
}
```

## Parameter Mapping

Default Cubism parameter IDs:

- `mouthOpen` -> `ParamMouthOpenY`
- `angleX` -> `ParamAngleX`
- `angleY` -> `ParamAngleY`
- `breath` -> `ParamBreath`

`mouthOpen` comes from speech/lip-sync pose input and is clamped to `0..1`. Cursor input maps to head angle: `cursorX` becomes `ParamAngleX`, and `cursorY` becomes `ParamAngleY`. Breathing is generated locally from time and slows down while sleeping.

## PSD and Cubism Preparation

Prepare the source PSD with clean separated layers before importing into Live2D Cubism:

- head, torso, hair front/back, brows, eyes, irises, mouth parts, cheeks, and accessories should be separate layers
- draw hidden edges under moving parts so rotation and mouth movement do not reveal gaps
- name layers consistently before rigging; avoid duplicate unnamed groups
- rig mouth open/close to `ParamMouthOpenY`
- rig head turn to `ParamAngleX` and `ParamAngleY`
- rig idle breathing to `ParamBreath`
- create motions and expressions for the avatar state map above

## Runtime Behavior

`Live2DAvatarRenderer.tsx` is a placeholder boundary for an injected webview runtime at `window.__CODEX_LIVE2D_RUNTIME__`. If the model3 path is missing, the injected runtime is missing, or loading fails, the renderer returns the SVG fallback without crashing.

The injected runtime contract is intentionally small: load a model into a canvas, accept parameter values, start named motions, set named expressions, receive avatar triggers, and destroy itself on unmount.
