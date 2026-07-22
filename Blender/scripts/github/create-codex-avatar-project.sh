#!/usr/bin/env bash
set -euo pipefail

OWNER="${OWNER:-uset82}"
REPO="${REPO:-REPLACE_WITH_REPO_NAME}"
PROJECT_TITLE="${PROJECT_TITLE:-Codex Avatar Studio — IDE VTuber-lite Assistant}"

if [[ "$REPO" == "REPLACE_WITH_REPO_NAME" ]]; then
  echo "Set REPO first, for example: export REPO=codex-avatar-studio"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is not installed. Create the project manually using docs/GITHUB_PROJECT_SETUP.md."
  exit 1
fi

gh auth status

echo "Creating labels in $OWNER/$REPO"
python3 - <<'PY'
import json, subprocess, os
owner=os.environ.get('OWNER','uset82')
repo=os.environ.get('REPO')
with open('scripts/github/github-labels.json','r',encoding='utf-8') as f:
    labels=json.load(f)
for label in labels:
    cmd=['gh','label','create',label['name'],'--repo',f'{owner}/{repo}','--color',label['color'],'--description',label['description'],'--force']
    print(' '.join(cmd))
    subprocess.run(cmd, check=False)
PY

echo "Creating milestones"
for milestone in \
  "M0 — GitHub + Codex operating system" \
  "M1 — MVP IDE extension shell" \
  "M2 — SVG fallback + Rive runtime" \
  "M3 — Asset conversion pipeline" \
  "M4 — Blender + WebGL/WebGPU pipeline" \
  "M5 — Live2D optional VTuber-lite adapter" \
  "M6 — Settings, QA, packaging"; do
  gh api -X POST "repos/$OWNER/$REPO/milestones" -f title="$milestone" >/dev/null 2>&1 || true
done

echo "Creating project board if permissions allow"
gh project create --owner "$OWNER" --title "$PROJECT_TITLE" || true

echo "Creating initial issues"
python3 - <<'PY'
import json, subprocess, os, tempfile
owner=os.environ.get('OWNER','uset82')
repo=os.environ.get('REPO')
with open('scripts/github/github-issues.json','r',encoding='utf-8') as f:
    issues=json.load(f)
for issue in issues:
    labels=','.join(issue.get('labels',[]))
    with tempfile.NamedTemporaryFile('w',delete=False,encoding='utf-8') as tmp:
        tmp.write(issue['body'])
        tmp_path=tmp.name
    cmd=['gh','issue','create','--repo',f'{owner}/{repo}','--title',issue['title'],'--body-file',tmp_path]
    if labels:
        cmd += ['--label', labels]
    print(' '.join(cmd))
    subprocess.run(cmd, check=False)
PY

echo "Done. Open docs/GITHUB_PROJECT_SETUP.md to finish custom Project fields/views manually if needed."
