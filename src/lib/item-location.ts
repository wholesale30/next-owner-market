/** Listings don't store a location; it comes from the seller's profile. Use OWNER_LOC in a select (service-role client), then withLoc(). */
export const OWNER_LOC = "owner:profiles!items_owner_id_fkey(city, state, lat, lng)";
export const OWNER_LOC_INNER = "owner:profiles!items_owner_id_fkey!inner(city, state, lat, lng)";
type Loc = { city: string | null; state: string | null; lat: number | null; lng: number | null };
export function withLoc<T extends { owner?: unknown }>(rows: T[] | null | undefined): (Omit<T, "owner"> & Loc)[] {
  return (rows || []).map((r) => {
    const o = (Array.isArray(r.owner) ? r.owner[0] : r.owner) as Partial<Loc> | null | undefined;
    const { owner: _o, ...rest } = r; void _o;
    return { ...(rest as Omit<T, "owner">), city: o?.city ?? null, state: o?.state ?? null, lat: o?.lat ?? null, lng: o?.lng ?? null };
  });
}
