import Link from "next/link";

/** The embeddable widget: a small card any site can iframe. Links back (that's the point). */
export const metadata = { title: "What's it worth?", robots: { index: false } };

export default function EmbedWorth() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <div className="card" style={{ padding: 16, borderRadius: 14, border: "2px solid #1f6f5c", background: "#fff", color: "#1b1b1a" }}>
        <p style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>💰 What&apos;s it worth?</p>
        <p style={{ fontSize: 14, margin: "6px 0 12px", color: "#4f4e49" }}>Take a photo of anything. Get what it is, what it sells for, and where. Free, 30 seconds.</p>
        <Link href={`${site}/worth?ref=embed`} target="_top" style={{ display: "block", textAlign: "center", background: "#1f6f5c", color: "#fff", padding: "12px 16px", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>Value my item →</Link>
        <p style={{ fontSize: 11, margin: "10px 0 0", color: "#4f4e49", textAlign: "center" }}>by <a href={site} target="_top" style={{ color: "#1f6f5c" }}>Next Owner Market</a></p>
      </div>
    </div>
  );
}
