import { Buffer } from "node:buffer";
import { XMLParser } from "fast-xml-parser";
import type { SvgLayerProfile, SvgValidationOptions, SvgValidationResult } from "./types.js";

export const svgLayerProfiles: Record<SvgLayerProfile, readonly string[]> = {
  reference: ["avatar/root", "avatar/head", "avatar/eyes/left", "avatar/mouth/open"],
  humanoid: [
    "avatar/root",
    "avatar/body",
    "avatar/head",
    "avatar/face",
    "avatar/eyes/left",
    "avatar/eyes/right",
    "avatar/pupils/left",
    "avatar/pupils/right",
    "avatar/eyebrows/left",
    "avatar/eyebrows/right",
    "avatar/mouth/closed",
    "avatar/mouth/open",
    "avatar/hair/back",
    "avatar/hair/front",
    "avatar/arm/left/upper",
    "avatar/arm/left/lower",
    "avatar/arm/left/hand",
    "avatar/arm/right/upper",
    "avatar/arm/right/lower",
    "avatar/arm/right/hand",
    "avatar/accessories",
    "avatar/effects"
  ],
  orb: [
    "avatar/root",
    "avatar/core",
    "avatar/face",
    "avatar/eyes/left",
    "avatar/eyes/right",
    "avatar/mouth/closed",
    "avatar/mouth/open",
    "avatar/aura",
    "avatar/particles",
    "avatar/antenna",
    "avatar/accessories",
    "avatar/shadow"
  ],
  /** Front-facing chibi/mascot layers used by LayeredMascotRenderer and authored 2D Cholita SVGs. */
  mascot: [
    "avatar/root",
    "avatar/shadow",
    "avatar/body",
    "avatar/feet",
    "avatar/skirt",
    "avatar/cape",
    "avatar/hands",
    "avatar/scarf",
    "avatar/medallion",
    "avatar/head",
    "avatar/hair/back",
    "avatar/face",
    "avatar/hair/front",
    "avatar/eyebrows",
    "avatar/eyes/left",
    "avatar/eyes/right",
    "avatar/eyelids",
    "avatar/cheeks",
    "avatar/mouth",
    "avatar/hat",
    "avatar/reactions"
  ]
};

type SvgStats = {
  layerIds: Set<string>;
  pathCount: number;
  groupCount: number;
  unnamedGroups: number;
  tinyPathCount: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: false,
  trimValues: false
});

export function validateSvgLayers(svg: string, options: SvgValidationOptions = {}): SvgValidationResult {
  const warnings: string[] = [];
  const profile = options.profile ?? "reference";
  const requiredLayers = [...svgLayerProfiles[profile]];
  const byteLength = Buffer.byteLength(svg, "utf8");
  const maxBytes = options.maxBytes ?? 100_000;
  const maxPaths = options.maxPaths ?? 750;
  const maxTinyPaths = options.maxTinyPaths ?? 250;
  const stats = collectSvgStats(svg, options.tinyPathDataLength ?? 18);
  const missingLayers = requiredLayers.filter((layer) => !stats.layerIds.has(layer));

  if (byteLength > maxBytes) {
    warnings.push(`SVG is ${(byteLength / 1024).toFixed(1)} KB; consider manual cleanup for IDE use.`);
  }

  if (stats.pathCount > maxPaths) {
    warnings.push(`SVG contains ${stats.pathCount} paths; this may be too heavy for animation or repeated rendering.`);
  }

  if (stats.tinyPathCount > maxTinyPaths) {
    warnings.push(`SVG contains ${stats.tinyPathCount} tiny paths; auto-tracing may have produced path noise.`);
  }

  if (stats.groupCount === 0) {
    warnings.push("SVG has no groups. Animated avatars need named layers for moving parts.");
  }

  if (stats.unnamedGroups > 0) {
    warnings.push(`SVG contains ${stats.unnamedGroups} unnamed group(s). Name groups with avatar/... layer IDs.`);
  }

  if (missingLayers.length > 0) {
    warnings.push(`Missing ${profile} animation-ready layers: ${missingLayers.join(", ")}.`);
  }

  return {
    valid: warnings.length === 0,
    profile,
    warnings,
    requiredLayers,
    missingLayers,
    unnamedGroups: stats.unnamedGroups,
    tinyPathCount: stats.tinyPathCount,
    pathCount: stats.pathCount,
    groupCount: stats.groupCount,
    byteLength
  };
}

function collectSvgStats(svg: string, tinyPathDataLength: number): SvgStats {
  const stats: SvgStats = {
    layerIds: new Set<string>(),
    pathCount: 0,
    groupCount: 0,
    unnamedGroups: 0,
    tinyPathCount: 0
  };

  try {
    walkSvgNode(parser.parse(svg), stats, tinyPathDataLength);
  } catch (error) {
    throw new Error(`Invalid SVG XML: ${error instanceof Error ? error.message : String(error)}`);
  }

  return stats;
}

function walkSvgNode(node: unknown, stats: SvgStats, tinyPathDataLength: number): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walkSvgNode(child, stats, tinyPathDataLength);
    }
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "g" && isSvgElementOrElementList(value)) {
      for (const group of toElementList(value)) {
        stats.groupCount += 1;
        const id = readAttribute(group, "id") ?? readAttribute(group, "data-layer");
        if (id) {
          stats.layerIds.add(id);
        } else {
          stats.unnamedGroups += 1;
        }
        walkSvgNode(group, stats, tinyPathDataLength);
      }
      continue;
    }

    if (key === "path" && isSvgElementOrElementList(value)) {
      for (const pathElement of toElementList(value)) {
        stats.pathCount += 1;
        const data = readAttribute(pathElement, "d");
        if (data && data.length <= tinyPathDataLength) {
          stats.tinyPathCount += 1;
        }
        walkSvgNode(pathElement, stats, tinyPathDataLength);
      }
      continue;
    }

    walkSvgNode(value, stats, tinyPathDataLength);
  }
}

function isSvgElementOrElementList(value: unknown): value is Record<string, unknown> | Array<Record<string, unknown>> {
  return isRecord(value) || (Array.isArray(value) && value.every(isRecord));
}

function toElementList(
  value: Record<string, unknown> | Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value : [value];
}

function readAttribute(node: Record<string, unknown>, name: string): string | undefined {
  const value = node[`@_${name}`];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
