#!/usr/bin/env python3
"""Fill the CA2 monogram ObjectSculptSpec from visual analysis."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PIPE = Path(__file__).resolve().parent
SPEC_PATH = PIPE / "object-sculpt-spec.json"
SKILL = Path(r"e:\PROYECTOS\webdesigner\skills\img2threejs")


def main() -> int:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))

    details = [
        {
            "id": "crescent-c-stroke",
            "kind": "linework",
            "description": "Thick open crescent/C stroke wrapping left of monogram with tapered terminals",
            "region": {"x": 0.18, "y": 0.12, "width": 0.42, "height": 0.72, "units": "normalized"},
            "scale": "macro",
            "affects": "silhouette",
            "mapsTo": {"type": "component", "ref": "crescent-c"},
            "confidence": 0.95,
        },
        {
            "id": "letter-a-silhouette",
            "kind": "contour",
            "description": "Tall serif letter A with pointed apex and wide base feet",
            "region": {"x": 0.28, "y": 0.14, "width": 0.44, "height": 0.7, "units": "normalized"},
            "scale": "macro",
            "affects": "silhouette",
            "mapsTo": {"type": "component", "ref": "letter-a"},
            "confidence": 0.96,
        },
        {
            "id": "letter-m-nested",
            "kind": "contour",
            "description": "Serif M nested inside lower half of A",
            "region": {"x": 0.34, "y": 0.48, "width": 0.32, "height": 0.32, "units": "normalized"},
            "scale": "meso",
            "affects": "identity",
            "mapsTo": {"type": "component", "ref": "letter-m"},
            "confidence": 0.94,
        },
        {
            "id": "taurus-glyph",
            "kind": "linework",
            "description": "Taurus glyph (circle + horns) centered in upper A interior",
            "region": {"x": 0.42, "y": 0.34, "width": 0.14, "height": 0.16, "units": "normalized"},
            "scale": "micro",
            "affects": "identity",
            "mapsTo": {"type": "component", "ref": "taurus-symbol"},
            "confidence": 0.93,
        },
        {
            "id": "superscript-2",
            "kind": "contour",
            "description": "Small raised numeral 2 upper-right of crescent tip",
            "region": {"x": 0.62, "y": 0.12, "width": 0.12, "height": 0.14, "units": "normalized"},
            "scale": "meso",
            "affects": "identity",
            "mapsTo": {"type": "component", "ref": "numeral-2"},
            "confidence": 0.95,
        },
        {
            "id": "gold-metal-gloss",
            "kind": "gloss",
            "description": "Brushed gold metal with specular highlights and warm yellow albedo",
            "region": {"x": 0.25, "y": 0.15, "width": 0.5, "height": 0.65, "units": "normalized"},
            "scale": "macro",
            "affects": "material",
            "mapsTo": {"type": "material", "ref": "polished-gold"},
            "confidence": 0.97,
        },
        {
            "id": "edge-bevel-highlight",
            "kind": "bevel",
            "description": "Soft bevels on letter edges catching key light as bright gold rims",
            "region": {"x": 0.3, "y": 0.2, "width": 0.4, "height": 0.55, "units": "normalized"},
            "scale": "micro",
            "affects": "material",
            "mapsTo": {"type": "material.localOverride", "ref": "edge-bevel"},
            "confidence": 0.9,
        },
        {
            "id": "navy-backdrop",
            "kind": "stain",
            "description": "Deep navy flat field behind embossed mark",
            "region": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "units": "normalized"},
            "scale": "macro",
            "affects": "lighting",
            "mapsTo": {"type": "component", "ref": "backdrop-plate"},
            "confidence": 0.99,
        },
        {
            "id": "wordmark-serif",
            "kind": "linework",
            "description": "Optional lower wordmark CARLOS ALFREDO CARPIO MEZA in gold caps",
            "region": {"x": 0.28, "y": 0.82, "width": 0.62, "height": 0.08, "units": "normalized"},
            "scale": "meso",
            "affects": "layout",
            "mapsTo": {"type": "component", "ref": "wordmark"},
            "confidence": 0.85,
        },
        {
            "id": "emboss-depth",
            "kind": "contour",
            "description": "Shallow relief extrusion depth giving cast micro-shadows under strokes",
            "region": {"x": 0.3, "y": 0.2, "width": 0.4, "height": 0.55, "units": "normalized"},
            "scale": "meso",
            "affects": "form",
            "mapsTo": {"type": "component.localFeature", "ref": "relief-depth"},
            "confidence": 0.92,
        },
    ]

    spec["suitability"] = "pass"
    # v1.3 validator: suitability scores are integers 0–3
    spec["scores"] = {
        "object_isolation": 3,
        "silhouette_readability": 3,
        "depth_inference": 2,
        "primitive_decomposition": 2,
        "material_procedurality": 3,
        "occlusion_risk": 1,
        "interaction_fit": 2,
    }

    psa = spec["preSpecAssessment"]
    psa["objectClass"] = {
        "primaryType": "brand-monogram-relief",
        "primaryDomain": "object",
        "formLanguage": ["serif-letterforms", "crescent-arc", "embossed-relief", "heraldic-monogram"],
        "structureKind": ["nested-letters", "open-crescent", "superscript-mark", "optional-wordmark"],
        "motionPotential": ["yaw-orbit", "slow-spin", "hover-float"],
        "materialFamilies": ["brushed-gold-metal", "navy-matte-plate"],
        "notes": "Gold embossed CA2 monogram: crescent C, letter A, nested M, Taurus glyph, superscript 2 on navy field.",
    }
    # v1.3: complexity scores are integers 0–3
    psa["complexity"]["scores"] = {
        "silhouetteComplexity": 3,
        "componentCount": 2,
        "hierarchyDepth": 2,
        "repetitionDensity": 1,
        "materialLayerCount": 2,
        "localDetailDensity": 3,
        "occlusionRisk": 1,
        "actionReadinessNeed": 1,
    }
    psa["complexity"]["estimatedCounts"] = {
        "macroComponents": 4,
        "mesoComponents": 8,
        "microFeatureGroups": 6,
        "materialLayers": 3,
        "repetitionSystems": 1,
    }
    psa["complexity"]["reasoning"] = [
        "Identity is the monogram silhouette plus nested M/Taurus/2.",
        "Material is uniform gold metal with bevel highlights.",
        "Depth is shallow relief (~0.08-0.14 units) not deep sculpture.",
    ]
    psa["detailInventory"] = {
        "scanMethod": "agent-vision+grid-3x3",
        "targetMinDetails": 10,
        "details": details,
    }

    qc = spec.get("qualityContract") or {}
    if not isinstance(qc, dict):
        qc = {}
    qc["minimums"] = {
        "macroComponents": 3,
        "mesoComponents": 6,
        "microFeatureGroups": 5,
        "materialLayers": 3,
        "repetitionSystems": 1,
        "reviewViewpoints": 4,
    }
    qc["mustPreserveIdentityFeatures"] = [
        "crescent-C wrap",
        "serif A apex and base feet",
        "nested M",
        "Taurus glyph",
        "superscript 2",
        "gold metal on navy",
    ]
    qc["acceptedApproximation"] = (
        "Letterforms may be geometric reconstructions of the serif monogram, not font-matched outlines. "
        "Wordmark optional for hero mark."
    )
    qc["failureConditions"] = [
        "Missing superscript 2",
        "Missing nested M",
        "Plastic non-metal gold",
        "Flat zero-depth logo",
    ]
    spec["qualityContract"] = qc

    def _action(role: str = "static") -> dict:
        return {"role": role, "animatable": role != "static", "destructible": False}

    def _comp(
        cid: str,
        name: str,
        *,
        level: str,
        parent: str | None,
        primitive: str,
        role: str,
        material_ref: str | None = None,
        dimensions: dict | None = None,
        transform: dict | None = None,
        local_features: list[str] | None = None,
        topology: str = "surface-relief",
    ) -> dict:
        node = {
            "id": cid,
            "name": name,
            "level": level,
            "parent": parent,
            "primitive": primitive,
            "role": role,
            "topologyClass": topology,
            "topologyRationale": f"{name} is a monogram relief part reconstructed as {primitive}",
            "actionProfile": _action("pivot" if role == "root" else "static"),
            "transform": transform
            or {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": local_features or [],
        }
        if material_ref:
            node["materialRef"] = material_ref
        if dimensions:
            node["dimensions"] = dimensions
        # v1.3 colorMaterialRecipe schema (rgba strings + materialClass enum)
        if material_ref == "polished-gold":
            node["colorMaterialRecipe"] = {
                "dominantAlbedo": "rgba(212, 175, 55, 1)",
                "secondaryAlbedo": "rgba(240, 215, 140, 1)",
                "materialClass": "metal",
                "materialClassConfidence": 0.95,
                "metalness": 0.92,
                "roughness": 0.28,
            }
        elif material_ref == "navy-plate":
            node["colorMaterialRecipe"] = {
                "dominantAlbedo": "rgba(7, 16, 40, 1)",
                "secondaryAlbedo": "rgba(11, 24, 54, 1)",
                "materialClass": "plastic",
                "materialClassConfidence": 0.8,
                "metalness": 0.05,
                "roughness": 0.88,
            }
        elif material_ref == "gold-highlight":
            node["colorMaterialRecipe"] = {
                "dominantAlbedo": "rgba(245, 230, 163, 1)",
                "secondaryAlbedo": "rgba(212, 175, 55, 1)",
                "materialClass": "metal",
                "materialClassConfidence": 0.9,
                "metalness": 1.0,
                "roughness": 0.16,
            }
        elif role == "root" or cid == "monogram-group":
            node["colorMaterialRecipe"] = {
                "dominantAlbedo": "rgba(212, 175, 55, 1)",
                "secondaryAlbedo": "rgba(7, 16, 40, 1)",
                "materialClass": "metal",
                "materialClassConfidence": 0.7,
                "metalness": 0.5,
                "roughness": 0.5,
            }
        return node

    spec["featureReviewTargets"] = [
        {
            "id": "monogram-silhouette",
            "name": "Monogram silhouette",
            "tier": "critical",
            "description": "Crescent + A + 2 read as CA2 monogram at a glance",
            "passIds": ["blockout", "structural-pass", "form-refinement"],
        },
        {
            "id": "nested-m-taurus",
            "name": "Nested M and Taurus",
            "tier": "critical",
            "description": "M nested in A and Taurus glyph remain readable",
            "passIds": ["form-refinement", "material-pass"],
        },
        {
            "id": "gold-metal-response",
            "name": "Gold metal response",
            "tier": "critical",
            "description": "Metalness high, warm gold albedo, soft bevel highlights",
            "passIds": ["material-pass", "lighting-pass"],
        },
        {
            "id": "relief-depth",
            "name": "Relief depth",
            "tier": "important",
            "description": "Consistent extrusion depth with clean beveled edges",
            "passIds": ["form-refinement", "surface-pass"],
        },
        {
            "id": "navy-field",
            "name": "Navy field",
            "tier": "important",
            "description": "Deep navy plate/environment contrast",
            "passIds": ["lighting-pass"],
        },
    ]

    # v1.3: only whitelist primitives; use plane-card for grouping shells
    spec["componentTree"] = [
        _comp(
            "root",
            "CA2MonogramLogo",
            level="macro",
            parent=None,
            primitive="box",
            role="root",
            topology="assembled-solid",
            dimensions={"width": 0.01, "height": 0.01, "depth": 0.01},
            local_features=["pivot-center"],
        ),
        _comp(
            "backdrop-plate",
            "NavyBackdrop",
            level="macro",
            parent="root",
            primitive="plane-card",
            role="backdrop",
            material_ref="navy-plate",
            topology="material-only",
            dimensions={"width": 4.2, "height": 3.2, "depth": 0.02},
            transform={"position": [0, 0, -0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["matte-field"],
        ),
        _comp(
            "monogram-group",
            "MonogramGroup",
            level="macro",
            parent="root",
            primitive="box",
            role="mark",
            topology="assembled-solid",
            dimensions={"width": 0.01, "height": 0.01, "depth": 0.01},
            transform={"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["relief-assembly"],
        ),
        _comp(
            "crescent-c",
            "CrescentC",
            level="macro",
            parent="monogram-group",
            primitive="extrude",
            role="letterform",
            material_ref="polished-gold",
            dimensions={"width": 1.6, "height": 1.9, "depth": 0.12},
            transform={"position": [-0.05, 0.05, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["open-crescent", "tapered-terminals", "relief-depth"],
        ),
        _comp(
            "letter-a",
            "LetterA",
            level="macro",
            parent="monogram-group",
            primitive="extrude",
            role="letterform",
            material_ref="polished-gold",
            dimensions={"width": 1.35, "height": 1.85, "depth": 0.13},
            transform={"position": [0.02, -0.02, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["serif-feet", "pointed-apex", "inner-voids", "relief-depth"],
        ),
        _comp(
            "letter-m",
            "LetterM",
            level="meso",
            parent="monogram-group",
            primitive="extrude",
            role="letterform",
            material_ref="polished-gold",
            dimensions={"width": 0.72, "height": 0.55, "depth": 0.11},
            transform={"position": [0.02, -0.42, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["serif-m", "nested-in-a"],
        ),
        _comp(
            "taurus-symbol",
            "TaurusGlyph",
            level="micro",
            parent="monogram-group",
            primitive="extrude",
            role="glyph",
            material_ref="polished-gold",
            dimensions={"width": 0.28, "height": 0.3, "depth": 0.09},
            transform={"position": [0.02, 0.12, 0.03], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["circle-body", "horns"],
        ),
        _comp(
            "numeral-2",
            "Superscript2",
            level="meso",
            parent="monogram-group",
            primitive="extrude",
            role="letterform",
            material_ref="polished-gold",
            dimensions={"width": 0.28, "height": 0.36, "depth": 0.1},
            transform={"position": [0.78, 0.72, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["raised-numeral"],
        ),
        _comp(
            "wordmark",
            "Wordmark",
            level="meso",
            parent="root",
            primitive="plane-card",
            role="typography",
            material_ref="polished-gold",
            dimensions={"width": 3.2, "height": 0.28, "depth": 0.04},
            transform={"position": [0, -1.15, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["optional-caps", "divider-dot"],
        ),
        _comp(
            "edge-bevel-micro",
            "EdgeBevelGroup",
            level="micro",
            parent="monogram-group",
            primitive="plane-card",
            role="surface",
            material_ref="gold-highlight",
            dimensions={"width": 0.2, "height": 0.2, "depth": 0.02},
            transform={"position": [0, 0, 0.05], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            local_features=["bevel-catchlight"],
        ),
    ]

    for name in ["apex-serif", "left-foot-serif", "right-foot-serif", "crescent-upper-tip", "crescent-lower-tip"]:
        spec["componentTree"].append(
            _comp(
                f"micro-{name}",
                name,
                level="micro",
                parent="monogram-group",
                primitive="extrude",
                role="detail",
                material_ref="polished-gold",
                transform={"position": [0, 0, 0.04], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                local_features=[name, "relief-depth"],
            )
        )

    for name in ["a-left-stroke", "a-right-stroke", "a-crossbar-void", "divider-rule", "lockup-bar"]:
        spec["componentTree"].append(
            _comp(
                f"meso-{name}",
                name,
                level="meso",
                parent="monogram-group" if name != "divider-rule" and name != "lockup-bar" else "root",
                primitive="extrude",
                role="structure",
                material_ref="polished-gold",
                transform={"position": [0, 0, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                local_features=[name],
            )
        )

    pbr_dir = PIPE / "pbr"

    def _map(name: str) -> dict:
        return {
            "path": str(pbr_dir / name),
            "url": name,
            "channel": name.split("_")[-1].replace(".png", ""),
            "source": "reference-pixel-extraction",
        }

    gold_maps = {
        "albedo": _map("gold_albedo.png"),
        "roughness": _map("gold_roughness.png"),
        "height": _map("gold_height.png"),
        "normal": _map("gold_normal.png"),
        "ao": _map("gold_ao.png"),
    }

    spec["materials"] = [
        {
            "id": "polished-gold",
            "name": "PolishedGold",
            "baseColor": "#D4AF37",
            "albedo": {"dominant": "#D4AF37", "secondary": ["#F0D78C", "#B8860B", "#8A6A1F"]},
            "colorVariation": {"palette": ["#F5E6A3", "#D4AF37", "#C9A227", "#A67C00"]},
            "metalness": {"base": 0.92},
            "roughness": {"base": 0.28},
            "clearcoat": {"base": 0.35},
            "finishClass": "gem-metal",
            "localOverrides": [
                {"id": "edge-bevel", "kind": "edge-wear", "params": {"roughness": 0.18, "metalness": 1.0}},
                {"id": "cavity-shade", "kind": "ao", "params": {"intensity": 0.35}},
                {"id": "brush-lines", "kind": "scratches", "params": {"anisotropy": 0.2}},
            ],
            "referencePbr": {
                "source": "logo-reference.png",
                "confidence": 0.86,
                "maps": gold_maps,
                "notes": "v1.3 extract_pbr_evidence + analyze_texture path for warm gold emboss",
            },
        },
        {
            "id": "gold-highlight",
            "name": "GoldHighlight",
            "baseColor": "#F5E6A3",
            "metalness": {"base": 1.0},
            "roughness": {"base": 0.16},
            "finishClass": "gem-metal",
            "localOverrides": [{"id": "specular-rim", "kind": "gloss", "params": {"roughness": 0.12}}],
        },
        {
            "id": "navy-plate",
            "name": "NavyPlate",
            "baseColor": "#071028",
            "albedo": {"dominant": "#071028", "secondary": ["#0B1836", "#040812"]},
            "metalness": {"base": 0.05},
            "roughness": {"base": 0.88},
            "finishClass": "plastic",
            "localOverrides": [{"id": "soft-vignette", "kind": "stain", "params": {"darken": 0.15}}],
        },
    ]

    spec["repetitionSystems"] = [
        {
            "id": "serif-stroke-profile",
            "kind": "shared-profile",
            "description": "Shared extrusion depth and bevel profile across letter strokes",
            "appliesTo": ["crescent-c", "letter-a", "letter-m", "numeral-2", "taurus-symbol"],
        }
    ]

    # v1.3: lightingFromPhoto must be an array of light entries
    spec["lightingFromPhoto"] = [
        {"id": "key", "type": "directional", "direction": [0.55, 0.75, 0.9], "intensity": 2.2, "color": "#fff2d6"},
        {"id": "fill", "type": "directional", "direction": [-0.7, 0.2, 0.5], "intensity": 0.55, "color": "#9bb4ff"},
        {"id": "rim", "type": "directional", "direction": [-0.4, 0.3, -0.8], "intensity": 1.1, "color": "#ffd27a"},
        {"id": "ambient", "type": "ambient", "intensity": 0.35, "color": "#1a2744"},
    ]

    for bp in spec.get("buildPasses", []):
        pid = bp.get("id")
        if pid == "blockout":
            bp["componentRefs"] = ["root", "backdrop-plate", "monogram-group", "crescent-c", "letter-a", "numeral-2"]
        elif pid == "structural-pass":
            bp["componentRefs"] = ["letter-m", "taurus-symbol", "wordmark", "meso-a-left-stroke", "meso-a-right-stroke"]
        elif pid == "form-refinement":
            bp["componentRefs"] = ["crescent-c", "letter-a", "letter-m", "numeral-2", "taurus-symbol"]
        elif pid in ("material-pass", "surface-pass"):
            bp["componentRefs"] = ["edge-bevel-micro"]
        elif pid == "lighting-pass":
            bp["componentRefs"] = ["backdrop-plate"]
        elif pid == "interaction-pass":
            bp["componentRefs"] = ["root", "monogram-group"]
        elif pid == "optimization-pass":
            bp["componentRefs"] = ["root"]

    spec["lookDevTargets"] = {
        "primaryCamera": {"position": [0, 0.1, 3.2], "target": [0, 0.05, 0], "fov": 35},
        "exposure": 1.12,
        "toneMapping": "ACESFilmic",
        "contactShadow": {"enabled": True, "opacity": 0.35, "blur": 2.5},
        "reviewViewpoints": [
            {"name": "hero-front", "position": [0, 0.1, 3.2]},
            {"name": "three-quarter", "position": [1.6, 0.6, 2.6]},
            {"name": "top-glint", "position": [0.3, 2.2, 1.8]},
            {"name": "side-relief", "position": [2.4, 0.2, 1.2]},
        ],
    }
    # Ensure qualityContract / lookDev reviewViewpoint count is visible to validator
    if isinstance(spec.get("reviewViewpoints"), list) and len(spec["reviewViewpoints"]) < 4:
        spec["reviewViewpoints"] = list(spec["lookDevTargets"]["reviewViewpoints"])
    elif not spec.get("reviewViewpoints"):
        spec["reviewViewpoints"] = list(spec["lookDevTargets"]["reviewViewpoints"])

    SPEC_PATH.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    print("wrote", SPEC_PATH)

    for mode in ([], ["--strict-quality"]):
        r = subprocess.run(
            [sys.executable, str(SKILL / "forge/stage2_spec/validate_sculpt_spec.py"), str(SPEC_PATH), "--json", *mode],
            capture_output=True,
            text=True,
        )
        label = "strict" if mode else "normal"
        print(f"=== {label} exit={r.returncode} ===")
        print(r.stdout)
        if r.stderr:
            print(r.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
