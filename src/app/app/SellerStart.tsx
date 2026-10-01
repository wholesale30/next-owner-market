"use client";

import { useState } from "react";
import Link from "next/link";

export default function SellerStart({ approved, payoutsReady, itemCount, liveCount, refCode, refCount, credits, isPro, hasLocation }: { approved: boolean; payoutsReady: boolean; itemCount: number; liveCount: number; refCode: string; refCount: number; credits: number; isPro: boolean; hasLocation: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = `https://nextownermarket.com/signup?ref=${refCode}`;
  // In the order things actually happen. No crossed-out text: a done step just says "Done" in green.
  const steps: { done: boolean; label: string; doneLabel: string; href?: string; wait?: string; button?: string }[] = [
    { done: true, label: "Make your account", doneLabel: "Your account is made" },
    { done: approved, label: "We approve your account", doneLabel: "Your account is approved", wait: "Waiting on us. Usually the same day. You can list items while you wait." },
    { done: hasLocation, label: "Add your ZIP code", doneLabel: "ZIP code added", href: "/account/profile", button: "Add my ZIP", wait: "So buyers near you can find your stuff." },
    { done: itemCount > 0, label: "List your first item", doneLabel: "First item listed", href: "/app/items/new", button: "List an item", wait: "Pick photos from your phone. The AI writes the rest." },
    { done: liveCount > 0, label: "Your first item goes live in the store", doneLabel: "Your first item is live", wait: itemCount > 0 ? "We look at new sellers' first items before they go live. Usually the same day." : "Happens after you list your first item." },
    { done: payoutsReady, label: "Set up payouts so you get paid", doneLabel: "Payouts are set up", href: "/app/money", button: "Set up payouts", wait: "About 5 minutes. Your items can sell before this; we hold the money until you finish." },
  ];
  const next = steps.findIndex((x) => !x.done && !!x.href); // the next thing YOU can do (approval and going live are on us)
  const remaining = steps.filter((s) => !s.done).length;
  async function share() {
    const text = `I'm selling on Next Owner Market. Upload photos, the AI writes the listing, buyers pay by card. Sign up with my link and we both get a free month of Pro: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "Next Owner Market", text, url: link });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* cancelled */ }
  }
  return (
    <div className="space-y-3">
      {remaining > 0 && (
        <div className="card p-3 space-y-1">
          <p className="font-semibold text-base">Getting started: {steps.length - remaining} of {steps.length} done</p>
          <p className="text-xs muted">Go top to bottom. A green check means that step is done.</p>
          <ol className="space-y-2 pt-1">
            {steps.map((st, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={i === next ? { background: "var(--surface-2, rgba(0,0,0,0.04))", borderRadius: 10, padding: "8px" } : { padding: "0 8px" }}>
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm" style={st.done ? { background: "var(--ok)", color: "#fff" } : { border: "2px solid var(--brand)", color: "var(--brand)" }}>{st.done ? "✓" : i + 1}</span>
                <div className="min-w-0 flex-1">
                  {st.done ? (
                    <p className="font-semibold">{st.doneLabel} <span style={{ color: "var(--ok)" }}>· Done</span></p>
                  ) : (
                    <>
                      <p className="font-semibold">{st.label}{i === next ? <span className="muted font-normal"> · do this next</span> : !st.href ? <span className="muted font-normal"> · waiting on us</span> : ""}</p>
                      {st.wait && <p className="text-xs muted">{st.wait}</p>}
                      {st.href && i === next && <Link href={st.href} className="btn btn-primary mt-2 inline-block">{st.button || "Go"} →</Link>}
                      {st.href && i !== next && <Link href={st.href} className="text-xs underline">{st.button || "Go"}</Link>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="card p-3 text-sm flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Invite a seller, get a month of Pro free</p>
          <p className="muted text-xs">Both of you do, when they go Pro. {refCount ? `${refCount} joined so far.` : ""}{credits ? ` ${credits} free month${credits > 1 ? "s" : ""} waiting${isPro ? " (applied to your next bill)" : " (applied when you upgrade)"}.` : ""}</p>
        </div>
        <button className="btn btn-primary shrink-0" onClick={share}>{copied ? "Copied!" : "Share link"}</button>
      </div>
    </div>
  );
}
