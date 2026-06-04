#!/usr/bin/env bash
set -euo pipefail
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(pwd)"
copy_file() {
  local src="$PATCH_DIR/$1"
  local dst="$REPO_ROOT/$1"
  if [ ! -f "$src" ]; then echo "Missing patch file: $src" >&2; exit 1; fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "Updated $1"
}
copy_file "app/api/strava/mobile-status/route.ts"
copy_file "app/api/strava_sync/route.ts"
copy_file "app/api/strava/callback/route.ts"
copy_file "app/api/strava/disconnect/route.ts"
copy_file "mobile/src/screens/PlanScreen.tsx"
copy_file "mobile/src/screens/SettingsScreen.tsx"
echo "Patch applied. Run npm run typecheck && npm run lint."
