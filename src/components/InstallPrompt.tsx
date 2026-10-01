"use client";

import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function initiallyHidden() {
  if (typeof window === "undefined") return true;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || !!(navigator as unknown as { standalone?: boolean }).standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem("nom_install_dismissed") === "1"; } catch { /* ok */ }
  return standalone || dismissed;
}

/** "Put it on your home screen" — shown only after a result (a good moment), never on first load. Client-only. */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [hide, setHide] = useState(initiallyHidden);
  const [ios] = useState(() => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent));
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (hide || (!evt && !ios)) return null;
  function close() { setHide(true); try { localStorage.setItem("nom_install_dismissed", "1"); } catch { /* ok */ } }
  return (
    <div className="card p-3 text-sm flex items-center gap-3">
      <span className="text-3xl">📲</span>
      <div className="flex-1">
        <p className="font-semibold">Put it on your home screen</p>
        <p className="text-xs muted">{evt ? "Opens like an app next time you're in the store. Nothing to download." : "Tap the Share button at the bottom of Safari, then \"Add to Home Screen.\""}</p>
      </div>
      {evt && <button type="button" className="btn btn-primary shrink-0" onClick={async () => { await evt.prompt(); close(); }}>Add</button>}
      <button type="button" aria-label="No thanks" className="pill shrink-0" onClick={close}>×</button>
    </div>
  );
}
