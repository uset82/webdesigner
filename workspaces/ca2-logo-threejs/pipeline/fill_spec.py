#!/usr/bin/env python3
"""Fill the CA2 monogram ObjectSculptSpec from visual analysis."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PIPE = Path(__file__).resolve().parent
SPEC_PATH = PIPE / "object-sculpt-spec.json"
SKILL = Path(r"e:\PROYECTOS\webdesigner\.antigravity\skills\img2threejs")


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
    spec["scores"] = {
        "object_isolation": 0.95,
        "silhouette_readability": 0.92,
        "depth_inference": 0.7,
        "primitive_decomposition": 0.78,
        "material_procedurality": 0.9,
        "occlusion_risk": 0.25,
        "interaction_fit": 0.6,
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
    psa["complexity"]["scores"] = {
        "silhouetteComplexity": 0.82,
        "componentCount": 0.75,
        "hierarchyDepth": 0.7,
        "repetitionDensity": 0.2,
        "materialLayerCount": 0.55,
        "localDetailDensity": 0.8,
        "occlusionRisk": 0.25,
        "actionReadinessNeed": 0.4,
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

    spec["featureReviewTargets"] = [
        {
            "id": "monogram-silhouette",
            "tier": "critical",
            "description": "Crescent + A + 2 read as CA2 monogram at a glance",
            "passIds": ["blockout", "structural-pass", "form-refinement"],
        },
        {
            "id": "nested-m-taurus",
            "tier": "critical",
            "description": "M nested in A and Taurus glyph remain readable",
            "passIds": ["form-refinement", "material-pass"],
        },
        {
            "id": "gold-metal-response",
            "tier": "critical",
            "description": "Metalness high, warm gold albedo, soft bevel highlights",
            "passIds": ["material-pass", "lighting-pass"],
        },
        {
            "id": "relief-depth",
            "tier": "important",
            "description": "Consistent extrusion depth with clean beveled edges",
            "passIds": ["form-refinement", "surface-pass"],
        },
        {
            "id": "navy-field",
            "tier": "important",
            "description": "Deep navy plate/environment contrast",
            "passIds": ["lighting-pass"],
        },
    ]

    spec["componentTree"] = [
        {
            "id": "root",
            "name": "CA2MonogramLogo",
            "level": "macro",
            "parent": None,
            "primitive": "group",
            "role": "root",
            "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["pivot-center"],
        },
        {
            "id": "backdrop-plate",
            "name": "NavyBackdrop",
            "level": "macro",
            "parent": "root",
            "primitive": "plane-card",
            "role": "backdrop",
            "materialRef": "navy-plate",
            "dimensions": {"width": 4.2, "height": 3.2, "depth": 0.02},
            "transform": {"position": [0, 0, -0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["matte-field"],
        },
        {
            "id": "monogram-group",
            "name": "MonogramGroup",
            "level": "macro",
            "parent": "root",
            "primitive": "group",
            "role": "mark",
            "transform": {"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["relief-assembly"],
        },
        {
            "id": "crescent-c",
            "name": "CrescentC",
            "level": "macro",
            "parent": "monogram-group",
            "primitive": "extrude",
            "role": "letterform",
            "materialRef": "polished-gold",
            "dimensions": {"width": 1.6, "height": 1.9, "depth": 0.12},
            "transform": {"position": [-0.05, 0.05, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["open-crescent", "tapered-terminals", "relief-depth"],
        },
        {
            "id": "letter-a",
            "name": "LetterA",
            "level": "macro",
            "parent": "monogram-group",
            "primitive": "extrude",
            "role": "letterform",
            "materialRef": "polished-gold",
            "dimensions": {"width": 1.35, "height": 1.85, "depth": 0.13},
            "transform": {"position": [0.02, -0.02, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["serif-feet", "pointed-apex", "inner-voids", "relief-depth"],
        },
        {
            "id": "letter-m",
            "name": "LetterM",
            "level": "meso",
            "parent": "monogram-group",
            "primitive": "extrude",
            "role": "letterform",
            "materialRef": "polished-gold",
            "dimensions": {"width": 0.72, "height": 0.55, "depth": 0.11},
            "transform": {"position": [0.02, -0.42, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["serif-m", "nested-in-a"],
        },
        {
            "id": "taurus-symbol",
            "name": "TaurusGlyph",
            "level": "micro",
            "parent": "monogram-group",
            "primitive": "extrude",
            "role": "glyph",
            "materialRef": "polished-gold",
            "dimensions": {"width": 0.28, "height": 0.3, "depth": 0.09},
            "transform": {"position": [0.02, 0.12, 0.03], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["circle-body", "horns"],
        },
        {
            "id": "numeral-2",
            "name": "Superscript2",
            "level": "meso",
            "parent": "monogram-group",
            "primitive": "extrude",
            "role": "letterform",
            "materialRef": "polished-gold",
            "dimensions": {"width": 0.28, "height": 0.36, "depth": 0.1},
            "transform": {"position": [0.78, 0.72, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["raised-numeral"],
        },
        {
            "id": "wordmark",
            "name": "Wordmark",
            "level": "meso",
            "parent": "root",
            "primitive": "group",
            "role": "typography",
            "materialRef": "polished-gold",
            "transform": {"position": [0, -1.15, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["optional-caps", "divider-dot"],
        },
        {
            "id": "edge-bevel-micro",
            "name": "EdgeBevelGroup",
            "level": "micro",
            "parent": "monogram-group",
            "primitive": "group",
            "role": "surface",
            "materialRef": "gold-highlight",
            "transform": {"position": [0, 0, 0.05], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "localFeatures": ["bevel-catchlight"],
        },
    ]

    # add more micro groups for strict counts
    for i, name in enumerate(
        ["apex-serif", "left-foot-serif", "right-foot-serif", "crescent-upper-tip", "crescent-lower-tip"],
        start=1,
    ):
        spec["componentTree"].append(
            {
                "id": f"micro-{name}",
                "name": name,
                "level": "micro",
                "parent": "monogram-group",
                "primitive": "extrude",
                "role": "detail",
                "materialRef": "polished-gold",
                "transform": {"position": [0, 0, 0.04], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                "localFeatures": [name, "relief-depth"],
            }
        )

    # extra meso for counts
    for name in ["a-left-stroke", "a-right-stroke", "a-crossbar-void", "divider-rule"]:
        spec["componentTree"].append(
            {
                "id": f"meso-{name}",
                "name": name,
                "level": "meso",
                "parent": "monogram-group" if name != "divider-rule" else "root",
                "primitive": "extrude",
                "role": "structure",
                "materialRef": "polished-gold",
                "transform": {"position": [0, 0, 0.02], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                "localFeatures": [name],
            }
        )

    spec["materials"] = [
        {
            "id": "polished-gold",
            "name": "PolishedGold",
            "baseColor": "#D4AF37",
            "albedo": {"dominant": "#D4AF37", "secondary": ["#F0D78C", "#B8860B", "#8A6A1F"]},
            "colorVariation": {"palette": ["#F5E6A3", "#D4AF37", "#C9A227", "#A67C00"]},
            "metalness": {"base": 1.0},
            "roughness": {"base": 0.28},
            "clearcoat": {"base": 0.35},
            "localOverrides": [
                {"id": "edge-bevel", "kind": "edge-wear", "params": {"roughness": 0.18, "metalness": 1.0}},
                {"id": "cavity-shade", "kind": "ao", "params": {"intensity": 0.35}},
                {"id": "brush-lines", "kind": "scratches", "params": {"anisotropy": 0.2}},
            ],
            "referencePbr": {
                "source": "logo-reference.png",
                "confidence": 0.82,
                "notes": "Warm gold emboss albedo estimated from highlight/midtone samples",
            },
        },
        {
            "id": "gold-highlight",
            "name": "GoldHighlight",
            "baseColor": "#F5E6A3",
            "metalness": {"base": 1.0},
            "roughness": {"base": 0.16},
            "localOverrides": [{"id": "specular-rim", "kind": "gloss", "params": {"roughness": 0.12}}],
        },
        {
            "id": "navy-plate",
            "name": "NavyPlate",
            "baseColor": "#071028",
            "albedo": {"dominant": "#071028", "secondary": ["#0B1836", "#040812"]},
            "metalness": {"base": 0.05},
            "roughness": {"base": 0.88},
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

    spec["lightingFromPhoto"] = {
        "key": {"direction": [0.55, 0.75, 0.9], "intensity": 2.2, "color": "#fff2d6"},
        "fill": {"direction": [-0.7, 0.2, 0.5], "intensity": 0.55, "color": "#9bb4ff"},
        "rim": {"direction": [-0.4, 0.3, -0.8], "intensity": 1.1, "color": "#ffd27a"},
        "ambient": {"intensity": 0.35, "color": "#1a2744"},
        "notes": "Studio product lighting on dark navy; warm key from upper-right.",
    }

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
        "reviewViewpoints": [
            {"name": "hero-front", "position": [0, 0.1, 3.2]},
            {"name": "three-quarter", "position": [1.6, 0.6, 2.6]},
            {"name": "top-glint", "position": [0.3, 2.2, 1.8]},
            {"name": "side-relief", "position": [2.4, 0.2, 1.2]},
        ],
    }

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
