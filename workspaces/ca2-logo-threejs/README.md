# CA² Monogram → Three.js (img2threejs)

Procedural reconstruction of the **Carlos Alfredo Carpio Meza** gold monogram logo using the WebDesigner `img2threejs` skill path.

## What’s in here

| Path | Purpose |
|------|---------|
| `ref/logo-reference.png` | Source logo |
| `pipeline/` | Probe, assessment, detail inventory, `object-sculpt-spec.json`, forge artifacts |
| `src/createCA2MonogramLogoModel.ts` | **Hand-refined** procedural factory (primary deliverable) |
| `src/createCA2MonogramLogoModel.generated.ts` | Forge skeleton from sculpt spec (blockout) |
| `src/main.ts` | Vite viewer with studio lighting + orbit |

## Run

```bash
cd workspaces/ca2-logo-threejs
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5177`). Drag to orbit.

## Reconstruction notes

- **Primary method (fixed):** reference-faithful **emboss stack** — logo PNG cropped to hero monogram + lockup, navy keyed out, multi-layer gold metal planes (rim / body / face) for depth and specular.
- **Fallback:** pure geometric primitives if the image fails to load.
- **Identity features preserved from art:** crescent C, serif A, nested M, Taurus glyph, superscript 2, gold-on-navy, bottom lockup with name.
- **Pipeline:** forge artifacts remain under `pipeline/`; the runtime factory is the hand-refined TypeScript path expected after img2threejs codegen.
