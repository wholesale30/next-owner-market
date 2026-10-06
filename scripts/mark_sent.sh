#!/usr/bin/env bash
# Run right after the zip is sent to the owner (SendUserFile). Records which code version the owner now has,
# so scripts/stop_check.py (the Stop hook) knows nothing is waiting to be sent. Idea from the political posting app.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p /home/claude/deliverables
git rev-parse HEAD > /home/claude/deliverables/.last_sent
echo "marked sent: $(git log -1 --format='%h %s' | cut -c1-80)"
