# Third-Party Notices

> Regenerated from the installed workspace manifests — 2026-07-14

Codex Avatar Studio is currently marked `UNLICENSED`. Third-party components retain their own copyrights and licenses. This inventory records direct dependencies; it does not relicense them.

The authoritative engineering review, optional-runtime restrictions, asset policy, and audited upstream SHAs are in [`docs/LICENSING.md`](docs/LICENSING.md).

## Current direct dependencies

Exact versions were read from `pnpm list -r --depth 0` on 2026-07-14.

| Component | Version | License | Upstream |
| --- | ---: | --- | --- |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | <https://github.com/biomejs/biome> |
| `@vitejs/plugin-react` | 5.2.0 | MIT | <https://github.com/vitejs/vite-plugin-react> |
| `@vscode/vsce` | 3.9.2 | MIT | <https://github.com/microsoft/vscode-vsce> |
| `esbuild` | 0.28.1 | MIT | <https://github.com/evanw/esbuild> |
| `fast-xml-parser` | 5.9.3 | MIT | <https://github.com/NaturalIntelligence/fast-xml-parser> |
| `imagetracerjs` | 1.2.6 | Unlicense | <https://github.com/jankovicsandras/imagetracerjs> |
| `jimp` | 0.14.0 | MIT | <https://github.com/oliver-moran/jimp> |
| `pixi.js` | 8.14.0 | MIT | <https://github.com/pixijs/pixi.js> |
| `react` / `react-dom` | 19.2.7 | MIT | <https://github.com/facebook/react> |
| `svgo` | 4.0.1 | MIT | <https://github.com/svg/svgo> |
| `three` | 0.185.1 | MIT | <https://github.com/mrdoob/three.js> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `vite` | 7.3.6 | MIT | <https://github.com/vitejs/vite> |
| `vitest` | 4.1.10 | MIT | <https://github.com/vitest-dev/vitest> |
| `zod` | 4.4.3 | MIT | <https://github.com/colinhacks/zod> |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/vscode` | lockfile versions | MIT | <https://github.com/DefinitelyTyped/DefinitelyTyped> |

The image-to-SVG path uses `imagetracerjs@1.2.6` (Unlicense) and `jimp@0.14.0` (MIT). The GPL-2.0 Potrace dependency is absent from the workspace manifests and lockfile. `scripts/validate-vsix.mjs` rejects a packaged extension bundle containing the removed dependency name.

## Project-local Blender skills

These source-pinned development skills live under `.agents/skills` and are not included in the distributable VSIX:

| Skills | Source pin | License and notice |
| --- | --- | --- |
| `blender-modeling`, `blender-materials`, `blender-animation`, `blender-export`, `animation-quality-gate` | [`roble3/cc-blender-skill@11016c9a5847897491dde935c346571bd7548e3d`](https://github.com/roble3/cc-blender-skill/tree/11016c9a5847897491dde935c346571bd7548e3d) | MIT; Copyright (c) 2026 RobLe3. Full terms: [upstream LICENSE](https://github.com/roble3/cc-blender-skill/blob/11016c9a5847897491dde935c346571bd7548e3d/LICENSE). |
| `rigging-animation` | [`omer-metin/skills-for-antigravity@e8dcf4e8737921a10088bd5c9eb65e81f74c051f`](https://github.com/omer-metin/skills-for-antigravity/tree/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/rigging-animation) | Apache-2.0. Full terms: [upstream LICENSE](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/LICENSE). |
| `blender-motion-state-inspection` | [`affaan-m/everything-claude-code@ed387446052dfbc6b52de149406b70efa65edc59`](https://github.com/affaan-m/everything-claude-code/tree/ed387446052dfbc6b52de149406b70efa65edc59/skills/blender-motion-state-inspection) | MIT; Copyright (c) 2026 Affaan Mustafa. Full terms: [upstream LICENSE](https://github.com/affaan-m/everything-claude-code/blob/ed387446052dfbc6b52de149406b70efa65edc59/LICENSE). |

Blender MCP is optional developer tooling, not a VSIX dependency. The project configuration pins `blender-mcp==1.6.4`; its Blender add-on is pinned to commit `6641189231caf3752302ae20591bc87fda85fc4e` and raw-download SHA-256 `BBA60831F5F89A74DEDA0294B131668A086CF46EB35A6A01ABBD0D21D9E92630` (the CRLF-normalized checkout hash is `3A517C6BA6EC3168C021A1A5D5F5F3F993EB64B1D2DBFE8927E28464EFE8AC36`). The add-on remains governed by its [upstream terms](https://github.com/ahujasid/blender-mcp/blob/6641189231caf3752302ae20591bc87fda85fc4e/TERMS_AND_CONDITIONS.md) and is installed into the user's Blender profile only by the explicit setup command.

## Deferred or not installed

These packages are not present in the current lockfile and must stay out of the base VSIX until a later optional phase re-approves them:

| Component | Reviewed version | License | Notes |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | Deferred optional runtime; not installed |
| `sharp` | 0.35.3 | Apache-2.0 | Optional local preprocessing only; native binaries need packaging review |
| `motion` | 12.42.2 | MIT | Optional Webview transitions only |
| `@pixiv/three-vrm` | 3.5.5 | MIT | Deferred post-MVP 3D adapter only |

## Special restrictions

- Live2D Cubism is governed by separate Live2D SDK and publication agreements. No proprietary SDK binary, Core file, sample model, texture, or motion may be committed or distributed without explicit permission.
- Blender is an optional user-installed external program. Blender binaries and sample assets are not part of this project.
- Inochi2D code is reviewed under BSD-2-Clause, but Inochi models and artwork require independent licenses.
- Repository code licenses never imply permission to copy demo characters, voices, models, artwork, screenshots, or textures.

## Packaging requirement

Before a release candidate is distributed, regenerate this inventory from the installed manifests (`pnpm validate:notices`), include all license texts and copyright notices required by the packaged dependencies, and validate the actual VSIX contents. A dependency listed here but absent from the VSIX does not need to be represented as bundled code; a dependency present in the VSIX must never be omitted from the final notices.
