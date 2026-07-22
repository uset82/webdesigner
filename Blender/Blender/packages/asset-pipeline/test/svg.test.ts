import assert from "node:assert/strict";
import { test } from "vitest";
import { createManifestEntry, optimizeSvg, sanitizeSvg, validateSvgLayers } from "../src/index.js";

const layeredSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <g id="avatar/root">
    <g id="avatar/head"><path d="M1 1h8v8H1z"/></g>
    <g id="avatar/eyes/left"><path d="M3 4h1"/></g>
    <g id="avatar/mouth/open"><path d="M4 7h2"/></g>
  </g>
</svg>`;

test("optimizes SVG while keeping viewBox", () => {
  const optimized = optimizeSvg(layeredSvg);
  assert.match(optimized, /viewBox=/);
  assert.match(optimized, /svg/);
});

test("sanitizes executable and external SVG content", () => {
  const sanitized = sanitizeSvg(
    `<!DOCTYPE svg [<!ENTITY leak SYSTEM "file:///secret">]>
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">
      <script/><svg:script>alert(1)</svg:script>
      <style>@import url(//evil.example/a.css); path { fill: url(file:///secret); }</style>
      <image href="https://evil.example/a.png"/><foreignObject><div>bad</div></foreignObject>
      <use href="#safe"/><path fill="url(#paint)" filter="url(blob:bad)" style="background:url(data:text/html,bad)"/>
      <a href="javascript:alert(1)"><path d="M0 0h1"/></a>
    </svg>`
  );
  assert.doesNotMatch(sanitized, /script|foreignObject|onload|@import|evil\.example|file:|blob:|data:|javascript:/i);
  assert.match(sanitized, /href="#safe"/);
  assert.match(sanitized, /fill="url\(#paint\)"/);
});

test("reports layer warnings for unstructured traces", () => {
  const result = validateSvgLayers(`<svg><path d="M0 0h1v1z"/></svg>`);
  assert.equal(result.groupCount, 0);
  assert.equal(result.pathCount, 1);
  assert.ok(result.missingLayers.includes("avatar/root"));
  assert.ok(result.warnings.length > 0);
});

test("accepts named reference layers", () => {
  const result = validateSvgLayers(layeredSvg);
  assert.equal(result.missingLayers.length, 0);
  assert.equal(result.groupCount, 4);
  assert.equal(result.unnamedGroups, 0);
});

test("accepts a complete humanoid layer profile", () => {
  const layers = [
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
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${layers
    .map((layer, index) => `<g id="${layer}"><path d="M${index} ${index}h20v20h-20z"/></g>`)
    .join("")}</svg>`;

  const result = validateSvgLayers(svg, { profile: "humanoid" });

  assert.equal(result.valid, true);
  assert.equal(result.requiredLayers.length, layers.length);
  assert.equal(result.missingLayers.length, 0);
});

test("reports missing humanoid moving parts", () => {
  const result = validateSvgLayers(layeredSvg, { profile: "humanoid" });

  assert.equal(result.profile, "humanoid");
  assert.ok(result.missingLayers.includes("avatar/body"));
  assert.ok(result.missingLayers.includes("avatar/eyes/right"));
  assert.match(result.warnings.join("\n"), /Missing humanoid/);
});

test("accepts a complete mascot layer profile including data-layer attributes", () => {
  const layers = [
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
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${layers
    .map((layer, index) =>
      index % 2 === 0
        ? `<g id="${layer}"><path d="M${index} ${index}h20v20h-20z"/></g>`
        : `<g data-layer="${layer}"><path d="M${index} ${index}h20v20h-20z"/></g>`
    )
    .join("")}</svg>`;

  const result = validateSvgLayers(svg, { profile: "mascot" });

  assert.equal(result.valid, true);
  assert.equal(result.profile, "mascot");
  assert.equal(result.missingLayers.length, 0);
});

test("reports missing mascot animation layers", () => {
  const result = validateSvgLayers(layeredSvg, { profile: "mascot" });

  assert.equal(result.profile, "mascot");
  assert.ok(result.missingLayers.includes("avatar/skirt"));
  assert.ok(result.missingLayers.includes("avatar/hat"));
  assert.match(result.warnings.join("\n"), /Missing mascot/);
});

test("warns on unnamed groups and tiny path noise", () => {
  const noisyPaths = Array.from({ length: 4 }, (_, index) => `<path d="M${index} ${index}"/>`).join("");
  const result = validateSvgLayers(`<svg><g>${noisyPaths}</g></svg>`, {
    maxTinyPaths: 2
  });

  assert.equal(result.unnamedGroups, 1);
  assert.equal(result.tinyPathCount, 4);
  assert.match(result.warnings.join("\n"), /unnamed/);
  assert.match(result.warnings.join("\n"), /tiny paths/);
});

test("warns on huge SVGs and excessive path counts", () => {
  const manyPaths = Array.from({ length: 3 }, (_, index) => `<path d="M${index} ${index}h20v20h-20z"/>`).join("");
  const result = validateSvgLayers(`<svg><g id="avatar/root">${manyPaths}</g></svg>`, {
    maxBytes: 20,
    maxPaths: 2
  });

  assert.match(result.warnings.join("\n"), /KB/);
  assert.match(result.warnings.join("\n"), /3 paths/);
});

test("creates a local manifest entry", () => {
  const manifest = createManifestEntry({
    inputPath: "workspace/input/avatar.png",
    workspaceRoot: "workspace",
    rawSvgPath: "workspace/.codex-avatar/exports/svg/avatar.raw-trace.svg",
    optimizedSvgPath: "workspace/.codex-avatar/exports/svg/avatar.optimized.svg",
    warnings: ["trace guidance"]
  });

  assert.equal(manifest.source.type, "image-trace");
  assert.equal(manifest.outputs.optimizedSvg, ".codex-avatar/exports/svg/avatar.optimized.svg");
  assert.equal(manifest.warnings[0], "trace guidance");
});
