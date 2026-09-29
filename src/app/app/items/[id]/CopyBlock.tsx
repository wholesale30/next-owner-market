"use client";

import { useState } from "react";
import type { HowTo } from "@/lib/howto";

export default function CopyBlock({ label, text, title, howto }: { label: string; text: string; title?: string; howto?: HowTo }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      alert("Couldn't copy automatically. Press and hold the text to select it.");
    }
  }
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm">{label}</p>
        <div className="flex gap-1">
          {title && <button type="button" className="pill" onClick={() => copy("title", title)}>{copied === "title" ? "Copied!" : "Copy title"}</button>}
          <button type="button" className="pill pill-active" onClick={() => copy("body", text)}>{copied === "body" ? "Copied!" : "Copy"}</button>
        </div>
      </div>
      <pre className="text-xs whitespace-pre-wrap font-sans muted max-h-32 overflow-auto">{text}</pre>
      {howto && (
        <div className="text-sm">
          <button type="button" className="pill" onClick={() => setOpen(!open)}>{open ? "Hide" : "📖 How to post this on " + howto.app}</button>
          {open && (
            <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
              <p><b>Best for:</b> {howto.bestFor}</p>
              <p><b>Fees:</b> {howto.fees}</p>
              <div><p className="font-semibold">Before you start</p><ul className="list-disc pl-5">{howto.before.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
              <div><p className="font-semibold">Steps</p><ol className="list-decimal pl-5 space-y-1">{howto.steps.map((b, i) => <li key={i}>{b}</li>)}</ol></div>
              <div><p className="font-semibold">Tips</p><ul className="list-disc pl-5">{howto.tips.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
              <p className="text-xs muted">Apps move buttons around now and then; if a step looks different, the next one is usually right there.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
