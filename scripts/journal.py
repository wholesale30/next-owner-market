#!/usr/bin/env python3
import re
"""Rebuild docs/Next_Owner_Market_Build_Journal.md (+ .docx) from the chat transcript.

Usage:
  python3 scripts/journal.py                 # finds the newest transcript for this project
  python3 scripts/journal.py <transcript.jsonl>
Reads a PreCompact hook payload from stdin (JSON with transcript_path) when piped.
Part 1 (reconstructed day one) is kept verbatim from docs/journal_part1.md; Part 2 is regenerated.
"""
import json, re, sys, glob, os, datetime, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT_MD = os.path.join(DOCS, "Next_Owner_Market_Build_Journal.md")
PART1 = os.path.join(DOCS, "journal_part1.md")
DELIV = os.path.expanduser("~/../claude/deliverables") if os.path.isdir("/home/claude/deliverables") else DOCS

def find_transcript():
    try:
        import select
        if not sys.stdin.isatty() and select.select([sys.stdin], [], [], 0.2)[0]:
            payload = json.load(sys.stdin)
            if payload.get("transcript_path"): return payload["transcript_path"]
    except Exception: pass
    if len(sys.argv) > 1: return sys.argv[1]
    cands = glob.glob(os.path.expanduser("~/.claude/projects/*next-owner-market*/*.jsonl"))
    cands = [c for c in cands if os.path.getsize(c) > 10000]
    return max(cands, key=os.path.getmtime) if cands else None

def local(ts):
    d = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(datetime.timezone(datetime.timedelta(hours=-4)))
    return d.strftime("%b %-d, %-I:%M %p")

def rows_from(path):
    rows = []
    for line in open(path):
        try: j = json.loads(line)
        except Exception: continue
        t = j.get("type"); ts = j.get("timestamp", "")
        c = (j.get("message") or {}).get("content")
        if t == "user":
            txt = c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text") if isinstance(c, list) else None
            if txt:
                txt = re.sub(r"<system-reminder>.*?</system-reminder>", "", txt, flags=re.S).strip()
                if txt and not txt.startswith("This session is being continued"): rows.append(("U", ts, txt))
        elif t == "assistant" and isinstance(c, list):
            txt = "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text").strip()
            if txt: rows.append(("A", ts, txt))
    return rows

def render(rows, session_label):
    out = [f"\n## Session: {session_label}\n"]
    i = 0
    while i < len(rows):
        kind, ts, txt = rows[i]
        if kind == "U":
            out.append(f"### {local(ts)} — Shayne\n\n> " + txt.replace("\n", "\n> ") + "\n"); i += 1
            replies = []
            while i < len(rows) and rows[i][0] == "A": replies.append(rows[i][2]); i += 1
            if replies: out.append("**Claude:**\n\n" + "\n\n".join(replies) + "\n")
        else:
            out.append("**Claude:**\n\n" + txt + "\n"); i += 1
    return "\n".join(out)

def merge_rows(cache_path, rows):
    """Append-only cache: the transcript file is rewritten when the chat is condensed, so never trust it alone."""
    old = []
    if os.path.exists(cache_path):
        try: old = json.load(open(cache_path))
        except Exception: old = []
    seen = {(r[0], r[1], r[2][:120]) for r in old}
    for r in rows:
        k = (r[0], r[1], r[2][:120])
        if k not in seen: old.append(list(r)); seen.add(k)
    old.sort(key=lambda r: r[1])
    json.dump(old, open(cache_path, "w"))
    return [tuple(r) for r in old]

def main():
    path = find_transcript()
    if not path or not os.path.exists(path): print("no transcript found"); return
    rows = rows_from(path)
    part1 = open(PART1).read() if os.path.exists(PART1) else "# Next Owner Market — The Build Journal\n"
    sess_dir = os.path.join(DOCS, "journal_sessions"); os.makedirs(sess_dir, exist_ok=True)
    sid = os.path.basename(path).split(".")[0]
    rows = merge_rows(os.path.join(sess_dir, f"{sid}.rows.json"), rows)
    if not rows: print("no rows"); return
    # An .archive.md holds text captured before a condense wiped the transcript; new rows after its end are appended.
    archive = os.path.join(sess_dir, f"{sid}.archive.md")
    if os.path.exists(archive):
        a = open(archive).read()
        meta = os.path.join(sess_dir, f"{sid}.archive.json")
        end = json.load(open(meta))["end"] if os.path.exists(meta) else "0000"
        fresh = [r for r in rows if r[1] > end]
        text = a + ("\n" + render(fresh, "continued").split("\n", 2)[2] if fresh else "")
        # keep the session heading's end time current (the archive was written with its old end time)
        text = re.sub(r"(## Session: [^→\n]+→ )[^\n]+", lambda m: m.group(1) + local(rows[-1][1]) + " (continuing)", text, count=1)
    else:
        label = f"{local(rows[0][1])} → {local(rows[-1][1])} ({len([r for r in rows if r[0]=='U'])} messages from Shayne)"
        text = render(rows, label)
    open(os.path.join(sess_dir, f"{sid}.md"), "w").write(text)
    sessions = sorted(glob.glob(os.path.join(sess_dir, "*.md")), key=os.path.getmtime)
    sessions = [s for s in sessions if not s.endswith(".archive.md")]
    body = part1 + "\n\n---\n\n## Part 2 · Verbatim sessions\n" + "".join(open(s).read() for s in sessions)
    open(OUT_MD, "w").write(body)
    try:
        docx = os.path.join(DOCS, "Next_Owner_Market_Build_Journal.docx")
        subprocess.run(["pandoc", OUT_MD, "-o", docx, "--from", "gfm", "--to", "docx"], check=True)
        if os.path.isdir("/home/claude/deliverables"): subprocess.run(["cp", docx, "/home/claude/deliverables/"], check=False)
        print("journal updated:", docx)
    except Exception as e:
        print("markdown updated; docx failed:", e)

if __name__ == "__main__": main()
