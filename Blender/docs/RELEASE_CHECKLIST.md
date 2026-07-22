# Release Checklist

## Preflight

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm smoke:webview`.
- [ ] Run `pnpm validate:notices`.
- [ ] Run `pnpm package:vsix`.
- [ ] Run `pnpm validate:vsix`.
- [ ] Run `pnpm smoke:vsix`.
- [ ] Run `pnpm smoke:clean-profile` (requires a local VS Code CLI; uses `code.cmd`, not `Code.exe`).

## VSIX

- [ ] Confirm `dist/codex-avatar-studio-0.1.0.vsix` exists.
- [ ] Install the VSIX in an isolated VS Code profile (`pnpm smoke:clean-profile` or the same CLI with temp `--extensions-dir` / `--user-data-dir`).
- [ ] Open Extension Development Host or a local VS Code window with the installed extension.
- [ ] Run `Codex Avatar: Open Assistant`.
- [ ] Confirm SVG fallback renders.
- [ ] Confirm asset manager opens and reload works.
- [ ] Confirm optional missing Rive, Live2D, WebGL, WebGPU, and Blender assets fail gracefully.

## Versioning and pre-release policy

- The extension version in `apps/extension/package.json` is the source of truth for stable VSIX output.
- Use `pnpm package:vsix:pre` to create `codex-avatar-studio-<version>-pre.1.vsix` without modifying the source version.
- Update `CHANGELOG.md` with user-visible changes before publishing a stable version. Keep `LICENSE` and `THIRD_PARTY_NOTICES.md` in every package.
- Run `pnpm validate:notices` after dependency changes so notices stay aligned with installed manifests.
- Run `pnpm validate:vsix` and `pnpm smoke:vsix` on the exact VSIX artifact intended for distribution.

## Notes

- The extension host is bundled for VSIX packaging. Optional runtime assets remain separate and local.
