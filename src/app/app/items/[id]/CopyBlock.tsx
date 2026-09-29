"use client";

import { useState } from "react";

export default function CopyBlock({ label, text, title }: { label: string; text: string; title?: string }) {
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
    </div>
  );
}
