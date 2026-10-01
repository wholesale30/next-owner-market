import { ImageResponse } from "next/og";

/** A share card: photo on the left (if any), big text on the right, brand strip. Used for items and valuations. */
export function shareCard({ title, big, sub, photo }: { title: string; big: string; sub?: string; photo?: string | null }) {
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#f6f5f1", fontFamily: "sans-serif" }}>
        {photo ? <img src={photo} alt="" style={{ width: 560, height: 630, objectFit: "cover" }} /> : <div style={{ width: 560, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#1f6f5c", color: "#fff", fontSize: 220 }}>💰</div>}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#1b1b1a", lineHeight: 1.15, display: "flex" }}>{title.slice(0, 90)}</div>
            <div style={{ fontSize: 76, fontWeight: 900, color: "#1f6f5c", marginTop: 28, display: "flex" }}>{big}</div>
            {sub && <div style={{ fontSize: 28, color: "#4f4e49", marginTop: 12, display: "flex" }}>{sub}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800, color: "#1b1b1a" }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: "#1f6f5c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>→</div>
            Next Owner Market
            <div style={{ fontSize: 22, fontWeight: 500, color: "#4f4e49", marginLeft: "auto", display: "flex" }}>nextownermarket.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
