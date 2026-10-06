#!/usr/bin/env python3
"""Stop hook: don't let a turn end while code changes haven't been sent to the owner (Operating Rule 20).

Blocks (exit 2, reason on stderr) when either:
  - there are uncommitted changes outside docs/, or
  - a commit that touches anything outside docs/ is newer than the last send.
"Last send" = the commit in /home/claude/deliverables/.last_sent (written by scripts/mark_sent.sh after SendUserFile);
if that file is missing (new session), the latest "Records" commit is used instead.
Records-only commits (docs/) never block. Never blocks twice in a row (stop_hook_active), so it can't loop.
Pattern from the political posting app (scripts/stop_check.py there), Oct 5, 2026.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.rstrip()

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    if payload.get("stop_hook_active"):
        return 0
    dirty = [l for l in git("status", "--porcelain").splitlines() if len(l) > 3 and not l[3:].startswith("docs/")]
    base = ""
    marker = "/home/claude/deliverables/.last_sent"
    if os.path.exists(marker):
        base = open(marker).read().strip()
        if base and subprocess.run(["git", "merge-base", "--is-ancestor", base, "HEAD"], cwd=ROOT).returncode != 0:
            base = ""
    if not base:
        base = git("log", "-1", "--format=%H", "--grep=^Records")
    unsent = git("log", "--format=%h %s", f"{base}..HEAD", "--", ".", ":(exclude)docs") if base else ""
    if not dirty and not unsent:
        return 0
    msg = ["Owner's rule 20: changes haven't been sent to him yet."]
    if dirty:
        msg.append("Uncommitted changes: " + ", ".join(l[3:] for l in dirty[:8]))
    if unsent:
        msg.append("Commits not yet sent:\n  " + "\n  ".join(unsent.splitlines()[:10]))
    msg.append("Finish: commit, git pull --rebase, push, deploy, bash scripts/package.sh, SendUserFile the zip it prints, then bash scripts/mark_sent.sh.")
    print("\n".join(msg), file=sys.stderr)
    return 2

if __name__ == "__main__":
    sys.exit(main())
