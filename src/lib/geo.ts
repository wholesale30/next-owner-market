import zipcodes from "zipcodes";

export interface Geo { zip: string; city: string; state: string; lat: number; lng: number }
export function lookupZip(zip: string | null | undefined): Geo | null {
  const z = (zip || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return null;
  const r = zipcodes.lookup(z) as { zip: string; latitude: number; longitude: number; city: string; state: string; country: string } | undefined;
  if (!r || r.country !== "US") return null;
  return { zip: z, city: r.city, state: r.state, lat: r.latitude, lng: r.longitude };
}
export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
