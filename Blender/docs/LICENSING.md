# Licensing and Provenance Policy

> Re-audited from installed workspace manifests — 2026-07-14

This file records the implementation license gate for Codex Avatar Studio. It is an engineering compliance record, not legal advice.

## Project license status

The repository's `LICENSE` file currently marks the project **UNLICENSED / all rights reserved**. That project-level status does not replace third-party license obligations. Every distributed dependency, copied source fragment, runtime SDK, artwork file, model, texture, voice, font, and generated derivative must have separate provenance and redistribution review.

## Non-negotiable asset policy

- Code licenses and artwork/model licenses are reviewed separately.
- Do not copy the appearance, personality, artwork, models, voices, textures, demo characters, or other proprietary assets of Grok Ani, Rudi, AITuber OnAir, Project AIRI, TalkingHead, Live2D samples, Inochi2D samples, or any other upstream project.
- Upstream demo assets are not approved merely because their containing code repository is open source.
- The built-in SVG and PixiJS spritesheet must be clean-room, original project work with recorded authorship and redistribution permission.
- Imported avatar packages remain local by default and must expose author and license metadata. Remote asset URLs are rejected by default.
- No microphone, cloud, marketplace, or remote asset service is licensed or required by the MVP.

## Current direct dependency audit

Exact installed versions were read from `pnpm list -r --depth 0 --json` and their installed `package.json` license fields on 2026-07-14. `pnpm validate:notices` keeps `THIRD_PARTY_NOTICES.md` aligned with these manifests.

