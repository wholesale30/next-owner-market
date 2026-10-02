#!/usr/bin/env python3
"""Rebuild docs/Next_Owner_Market_Change_Log.md (+ .docx) from git history: every change, when, what, which files."""
import subprocess, os, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT = os.path.join(DOCS, "Next_Owner_Market_Change_Log.md")

def git(*a): return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout

AREA = [
  ("src/app/api/", "Server routes (API)"), ("src/app/app/", "Seller / staff app"), ("src/app/account/", "Buyer account & orders"),
  ("src/app/item/", "Public item page"), ("src/app/", "Public site pages"), ("src/lib/", "Shared code (logic)"), ("src/components/", "Shared UI pieces"),
  ("supabase/", "Database (migrations)"), ("docs/", "Documents"), ("scripts/", "Automation scripts"), ("public/", "Static files (logo, icons)"),
  (".claude/", "Project automation"), ("CLAUDE.md", "Project rules"), ("package", "Dependencies"),
]
def area(path):
    for pre, name in AREA:
        if path.startswith(pre): return name
    return "Other"

def main():
    log = git("log", "--reverse", "--date=iso-local", "--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e")
    commits = [c for c in log.split("\x1e") if c.strip()]
    out = ["# Next Owner Market — Change Log\n", f"*Every change to the code, database, and documents, oldest first. Generated {datetime.datetime.now().strftime('%B %-d, %Y %-I:%M %p')} from the project history ({len(commits)} changes).*\n"]
    byday = collections.OrderedDict()
    for c in commits:
        h, date, subj, body = (c.split("\x1f") + ["", "", "", ""])[:4]
        day = date[:10]
        files = [f for f in git("show", "--stat=200", "--format=", "--name-only", h.strip()).split("\n") if f.strip()]
        byday.setdefault(day, []).append((date[11:16], subj.strip(), body, files, h.strip()[:7]))
    for day, items in byday.items():
        out.append(f"\n## {datetime.date.fromisoformat(day).strftime('%A, %B %-d, %Y')}\n")
        for t, subj, body, files, h in items:
            out.append(f"### {t} — {subj}\n")
            notes = "\n".join(l for l in body.split("\n") if l.strip() and not l.startswith("Co-Authored-By") and not l.startswith("Claude-Session")).strip()
            if notes: out.append(notes + "\n")
            groups = collections.OrderedDict()
            for f in files: groups.setdefault(area(f), []).append(f)
            for g, fs in groups.items():
                out.append(f"- **{g}:** " + ", ".join(f"`{f}`" for f in fs[:12]) + (f" (+{len(fs)-12} more)" if len(fs) > 12 else ""))
            out.append(f"\n<sub>change id {h}</sub>\n")
    open(OUT, "w").write("\n".join(out))
    docx = OUT.replace(".md", ".docx")
    subprocess.run(["pandoc", OUT, "-o", docx, "--from", "gfm-tex_math_dollars", "--to", "docx"], check=False)
    if os.path.isdir("/home/claude/deliverables"): subprocess.run(["cp", docx, "/home/claude/deliverables/"], check=False)
    print("change log updated:", docx, len(commits), "changes")

if __name__ == "__main__": main()
