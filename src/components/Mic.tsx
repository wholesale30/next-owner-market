"use client";

import { useEffect, useRef, useState } from "react";

type Rec = { start: () => void; stop: () => void; abort: () => void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type W = Window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };

/** Tap-to-talk. Appends what you say to the field. Falls back to a hint about the keyboard mic where the browser can't listen. */
export default function Mic({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [hint, setHint] = useState(false);
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    const w = window as W;
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    const t = setTimeout(() => setSupported(!!C), 0);
    return () => clearTimeout(t);
  }, []);
  function toggle() {
    if (!supported) { setHint(true); setTimeout(() => setHint(false), 4000); return; }
    if (on) { rec.current?.stop(); return; }
    const w = window as W;
    const C = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new C();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim()); };
    r.onend = () => { setOn(false); rec.current = null; };
    r.onerror = () => { setOn(false); rec.current = null; };
    rec.current = r; setOn(true); r.start();
  }
  if (supported === null) return null;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? "Stop listening" : "Talk instead of typing"} className="pill px-3 py-2" style={on ? { background: "var(--danger)", color: "#fff", borderColor: "transparent" } : undefined}>{on ? "● Listening… tap to stop" : "🎤 Talk"}</button>
      {hint && <span className="text-xs muted">Tap the box, then the 🎤 on your keyboard.</span>}
    </span>
  );
}
