import Link from "next/link";

/** The plain-English body of a tool page: what it is, steps, examples, FAQ (with FAQPage markup so Google shows the answers). */
export default function ToolGuide({ intro, steps, examples, faq, related }: {
  intro: string[];
  steps: { title: string; body: string }[];
  examples?: { title: string; result: string }[];
  faq: { q: string; a: string }[];
  related?: { href: string; label: string }[];
}) {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="space-y-2 text-[15px] leading-relaxed">{intro.map((p, i) => <p key={i}>{p}</p>)}</section>
      <section className="card p-4 space-y-3">
        <h2 className="font-bold text-lg">How it works, step by step</h2>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3"><div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: "var(--brand)", color: "#fff" }}>{i + 1}</div><div><p className="font-semibold">{s.title}</p><p className="text-sm muted">{s.body}</p></div></div>
        ))}
      </section>
      {examples && examples.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="font-bold text-lg">What it looks like</h2>
          {examples.map((e, i) => <div key={i} className="text-sm"><p className="font-semibold">{e.title}</p><p className="muted">{e.result}</p></div>)}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-bold text-lg">Questions people ask</h2>
        {faq.map((f, i) => <details key={i} className="card p-3"><summary className="font-semibold cursor-pointer">{f.q}</summary><p className="pt-2 text-sm">{f.a}</p></details>)}
      </section>
      {related && <p className="text-sm muted">Also: {related.map((r, i) => <span key={r.href}><Link href={r.href} className="underline">{r.label}</Link>{i < related.length - 1 ? " · " : ""}</span>)}</p>}
    </div>
  );
}
