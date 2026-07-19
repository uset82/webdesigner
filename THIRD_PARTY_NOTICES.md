# Third-Party and Source Notices

This project is an agent guidance pack. The Blender bridge and specialist skills are development tooling, not application runtime dependencies. Their upstream terms remain in force; this file does not relicense them.

The eight Blender skills were imported from [`uset82/avatar-studio`](https://github.com/uset82/avatar-studio) at commit `44b6ac731e4b7a5c213951f0b970234ff20b8845`. That source repository is marked `UNLICENSED`; its project-owned `blender-technical-artist` skill is redistributed here under the repository owner's authorization.

## Project-local Blender skills

| Skills | Source pin | License and notice |
| --- | --- | --- |
| `blender-modeling`, `blender-materials`, `blender-animation`, `blender-export`, `animation-quality-gate` | [`roble3/cc-blender-skill@11016c9a5847897491dde935c346571bd7548e3d`](https://github.com/roble3/cc-blender-skill/tree/11016c9a5847897491dde935c346571bd7548e3d) | MIT; Copyright (c) 2026 RobLe3. [Full license](https://github.com/roble3/cc-blender-skill/blob/11016c9a5847897491dde935c346571bd7548e3d/LICENSE). |
| `rigging-animation` | [`omer-metin/skills-for-antigravity@e8dcf4e8737921a10088bd5c9eb65e81f74c051f`](https://github.com/omer-metin/skills-for-antigravity/tree/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/rigging-animation) | Apache-2.0. [Full license](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/LICENSE). |
| `blender-motion-state-inspection` | [`affaan-m/everything-claude-code@ed387446052dfbc6b52de149406b70efa65edc59`](https://github.com/affaan-m/everything-claude-code/tree/ed387446052dfbc6b52de149406b70efa65edc59/skills/blender-motion-state-inspection) | MIT; Copyright (c) 2026 Affaan Mustafa. [Full license](https://github.com/affaan-m/everything-claude-code/blob/ed387446052dfbc6b52de149406b70efa65edc59/LICENSE). |

## Blender MCP

The optional project configuration pins `blender-mcp==1.6.4`. The Blender add-on is pinned to commit `6641189231caf3752302ae20591bc87fda85fc4e` and raw-download SHA-256 `BBA60831F5F89A74DEDA0294B131668A086CF46EB35A6A01ABBD0D21D9E92630`.

The add-on remains governed by its [upstream terms and conditions](https://github.com/ahujasid/blender-mcp/blob/6641189231caf3752302ae20591bc87fda85fc4e/TERMS_AND_CONDITIONS.md). The setup verifier installs or replaces it only through an explicit command; normal agent work must use verification-only mode.

No Blender binary, third-party demo asset, model, texture, motion, voice, or remote-provider content is bundled by this project.

## Animate UI

The `animate-ui` skill references [`imskyleen/animate-ui`](https://github.com/imskyleen/animate-ui), which is distributed under the MIT License. WebDesigner does not bundle Animate UI component source. When a user requests compatible animated React UI, the generated application may install selected registry items through the Shadcn CLI under the upstream terms.
