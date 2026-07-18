#!/usr/bin/env sh
set -eu

SOURCE="${WEBDESIGNER_SOURCE:-uset82/webdesigner}"
REF="${WEBDESIGNER_REF:-main}"
MARKETPLACE="${WEBDESIGNER_MARKETPLACE:-webdesigner-repo-marketplace}"
PLUGIN="${WEBDESIGNER_PLUGIN:-webdesigner}"

for command_name in codex git node; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "WebDesigner requires '$command_name' on PATH." >&2
    exit 1
  fi
done

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 20 ]; then
  echo "WebDesigner requires Node.js 20 or newer; found $(node --version)." >&2
  exit 1
fi

source_is_local=false
if [ -d "$SOURCE" ]; then
  source_is_local=true
fi

marketplaces="$(codex plugin marketplace list)"
if printf '%s\n' "$marketplaces" | awk -v name="$MARKETPLACE" 'NR > 1 && $1 == name { found = 1 } END { exit found ? 0 : 1 }'; then
  if [ "$source_is_local" = true ]; then
    echo "Using existing local WebDesigner marketplace..."
  else
    echo "Updating WebDesigner marketplace..."
    codex plugin marketplace upgrade "$MARKETPLACE"
  fi
else
  echo "Adding WebDesigner marketplace..."
  if [ "$source_is_local" = true ]; then
    codex plugin marketplace add "$SOURCE"
  else
    codex plugin marketplace add "$SOURCE" --ref "$REF"
  fi
fi

echo "Installing WebDesigner plugin..."
codex plugin add "$PLUGIN@$MARKETPLACE"

printf '\nWebDesigner is installed. Start a new Codex task to use the updated skills and tools.\n'
