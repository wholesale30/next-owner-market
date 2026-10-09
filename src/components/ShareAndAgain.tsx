"use client";
import { useState } from "react";

export type ShareTarget = { url: string; text: string; title: string; page?: string };

/**
 * Two big buttons right under a lookup's answer (Oct 9, 2026, owner's request): 📤 Share and 📸 Check another.
 * Share makes the find's public page (no name or location) and opens the phone's own share menu
 * (Messages, Facebook, email, Copy link…). Phones only open that menu right after a tap, so if making the page
 * took too long, the button turns into "📤 Send it now" and the next tap opens the menu instantly.
 * Phones without a share menu get the link copied instead.
 */
export default function ShareAndAgain({ prepare, againLabel, onAgain }: { prepare: () => Promise<ShareTarget | null>; againLabel: string; onAgain: () => void }) {
  const [target, setTarget] = useState<ShareTarget | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "ready" | "shared" | "copied" | "err">("idle");

  async function open(t: ShareTarget) {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.title, text: t.text, url: t.url });
        setState("shared");
      } catch (e) {
        // closed the menu → fine; lost the tap (page took too long) → offer one more tap
        setState((e as { name?: string })?.name === "NotAllowedError" ? "ready" : "idle");
      }
      return;
    }
    try { await navigator.clipboard.writeText(`${t.text} ${t.url}`); setState("copied"); } catch { setState("ready"); }
  }

  async function share() {
    if (target) return open(target);
    setState("busy");
    const t = await prepare().catch(() => null);
    if (!t) return setState("err");
    setTarget(t);
    await open(t);
  }

  const label = state === "busy" ? "Getting it ready…" : state === "ready" ? "📤 Send it now" : state === "err" ? "📤 Try again" : "📤 Share";
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary w-full text-base px-2 whitespace-nowrap" style={{ minHeight: 56 }} disabled={state === "busy"} onClick={share}>{label}</button>
        <button type="button" className="btn btn-secondary w-full text-base px-2 whitespace-nowrap" style={{ minHeight: 56 }} onClick={onAgain}>{againLabel}</button>
      </div>
      {state === "copied" && <p className="text-sm text-center" style={{ color: "var(--ok)" }}>✓ Link copied. Paste it in a text, email or post.</p>}
      {state === "shared" && <p className="text-sm text-center" style={{ color: "var(--ok)" }}>✓ Shared{target?.page ? <> · <a className="underline" href={target.page}>see its page</a></> : null}</p>}
      {state === "err" && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>Couldn&apos;t get it ready. Tap Share again.</p>}
      {(state === "idle" || state === "busy" || state === "ready") && <p className="text-xs muted text-center">Send it to a friend, Facebook, a text or email. 🔒 No name or location is shared.</p>}
    </div>
  );
}
