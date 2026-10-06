#!/usr/bin/env bash
# Before a deploy: list every file that will change on the live site, so a "one fix" can't carry stray changes
# (Operating Rule: surgical fixes only). Idea from the political posting app's diff_check.sh, Oct 5, 2026.
#   bash scripts/diff_check.sh          -> files changed since the last deploy (committed and not yet committed)
#   bash scripts/diff_check.sh --mark   -> record the current commit as deployed (run after the deploy is READY)
set -euo pipefail
cd "$(dirname "$0")/.."
f=/home/claude/deliverables/.last_deployed
mkdir -p "$(dirname "$f")"
if [ "${1:-}" = "--mark" ]; then git rev-parse HEAD > "$f"; echo "marked deployed: $(git log -1 --format='%h %s' | cut -c1-80)"; exit 0; fi
base=$(cat "$f" 2>/dev/null || git rev-parse origin/main)
echo "Going live (since $(git log -1 --format='%h' "$base")):"
{ git diff --name-only "$base" HEAD; git diff --name-only; git ls-files --others --exclude-standard; } | sort -u | grep -v '^docs/' | sed 's/^/  /' || echo "  (no code changes)"
