#!/usr/bin/env bash
# One download with every current file. Shayne's rule (Oct 2, 2026): every send is ONE zip,
# named with the date and time so the newest is obvious in Downloads and nothing has to be deleted one by one.
# Usage: bash scripts/package.sh   -> prints the zip path to send with SendUserFile.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/journal.py >/dev/null
python3 scripts/changelog.py >/dev/null
python3 scripts/build_playbook.py >/dev/null   # App Builder's Playbook: re-reads the real code every time
# rebuild every Word copy from its source so nothing in the zip is stale
for md in docs/Next_Owner_Market_*.md; do
  docx="${md%.md}.docx"
  pandoc "$md" --from gfm-tex_math_dollars -o "$docx"
done
stamp=$(TZ=America/New_York date +%Y-%m-%d_%H%M)  # 24-hour so names sort newest-last correctly
out=/home/claude/deliverables
mkdir -p "$out"
rm -f "$out"/Next_Owner_Market_Files_*.zip
dir=$(mktemp -d)/Next_Owner_Market_Files_$stamp
mkdir -p "$dir/Pictures"
cp docs/Next_Owner_Market_*.docx "$dir/"
cp docs/brand/*.png "$dir/Pictures/" 2>/dev/null || true
{
  echo "Next Owner Market: every current file"
  echo "Made $(TZ=America/New_York date '+%A, %B %-d, %Y at %-I:%M %p') Eastern."
  echo
  echo "This zip replaces any older one. Keep the newest zip and delete the rest."
  echo "File names never change, so these replace your old copies one for one."
  echo
  echo "What's inside:"
  (cd "$dir" && find . -type f ! -name READ_ME_FIRST.txt | sed 's|^\./|  - |' | sort)
} > "$dir/READ_ME_FIRST.txt"
zip_path="$out/Next_Owner_Market_Files_$stamp.zip"
(cd "$(dirname "$dir")" && zip -qr "$zip_path" "$(basename "$dir")")
echo "$zip_path"
