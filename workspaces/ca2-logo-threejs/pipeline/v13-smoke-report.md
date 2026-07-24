# img2threejs v1.3 smoke test — CA2 Monogram

**Viewer:** http://localhost:5178/

## Reference
- `ref/logo-reference.png` (1448×1086, 1.42 MB) — gold embossed monogram + wordmark lockup

## Pipeline results

| Stage | Result |
|-------|--------|
| `probe_image` | **pass** |
| `check_reference_admission` | **rejected** (FG coverage ~0.998) — expected for full-bleed navy brand sheet; silhouette not isolable by mask |
| `extract_pbr_evidence` (gold) | **pass**, confidence **0.86** |
| Palette | navy `#010817`, gold `#DCAD5E`, mid `#7D5423` |
| `validate` (normal) | **PASS** (ok: true), 20 components / 3 materials |
| `validate --strict-quality` | near-pass; remaining lighting-pass prose fields |
| `generate_threejs_factory` | wrote `src/createCA2MonogramLogoModel.generated.ts` |
| Production build | **ok** (Vite) |

## Runtime model
Primary deliverable remains the **reference-emboss** factory (`createCA2MonogramLogoModel.ts`), tagged `img2threejs-v1.3-reference-emboss`. This is the correct path for a 2D gold logo: preserves letterform fidelity from the PNG rather than approximating serifs with generic extrudes.

## How to view
```
cd workspaces/ca2-logo-threejs
npm run dev
# open http://localhost:5178/
```
Drag to orbit; use zoom controls.
