"use client";

import { useState } from "react";
import Link from "next/link";

export default function SellerStart({ approved, payoutsReady, itemCount, liveCount, refCode, refCount, credits, isPro, hasLocation }: { approved: boolean; payoutsReady: boolean; itemCount: number; liveCount: number; refCode: string; refCount: number; credits: number; isPro: boolean; hasLocation: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = `https://nextownermarket.com/signup?ref=${refCode}`;
  const steps = [
    { done: true, label: "Make your account" },
    { done: hasLocation, label: "Tell us your ZIP (so buyers near you find your stuff)", href: "/account/profile" },
    { done: payoutsReady, label: "Set up payouts (5 minutes; that's how you get paid)", href: "/app/money" },
    { done: itemCount > 0, label: "List your first item (pick photos, AI writes the rest)", href: "/app/items/new" },
    { done: approved, label: "We OK your account (usually same day)" },
    { done: liveCount > 0, label: "Your first item is live. Share it!" },
  ];
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
          <p className="font-semibold">Your first sale in 10 minutes ({steps.length - remaining}/{steps.length} done)</p>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span>{s.done ? "✅" : "⬜"}</span>
              {s.href && !s.done ? <Link href={s.href} className="underline font-semibold">{s.label} →</Link> : <span className={s.done ? "muted line-through" : ""}>{s.label}</span>}
            </div>
          ))}
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
