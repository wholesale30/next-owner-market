#!/usr/bin/env python3
"""Build docs/Next_Owner_Market_App_Builder_Playbook.md from docs/playbook/template.md.

The template quotes real code with markers, so the playbook always shows the code as it is today:
  {{FILE path lang}}            the whole file, in a fenced block
  {{LINES path start end lang}} lines start..end (1-based, inclusive)
  {{BETWEEN path "start text" "end text" lang}}  from the line containing start text up to (not including) the line containing end text
Run by scripts/package.sh before the Word files are made.
"""
import os, re, shlex

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "docs", "playbook", "template.md")
OUT = os.path.join(ROOT, "docs", "Next_Owner_Market_App_Builder_Playbook.md")


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read().rstrip("\n").split("\n")


def fence(lines, lang, src):
    body = "\n".join(lines)
    ticks = "````" if "```" in body else "```"
    return f"*Source: `{src}`*\n\n{ticks}{lang}\n{body}\n{ticks}"


def render(m):
    parts = shlex.split(m.group(1))
    kind, path = parts[0], parts[1]
    lines = read(path)
    if kind == "FILE":
        return fence(lines, parts[2] if len(parts) > 2 else "", path)
    if kind == "LINES":
        a, b = int(parts[2]), int(parts[3])
        return fence(lines[a - 1:b], parts[4] if len(parts) > 4 else "", f"{path}, lines {a}-{b}")
    if kind == "BETWEEN":
        s, e = parts[2], parts[3]
        i = next(n for n, l in enumerate(lines) if s in l)
        j = next(n for n, l in enumerate(lines) if n > i and e in l)
        return fence(lines[i:j], parts[4] if len(parts) > 4 else "", f"{path}, lines {i + 1}-{j}")
    raise ValueError(kind)


def main():
    with open(TPL, encoding="utf-8") as f:
        t = f.read()
    out = re.sub(r"\{\{(.+?)\}\}", render, t)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print(OUT)


if __name__ == "__main__":
    main()
