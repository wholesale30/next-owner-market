#!/usr/bin/env python3
"""Builds docs/Under_the_Green_Umbrella_App_White_Paper.md (and .docx): the starter white paper for Shayne's
sister's app (Oct 24, 2026). Part 1 (her plan) is hand-written in docs/whitepaper_ugu/front.md; Parts 2-3 are the
App Builder's Playbook (template), so every new lesson (T-numbers) flows in automatically each time package.sh runs.
Code listings are left out (they're in the Playbook Word file)."""
import re, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
docs = root / "docs"
front = (docs / "whitepaper_ugu" / "front.md").read_text()
tpl = (docs / "playbook" / "template.md").read_text().split("\n")

def find(prefix):
    return next(i for i, l in enumerate(tpl) if l.startswith(prefix))

p2 = find("## 1. How we work")
p4 = find("## 4. Patterns that worked")
end = find("# Appendix A")
strip = lambda lines: [re.sub(r"\{\{(FILE|LINES) [^}]*\}\}", "*(Full code: see the App Builder's Playbook Word file.)*", l) for l in lines]
part2 = strip(tpl[p2:p4])
part3 = strip(tpl[p4:end])
rules = (docs / "Next_Owner_Market_Operating_Rules.md").read_text()
rules = re.sub(r"^# .*\n", "", rules, count=1)

out = front.rstrip() + "\n\n" + "\n".join(part2) + "\n\n# PART 3: Everything we learned (patterns, services, gotchas, every mistake and its rule)\n\n" \
    + "\n".join(part3) + "\n\n# Appendix A: The Operating Rules (full text)\n\n" + rules
md = docs / "Under_the_Green_Umbrella_App_White_Paper.md"
md.write_text(out)
subprocess.run(["pandoc", str(md), "--from", "gfm-tex_math_dollars", "-o", str(md.with_suffix(".docx"))], check=True)
print(md.with_suffix(".docx"))
