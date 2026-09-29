"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Item, ItemPhoto, Location, Profile, Tier } from "@/lib/types";
import { CONDITION_LABELS, TIER_LABELS } from "@/lib/types";

interface Props {
  mode: "new" | "edit";
  profile: Profile;
  categories: Category[];
  locations: Location[];
  item?: Item;
  photos?: ItemPhoto[];
  defaultLocationId?: string;
}

type Draft = {
  title: string;
  description: string;
  brand: string;
  model: string;
  category_id: string;
  condition: string;
  condition_notes: string;
  specs: Record<string, string>;
  tags: string[];
  price: string;
  price_min_suggested: string;
  price_max_suggested: string;
  price_note: string;
  cost: string;
  quantity: string;
  location_id: string;
  location_code: string;
  tier: Tier;
  commission_pct: string;
  tested: boolean;
  serviced: boolean;
  service_notes: string;
  shipping_ok: boolean;
  local_pickup_ok: boolean;
  weight_lbs: string;
  worth_listing: boolean | null;
  warning: string | null;
};

type LocalPhoto = { id: string; file?: File; url: string; storage_path?: string; uploading?: boolean };

async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
}

export default function ItemForm({ mode, profile, categories, locations, item, photos: initialPhotos, defaultLocationId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const staff = profile.role === "admin" || profile.role === "staff";
  const fileRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<LocalPhoto[]>(
    (initialPhotos || []).map((p) => ({ id: p.id, url: p.url, storage_path: p.storage_path }))
  );
  const [hints, setHints] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"photos" | "details">(mode === "edit" ? "details" : "photos");

  const [d, setD] = useState<Draft>({
    title: item?.title || "",
    description: item?.description || "",
    brand: item?.brand || "",
    model: item?.model || "",
    category_id: item?.category_id || "",
    condition: item?.condition || "good",
    condition_notes: item?.condition_notes || "",
    specs: item?.specs || {},
    tags: item?.tags || [],
    price: item?.price != null ? String(item.price) : "",
    price_min_suggested: item?.price_min_suggested != null ? String(item.price_min_suggested) : "",
    price_max_suggested: item?.price_max_suggested != null ? String(item.price_max_suggested) : "",
    price_note: "",
    cost: item?.cost != null ? String(item.cost) : "",
    quantity: String(item?.quantity ?? 1),
    location_id: item?.location_id || defaultLocationId || "",
    location_code: "",
    tier: item?.tier || (staff ? "owned" : profile.default_tier || "drop_off"),
    commission_pct: item?.commission_pct != null ? String(item.commission_pct) : "",
    tested: item?.tested ?? false,
    serviced: item?.serviced ?? false,
    service_notes: item?.service_notes || "",
    shipping_ok: item?.shipping_ok ?? false,
    local_pickup_ok: item?.local_pickup_ok ?? true,
    weight_lbs: item?.weight_lbs != null ? String(item.weight_lbs) : "",
    worth_listing: null,
    warning: null,
  });
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  // ---------- photos ----------
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { id: tempId, file, url: preview, uploading: true }]);
      try {
        const blob = await compressImage(file);
        const path = `${profile.id}/${Date.now()}-${tempId}.jpg`;
        const { error: upErr } = await supabase.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
        setPhotos((p) => p.map((x) => (x.id === tempId ? { ...x, url: data.publicUrl, storage_path: path, uploading: false } : x)));
      } catch (e) {
        setError(`Photo upload failed: ${e instanceof Error ? e.message : String(e)}`);
        setPhotos((p) => p.filter((x) => x.id !== tempId));
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
  }
  function makePrimary(id: string) {
    setPhotos((p) => {
      const i = p.findIndex((x) => x.id === id);
      if (i <= 0) return p;
      const copy = [...p];
      const [ph] = copy.splice(i, 1);
      return [ph, ...copy];
    });
  }

  // ---------- AI ----------
  async function runAi() {
    const urls = photos.filter((p) => p.storage_path && !p.uploading).map((p) => p.url);
    if (!urls.length) return setError("Add at least one photo first.");
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls: urls, hints, categories: categories.map((c) => ({ id: c.id, name: c.name })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI failed");
      const a = json.draft;
      const mid = a.price_min && a.price_max ? Math.round((Number(a.price_min) + Number(a.price_max)) / 2) : "";
      set({
        title: a.title || "",
        description: a.description || "",
        brand: a.brand || "",
        model: a.model || "",
        category_id: categories.some((c) => c.id === a.category_id) ? a.category_id : d.category_id,
        condition: a.condition || "good",
        condition_notes: a.condition_notes || "",
        specs: a.specs || {},
        tags: a.tags || [],
        price: d.price || (mid ? String(mid) : ""),
        price_min_suggested: a.price_min ? String(a.price_min) : "",
        price_max_suggested: a.price_max ? String(a.price_max) : "",
        price_note: a.price_note || "",
        worth_listing: a.worth_listing ?? null,
        warning: a.recalled_or_prohibited || null,
      });
      setStep("details");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  // ---------- save ----------
  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    try {
      // resolve location by code if typed
      let location_id: string | null = d.location_id || null;
      if (!location_id && d.location_code.trim() && staff) {
        const code = d.location_code.trim().toUpperCase();
        const { data: existing } = await supabase.from("locations").select("id").eq("code", code).maybeSingle();
        if (existing) location_id = existing.id;
        else {
          const { data: created, error: locErr } = await supabase.from("locations").insert({ code }).select("id").single();
          if (locErr) throw locErr;
          location_id = created.id;
        }
      }

      let status: Item["status"];
      if (!publish) status = "draft";
      else if (staff) status = "active";
      else status = "pending_review";

      const row = {
        owner_id: item?.owner_id || profile.id,
        created_by: profile.id,
        title: d.title.trim(),
        description: d.description.trim(),
        brand: d.brand || null,
        model: d.model || null,
        category_id: d.category_id || null,
        condition: d.condition || null,
        condition_notes: d.condition_notes || null,
        specs: d.specs,
        tags: d.tags,
        price: d.price ? Number(d.price) : null,
        price_min_suggested: d.price_min_suggested ? Number(d.price_min_suggested) : null,
        price_max_suggested: d.price_max_suggested ? Number(d.price_max_suggested) : null,
        cost: d.cost ? Number(d.cost) : 0,
        quantity: Number(d.quantity) || 1,
        location_id,
        tier: d.tier,
        commission_pct: d.commission_pct ? Number(d.commission_pct) : null,
        tested: d.tested,
        serviced: d.serviced,
        service_notes: d.service_notes || null,
        shipping_ok: d.shipping_ok,
        local_pickup_ok: d.local_pickup_ok,
        weight_lbs: d.weight_lbs ? Number(d.weight_lbs) : null,
        ai_generated: d.worth_listing !== null || item?.ai_generated || false,
        status,
        listed_at: status === "active" ? new Date().toISOString() : item?.listed_at || null,
      };

      let itemId = item?.id;
      if (mode === "new") {
        const { data, error } = await supabase.from("items").insert(row).select("id").single();
        if (error) throw error;
        itemId = data.id;
      } else {
        const { error } = await supabase.from("items").update(row).eq("id", itemId!);
        if (error) throw error;
      }

      // sync photos
      const keep = photos.filter((p) => p.storage_path);
      const existingIds = new Set((initialPhotos || []).map((p) => p.id));
      const removed = (initialPhotos || []).filter((p) => !keep.some((k) => k.id === p.id));
      if (removed.length) {
        await supabase.from("item_photos").delete().in("id", removed.map((p) => p.id));
        await supabase.storage.from("item-photos").remove(removed.map((p) => p.storage_path));
      }
      const upserts = keep.map((p, i) => ({
        ...(existingIds.has(p.id) ? { id: p.id } : {}),
        item_id: itemId!,
        storage_path: p.storage_path!,
        url: p.url,
        sort_order: i,
        is_primary: i === 0,
      }));
      if (upserts.length) {
        const { error: phErr } = await supabase.from("item_photos").upsert(upserts);
        if (phErr) throw phErr;
      }

      router.push(`/app/items/${itemId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const uploading = photos.some((p) => p.uploading);
  const topCats = categories.filter((c) => !c.parent_id);
  const childCats = (pid: string) => categories.filter((c) => c.parent_id === pid);

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold">{mode === "new" ? "Add item" : "Edit item"}</h1>

      {/* PHOTOS */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Photos {photos.length ? `(${photos.length})` : ""}</h2>
          <span className="text-xs muted">First photo is the cover. Tap a photo to make it first.</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden" style={{ background: "var(--line)" }}>
              <button type="button" onClick={() => makePrimary(p.id)} className="w-full h-full">
                <img src={p.url} alt="" className={`w-full h-full object-cover ${p.uploading ? "opacity-50" : ""}`} />
              </button>
              {i === 0 && <span className="absolute left-1 top-1 pill pill-active">Cover</span>}
              <button type="button" onClick={() => removePhoto(p.id)} className="absolute right-1 top-1 w-7 h-7 rounded-full text-white text-sm" style={{ background: "rgba(0,0,0,.6)" }} aria-label="Remove">×</button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold" style={{ borderColor: "var(--line)" }}>
            <span className="text-2xl">📷</span>
            Add photo
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

        {step === "photos" && (
          <>
            <div>
              <label className="label">Anything the photos don&apos;t show? (optional)</label>
              <input className="input" placeholder="e.g. tested, works great, new belt, missing remote" value={hints} onChange={(e) => setHints(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary w-full" disabled={aiBusy || uploading || !photos.length} onClick={runAi}>
              {aiBusy ? "Reading the photos…" : uploading ? "Uploading…" : "✨ Write the listing for me"}
            </button>
            <button type="button" className="btn btn-secondary w-full" onClick={() => setStep("details")}>I&apos;ll type it myself</button>
          </>
        )}
        {step === "details" && mode === "new" && (
          <button type="button" className="btn btn-secondary w-full" disabled={aiBusy || uploading || !photos.length} onClick={runAi}>
            {aiBusy ? "Reading the photos…" : "✨ Re-run AI on these photos"}
          </button>
        )}
      </section>

      {step === "details" && (
        <>
          {d.warning && <div className="card p-3 text-sm" style={{ borderColor: "var(--danger)" }}>⚠️ {d.warning}</div>}
          {d.worth_listing === false && <div className="card p-3 text-sm" style={{ borderColor: "var(--accent)" }}>AI thinks this is probably worth under $10 on its own. Consider adding it to a lot instead.</div>}

          <section className="card p-4 space-y-3">
            <div><label className="label">Title</label><input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} /></div>
            <div><label className="label">Description</label><textarea className="input" rows={6} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Brand</label><input className="input" value={d.brand} onChange={(e) => set({ brand: e.target.value })} /></div>
              <div><label className="label">Model</label><input className="input" value={d.model} onChange={(e) => set({ model: e.target.value })} /></div>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={d.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                <option value="">Choose…</option>
                {topCats.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    <option value={c.id}>{c.name} (general)</option>
                    {childCats(c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Condition</label>
                <select className="input" value={d.condition} onChange={(e) => set({ condition: e.target.value })}>
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Quantity</label><input className="input" type="number" min={1} value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} /></div>
            </div>
            <div><label className="label">Condition notes</label><input className="input" value={d.condition_notes} onChange={(e) => set({ condition_notes: e.target.value })} placeholder="scuffs, missing cord, etc." /></div>
            <div>
              <label className="label">Specs</label>
              <div className="space-y-1">
                {Object.entries(d.specs).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <input className="input" value={k} readOnly />
                    <input className="input" value={v} onChange={(e) => set({ specs: { ...d.specs, [k]: e.target.value } })} />
                    <button type="button" className="btn btn-secondary" onClick={() => { const s = { ...d.specs }; delete s[k]; set({ specs: s }); }}>×</button>
                  </div>
                ))}
                <button type="button" className="text-sm underline" onClick={() => { const k = prompt("Spec name (e.g. Dimensions)"); if (k) set({ specs: { ...d.specs, [k]: "" } }); }}>+ add spec</button>
              </div>
            </div>
            <div><label className="label">Search tags (comma separated)</label><input className="input" value={d.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
          </section>

          <section className="card p-4 space-y-3">
            <h2 className="font-semibold">Price</h2>
            {(d.price_min_suggested || d.price_max_suggested) && (
              <p className="text-sm muted">AI suggests <b>${d.price_min_suggested} – ${d.price_max_suggested}</b>. {d.price_note}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Asking price $</label><input className="input" type="number" inputMode="decimal" step="0.01" value={d.price} onChange={(e) => set({ price: e.target.value })} /></div>
              {staff && <div><label className="label">Your cost $</label><input className="input" type="number" inputMode="decimal" step="0.01" value={d.cost} onChange={(e) => set({ cost: e.target.value })} /></div>}
            </div>
          </section>

          <section className="card p-4 space-y-3">
            <h2 className="font-semibold">Where is it &amp; how it ships</h2>
            {staff && (
              <div>
                <label className="label">Bin / pallet / shelf code</label>
                {locations.length > 0 && (
                  <select className="input mb-1" value={d.location_id} onChange={(e) => set({ location_id: e.target.value })}>
                    <option value="">Pick existing…</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.code}{l.description ? ` – ${l.description}` : ""}</option>)}
                  </select>
                )}
                <input className="input" placeholder="…or type a new code, e.g. G-114" value={d.location_code} onChange={(e) => set({ location_code: e.target.value, location_id: "" })} />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.local_pickup_ok} onChange={(e) => set({ local_pickup_ok: e.target.checked })} /> Local pickup</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.shipping_ok} onChange={(e) => set({ shipping_ok: e.target.checked })} /> Will ship</label>
            </div>
            {d.shipping_ok && <div><label className="label">Weight (lbs)</label><input className="input" type="number" inputMode="decimal" value={d.weight_lbs} onChange={(e) => set({ weight_lbs: e.target.value })} /></div>}
          </section>

          <section className="card p-4 space-y-3">
            <h2 className="font-semibold">Tested &amp; serviced</h2>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.tested} onChange={(e) => set({ tested: e.target.checked })} /> Tested, works</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.serviced} onChange={(e) => set({ serviced: e.target.checked })} /> Serviced</label>
            </div>
            {d.serviced && <input className="input" placeholder="What was done: new belt, cleaned heads, lubed, DeoxIT…" value={d.service_notes} onChange={(e) => set({ service_notes: e.target.value })} />}
          </section>

          {staff && (
            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">Ownership</h2>
              <select className="input" value={d.tier} onChange={(e) => set({ tier: e.target.value as Tier })}>
                {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {d.tier !== "owned" && (
                <div><label className="label">Commission % override (blank = tier default)</label><input className="input" type="number" inputMode="decimal" value={d.commission_pct} onChange={(e) => set({ commission_pct: e.target.value })} /></div>
              )}
            </section>
          )}
        </>
      )}

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      {step === "details" && (
        <div className="fixed bottom-0 inset-x-0 p-3 border-t no-print" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="max-w-3xl mx-auto flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" disabled={saving || uploading} onClick={() => save(false)}>Save draft</button>
            <button type="button" className="btn btn-primary flex-1" disabled={saving || uploading || !d.title} onClick={() => save(true)}>
              {saving ? "Saving…" : staff ? "Save & list" : "Submit for review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