| Dependency | Version | SPDX/license | Disposition |
| --- | ---: | --- | --- |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | Approved formatter/linter |
| `@vitejs/plugin-react` | 5.2.0 | MIT | Approved build-time dependency |
| `@vscode/vsce` | 3.9.2 | MIT | Approved packaging dependency |
| `esbuild` | 0.28.1 | MIT | Approved build-time dependency |
| `fast-xml-parser` | 5.9.3 | MIT | Approved for local XML/SVG parsing, subject to sanitization controls |
| `imagetracerjs` | 1.2.6 | Unlicense | Approved local raster tracing implementation |
| `jimp` | 0.14.0 | MIT | Approved local PNG/JPG/JPEG decoder for the tracing pipeline |
| `pixi.js` | 8.14.0 | MIT | Approved required 2D runtime |
| `react` / `react-dom` | 19.2.7 | MIT | Approved Webview dependencies |
| `svgo` | 4.0.1 | MIT | Approved conservative SVG optimization |
| `three` | 0.185.1 | MIT | Approved lazy WebGL2 renderer for validated local GLB packages |
| `typescript` | 5.9.3 | Apache-2.0 | Approved build-time dependency |
| `vite` | 7.3.6 | MIT | Approved Webview build dependency |
| `vitest` | 4.1.10 | MIT | Approved unit-test runner |
| `zod` | 4.4.3 | MIT | Approved runtime schema validation |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/vscode` | lockfile versions | MIT | Approved development-only type packages |

### Tracer migration and current release status

The asset pipeline no longer imports or declares `potrace@2.1.8`. It uses `imagetracerjs@1.2.6` under the Unlicense and `jimp@0.14.0` under MIT. `pnpm-lock.yaml` contains no Potrace package entry, and `scripts/validate-vsix.mjs` rejects a packaged extension bundle containing the removed dependency name. This removes the recorded GPL-2.0 tracer blocker.

Publication gate status after the 2026-07-12 re-audit:

- Direct dependency inventory matches the installed manifests and `THIRD_PARTY_NOTICES.md`.
- Rive remains uninstalled; Three.js is installed only for the lazy local WebGL path and is listed in the current notices.
- Built-in SVG/Pixi assets carry authorship, license metadata, and SHA-256 attestation below.
- Re-run `pnpm validate:notices`, `pnpm validate:vsix`, and the release checklist before every release candidate.

## Deferred or restricted candidates

These packages are reviewed but not installed in the current lockfile:

| Dependency | Audit version | SPDX/license | Restriction |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | Deferred optional runtime; must remain out of the base MVP bundle |
| `sharp` | 0.35.3 | Apache-2.0 | Optional local preprocessing only; review native-binary packaging before use |
| `motion` | 12.42.2 | MIT | Optional interface transitions only; do not add unless the Webview needs it |
| `@pixiv/three-vrm` | 3.5.5 | MIT | Deferred post-MVP 3D adapter only |

## Upstream reference snapshot

The following repositories are **references only**. HEAD SHAs were captured with `git ls-remote <repository> HEAD` on 2026-07-10; license identifiers were checked against the repositories' GitHub metadata/license files.

| Upstream | License | Audited HEAD SHA | Use decision |
| --- | --- | --- | --- |
| [AITuber OnAir](https://github.com/shinshin86/aituber-onair) | MIT | `53b2f67982c2d7951e4c50ae8555b46cffc9d929` | Reference-only; no modules or assets adapted for the MVP |
| [PixiJS](https://github.com/pixijs/pixijs) | MIT | `497a53ca60e3c46ca01cd3efbb9ca0a4f37e3b10` | Runtime API/reference; package consumption only |
| [PixiJS skills](https://github.com/pixijs/pixijs-skills) | MIT | `6aae70d76cf410432dd144029c07a1ad4bb12793` | Coding reference only; do not bundle |
| [Inochi2D](https://github.com/Inochi2D/inochi2d) | BSD-2-Clause | `8e296345501583c85d5672890499eade5ee4fedd` | Deferred optional runtime research only |
| [Inochi Creator](https://github.com/Inochi2D/inochi-creator) | BSD-2-Clause | `dba60811cff224f8cc9ce367b1d9291bfa5f7640` | Deferred workflow reference only |
| [Project AIRI](https://github.com/moeru-ai/airi) | MIT | `9560a26fe24170274442ad53d89cab7e5fe251e1` | Architecture reference only; no assets copied |
| [TalkingHead](https://github.com/met4citizen/TalkingHead) | MIT | `eed58d198076a7e1e825f804802921c4d3804d46` | Architecture reference only; no assets copied |
| [three-vrm](https://github.com/pixiv/three-vrm) | MIT | `ff42fae4fcee1fcbca2cd262c7f5f8cbddeaf5ab` | Deferred optional adapter dependency |

## Proprietary and external-tool gates

### Live2D

Live2D Cubism is not an ordinary permissive open-source dependency. Development and publication are governed by Live2D's proprietary/open software agreements and release-license terms. Do not commit or distribute Cubism SDK binaries, Core files, sample models, textures, or proprietary assets. Phase 16 remains deferred until a dedicated licensing review is repeated for the intended publisher and distribution model.

### Blender

Blender is an optional external executable and must never be bundled or required by the extension. Project-authored Blender Python scripts may invoke a user-installed Blender process in Phase 17, but Blender's own binaries and sample assets are not distributed by this project.

### Inochi2D and VRM

The code licenses recorded above do not license user models. Every `.inp`, `.inx`, `.vrm`, `.glb`, texture, motion, and expression file requires its own author/license metadata and redistribution review.

## Current built-in asset inventory

These assets are clean-room original project work authored for Codex Avatar Studio. They are geometric placeholder shapes, not third-party characters. Redistribution follows the repository `LICENSE` (`UNLICENSED` / all rights reserved) until the project chooses a public license. Authorship is recorded in `apps/extension/media/avatars/avatar.manifest.json`.

| Asset | SHA-256 | Disposition |
| --- | --- | --- |
| `apps/extension/media/avatars/svg/placeholder-avatar.svg` | `2F7389390C64D310F9849CE7ECA519CE514CB2E942B6E63764EEBAD10F21D980` | Attested clean-room SVG fallback; original project work |
| `apps/extension/media/avatars/pixi/placeholder-spritesheet.svg` | `CCE1D12D930A246B25F55661AF36A9B960A228E834201A1821341BEA94B28DB4` | Attested clean-room Pixi atlas; original project work |
| `apps/extension/media/avatars/pixi/placeholder-spritesheet.json` | `B9F4A917542D2FB7715A0D51EC8E9F49328AF9C0441BF027E71E9F7277732241` | Attested clip map for the clean-room atlas |
| `apps/extension/media/icon.png` | `5CAB19385AA3C98570C3D75B5CC1F2C60873D635EAA75713B10099B0CFDA1843` | Attested extension icon derived from the same original orb concept |

No `.riv`, `.glb`, `.vrm`, Live2D model, third-party spritesheet, voice, or third-party character asset is present in the active source asset inventory. Generated Webview JavaScript is code output, not avatar artwork.

## Required release actions

- Keep `THIRD_PARTY_NOTICES.md` aligned with installed manifests via `pnpm validate:notices`.
- Prove optional runtime packages and removed GPL-2.0 paths are absent from the base bundle (`pnpm validate:vsix`).
- Keep authorship/license metadata attached to the original built-in SVG and PixiJS spritesheet.
- Re-run dependency and asset license checks before every release candidate.
- Treat any unknown or ambiguous asset license as non-redistributable until resolved.

## What users may distribute

The repository's project license is currently **UNLICENSED / all rights reserved**. Imported avatar packages are user-owned inputs and remain subject to their own licenses; the extension does not relicense them. A distributable VSIX must include the project `LICENSE`, `THIRD_PARTY_NOTICES.md`, and dependency license texts required by the final dependency graph. This document is guidance for engineering release review, not legal advice.
