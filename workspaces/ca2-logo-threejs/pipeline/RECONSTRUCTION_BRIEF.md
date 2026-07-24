# Reconstruction brief — CA² monogram (img2threejs workflow)

This is the **detailed prompt** used to drive the solid rebuild.  
Reference: `ref/logo-reference.png` (and `public/ref/logo-reference.png`).

## Subject

**Brand monogram relief** for **Carlos Alfredo Carpio Meza** — gold embossed mark on deep navy field, with optional lockup (small mark + wordmark).

## Available references

| View | Status | Path / notes |
|------|--------|----------------|
| Front / ¾ product render | **Have** | `ref/logo-reference.png` — hero monogram + lockup on navy |
| Back | Missing | Infer by mirroring; no reverse engravings expected |
| Left / right / top | Missing | Shallow relief (~extrude depth); thickness inferred as ~8–12% of monogram height |
| Close-ups | Missing | Request: serif feet, Taurus, M joins, C terminals if refining further |

**Single-image honesty:** hidden faces and exact stroke weights are approximated from the front render. Prefer more views for a third pass.

---

## 1. Overall composition

- **Primary domain:** hard-surface / embossed metal letterforms (object, not character).
- **Layout:** monogram is the hero (upper 60–65% of artboard). Horizontal rule + small mark + full name lockup sit below.
- **Aspect:** monogram bounding box roughly square-to-slightly-wide; lockup is wide horizontal.
- **Background:** flat deep navy (`#050d1a`–`#071028`), not part of the metal body.

## 2. Identity features (must preserve)

1. **Open crescent C** wrapping the **left** of the A (not a full closed C).
2. **Tall serif letter A** with pointed apex and flaring base feet.
3. **Serif M nested** in the lower half of the A (inside the A’s lower counter).
4. **Taurus glyph** (circle + horns) in the **upper** A counter.
5. **Superscript numeral 2** at upper-right of the monogram (near C’s upper tip).
6. **Polished / embossed gold** metal on navy — warm yellow gold, not brass-green or chrome.

## 3. Proportions (from front reference)

| Feature | Proportion notes |
|---------|------------------|
| A height | Dominant vertical; apex is highest monogram point |
| C outer radius | ~A height; C stroke thickness ~12–16% of A width |
| C opening | Opens toward +X (into the A); upper tip near `2`, lower tip near A left foot |
| M height | ~30–35% of A height; sits in lower counter |
| Taurus | Small; diameter ~12–15% of A width; centered in upper void |
| Numeral 2 | ~18–22% of A height; raised, top-right |
| Relief depth | Shallow emboss: ~0.10–0.16 world units vs monogram height ~2.2 |

## 4. Geometry strategy (code-only)

| Part | Primitive strategy |
|------|--------------------|
| Crescent C | Closed stroke ribbon: outer arc + reverse inner arc → `ExtrudeGeometry` + bevel |
| Letter A | Outer serif A silhouette; **holes** for upper (Taurus) and lower (M) counters |
| Letter M | Separate extrude, parented in monogram, slightly proud of A face |
| Taurus | Torus body + two horn curves + short stem |
| Numeral 2 | Extruded bold “2” silhouette |
| Wordmark | Extruded caps (`TextGeometry`) or refine later with traced outlines |
| Field | Navy disc / plane (stage only) |

No imported meshes. Deterministic seeds if noise is used.

## 5. Materials

| Material | Spec |
|----------|------|
| **Polished gold** | `MeshPhysicalMaterial`, base `#D4AF37`, highlight `#F0D78C`, cavity `#8A6A18` |
| Metalness | 0.92–0.98 |
| Roughness | 0.22–0.32 face; slightly higher in cavities |
| Clearcoat | 0.45–0.65, clearcoatRoughness ~0.2 |
| Env intensity | ~1.4–1.7 (studio IBL) |
| Navy field | Matte, roughness ~0.9, slight emissive navy so it doesn’t crush to black |

**Avoid:** flat yellow unlit; pure chrome; plastic gold (low metalness).

## 6. Lighting / look-dev

- Warm key upper-right, cool fill left, gold rim from behind.
- ACES filmic, exposure ~1.15–1.25.
- Contact shadow under monogram.
- Slow studio rock so bevels catch light (same as M9 demo).

## 7. Acceptance criteria (pass gates)

A review is **continue** only if:

- [ ] Silhouette reads **CA²** at a glance (C + A + 2).
- [ ] Nested **M** and **Taurus** remain readable at hero camera.
- [ ] Gold reads as metal under orbit (not flat paint).
- [ ] No floating parts; C nestles around A.
- [ ] Wordmark optional for hero-only; lockup may be pass 2.

## 8. Iteration plan

| Pass | Focus |
|------|--------|
| **v0** | Emboss plane (rejected as “too basic”) |
| **v1** | Solid extrudes — first strong start (current baseline) |
| **v2** | Proportion + stroke fidelity vs reference (this pass) |
| **v3** | Optional: traced `geo.json` from PNG mask; PBR crop projection |

### Known v1 misses to fix in v2

1. C stroke weight / taper closer to reference (thicker crescent, sharper tips).
2. A serifs: wider base feet, sharper apex, cleaner counters for M and Taurus.
3. M: more classical nested serif M proportions inside A.
4. Taurus: smaller, cleaner circle+horns, better placement in upper void.
5. Numeral 2: better glyph and placement relative to C tip.
6. Depth hierarchy: M/Taurus slightly proud of A; C coplanar with A body.

---

## Agent instruction (copy-paste)

> Rebuild the CA² gold monogram as a **code-only procedural Three.js model** from `ref/logo-reference.png`.  
> Subject: embossed gold metal monogram on navy — open crescent C wrapping left of a tall serif A; nested serif M in lower A; Taurus glyph in upper A void; superscript 2 top-right; optional wordmark “CARLOS ALFREDO CARPIO MEZA”.  
> Use extruded shapes with bevels and MeshPhysicalMaterial gold (not a flat textured plane).  
> Preserve identity features above. Report what is still approximate due to single front reference.
