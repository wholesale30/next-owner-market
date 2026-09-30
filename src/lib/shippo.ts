/** Minimal Shippo client (REST). Needs SHIPPO_API_KEY (test keys start with shippo_test_, live with shippo_live_). */
const BASE = "https://api.goshippo.com";
export const shippoReady = () => !!process.env.SHIPPO_API_KEY;
async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(typeof j === "object" && j ? JSON.stringify(j).slice(0, 300) : `Shippo ${r.status}`);
  return j as T;
}
export interface Address { name: string; street1: string; street2?: string; city: string; state: string; zip: string; country?: string; phone?: string; email?: string }
export interface Rate { object_id: string; amount: string; currency: string; provider: string; servicelevel: { name: string; token: string }; estimated_days: number | null; duration_terms?: string }
export async function getRates(from: Address, to: Address, parcel: { length: number; width: number; height: number; weight: number }) {
  const s = await call<{ object_id: string; rates: Rate[]; messages?: { text: string }[] }>("/shipments/", {
    address_from: { ...from, country: from.country || "US" }, address_to: { ...to, country: to.country || "US" },
    parcels: [{ length: String(parcel.length), width: String(parcel.width), height: String(parcel.height), distance_unit: "in", weight: String(parcel.weight), mass_unit: "lb" }],
    async: false,
  });
  if (!s.rates?.length) throw new Error(`No rates. ${(s.messages || []).map((m) => m.text).join(" ")}`);
  return s.rates.sort((a, b) => Number(a.amount) - Number(b.amount));
}
export async function buyLabel(rateId: string) {
  const t = await call<{ status: string; label_url: string; tracking_number: string; tracking_url_provider: string; rate: { amount: string; provider: string; servicelevel: { name: string } } | string; messages?: { text: string }[] }>("/transactions/", { rate: rateId, label_file_type: "PDF_4x6", async: false });
  if (t.status !== "SUCCESS") throw new Error(`Label failed: ${(t.messages || []).map((m) => m.text).join(" ")}`);
  return t;
}
