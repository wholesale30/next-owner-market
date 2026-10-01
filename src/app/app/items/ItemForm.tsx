"use client";

import Mic from "@/components/Mic";

import { HelpTip } from "@/components/Help";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { embedFor } from "@/lib/video";
import type { Category, Item, ItemPhoto, ItemVideo, Location, Profile, Tier } from "@/lib/types";
import { CONDITION_LABELS, TIER_LABELS } from "@/lib/types";
import { money } from "@/lib/listing";
import { cleanBackground, compressImage, preloadBackgroundModel } from "@/lib/photo";
import { useEffect } from "react";

interface Props {
  mode: "new" | "edit";
  profile: Profile;
  categories: Category[];
  locations: Location[];
  item?: Item;
  photos?: ItemPhoto[];
  videos?: ItemVideo[];
  defaultLocationId?: string;
  photoBg?: string;
}

type Draft = {
  title: string;
  description: string;
  brand: string;
  model: string;
  category_id: string;
  year: string;
  mileage: string;
  vin: string;
  title_status: string;
  title_in_hand: boolean;
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
  shipping_price: string;
  shipping_mode: string;
  box: string;
  local_pickup_ok: boolean;
  weight_lbs: string;
  worth_listing: boolean | null;
  warning: string | null;
};

type LocalVideo = { id: string; kind: "upload" | "link"; url: string; storage_path?: string | null; uploading?: boolean };
type LocalPhoto = { id: string; file?: File; url: string; storage_path?: string; uploading?: boolean };

export default function ItemForm({ mode, profile, categories, locations, item, photos: initialPhotos, videos: initialVideos, defaultLocationId, photoBg = "#ffffff" }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const staff = profile.role === "admin" || profile.role === "staff";
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<LocalPhoto[]>(
    (initialPhotos || []).map((p) => ({ id: p.id, url: p.url, storage_path: p.storage_path }))
  );
  const [hints, setHints] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<LocalVideo[]>((initialVideos || []).map((v) => ({ id: v.id, kind: v.kind, url: v.url, storage_path: v.storage_path })));
  const [videoLink, setVideoLink] = useState("");
  const isPro = profile.role === "admin" || profile.role === "staff" || profile.plan === "pro";
  const videoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"photos" | "details">(mode === "edit" ? "details" : "photos");
  const [clean, setClean] = useState(false);
  useEffect(() => { if (clean) preloadBackgroundModel(); }, [clean]);

  const [d, setD] = useState<Draft>({
    title: item?.title || "",
    description: item?.description || "",
    brand: item?.brand || "",
    model: item?.model || "",
    category_id: item?.category_id || "",
    year: (item as unknown as { year?: number | null })?.year ? String((item as unknown as { year?: number }).year) : "",
    mileage: (item as unknown as { mileage?: number | null })?.mileage != null ? String((item as unknown as { mileage?: number }).mileage) : "",
    vin: (item as unknown as { vin?: string | null })?.vin || "",
    title_status: (item as unknown as { title_status?: string | null })?.title_status || "",
    title_in_hand: !!(item as unknown as { title_in_hand?: boolean })?.title_in_hand,
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
    shipping_price: item?.shipping_price != null ? String(item.shipping_price) : "0",
    shipping_mode: (item as unknown as { shipping_mode?: string })?.shipping_mode || "calculated",
    box: (item as unknown as { box?: string })?.box || "medium",
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
        const blob = clean ? (await cleanBackground(file, photoBg)).blob : await compressImage(file);
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

  // ---------- videos ----------
  async function addVideo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 50 * 1024 * 1024) return setError("Video is over 50 MB. Keep clips under about 60 seconds, or paste a YouTube link instead.");
    const tempId = crypto.randomUUID();
    setVideos((v) => [...v, { id: tempId, kind: "upload", url: URL.createObjectURL(file), uploading: true }]);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${profile.id}/video-${Date.now()}-${tempId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("item-photos").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
      setVideos((v) => v.map((x) => (x.id === tempId ? { ...x, url: data.publicUrl, storage_path: path, uploading: false } : x)));
    } catch (e) {
      setError(`Video upload failed: ${e instanceof Error ? e.message : String(e)}`);
      setVideos((v) => v.filter((x) => x.id !== tempId));
    }
  }
  function addVideoLink() {
    const url = videoLink.trim();
    if (!url) return;
    if (!embedFor(url)) return setError("That link isn't a video we can show. YouTube, Facebook, Vimeo, or a direct .mp4 link work.");
    setError(null);
    setVideos((v) => [...v, { id: crypto.randomUUID(), kind: "link", url, storage_path: null }]);
    setVideoLink("");
  }
  function removeVideo(id: string) {
    setVideos((v) => v.filter((x) => x.id !== id));
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
      if (res.status === 402) throw new Error(`${json.error} Go to Payouts → Upgrade to Pro.`);
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
        weight_lbs: a.weight_lbs ? String(a.weight_lbs) : d.weight_lbs,
        box: a.box && ["small", "medium", "large", "xl", "freight"].includes(a.box) ? a.box : d.box,
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
        year: d.year ? Number(d.year) : null,
        mileage: d.mileage ? Number(d.mileage) : null,
        vin: d.vin.trim() || null,
        title_status: d.title_status || null,
        title_in_hand: d.title_in_hand,
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
        shipping_price: d.shipping_ok && d.shipping_price ? Number(d.shipping_price) : 0,
        shipping_mode: d.shipping_mode,
        box: d.box,
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

      // sync videos
      const keepV = videos.filter((v) => !v.uploading);
      const existingV = new Set((initialVideos || []).map((v) => v.id));
      const removedV = (initialVideos || []).filter((v) => !keepV.some((k) => k.id === v.id));
      if (removedV.length) {
        await supabase.from("item_videos").delete().in("id", removedV.map((v) => v.id));
      }
      const vUpserts = keepV.map((v, i) => ({ ...(existingV.has(v.id) ? { id: v.id } : {}), item_id: itemId!, kind: v.kind, url: v.url, storage_path: v.storage_path || null, sort_order: i }));
      if (vUpserts.length) {
        const { error: vErr } = await supabase.from("item_videos").upsert(vUpserts);
        if (vErr) throw vErr;
      }

      if (mode === "edit" && item && (profile.role === "admin" || profile.role === "staff") && item.owner_id !== profile.id) {
        const changes: string[] = [];
        if (Number(item.price ?? 0) !== Number(d.price || 0)) changes.push(`price ${money(item.price)} → ${money(Number(d.price || 0))}`);
        if (item.title !== d.title) changes.push("title");
        if (item.description !== d.description) changes.push("description");
        if (changes.length) fetch("/api/alert/seller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, note: `Our staff edited your listing "${d.title}": ${changes.join(", ")}. This is part of our review so it sells faster; if you disagree, reply and we'll sort it out.` }) }).catch(() => {});
      }
      if (!isPro || profile.role === "consignor") fetch("/api/alert/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) }).catch(() => {});
      if (status === "active" && item?.sku) fetch("/api/indexnow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: [`/item/${item.sku}`] }) }).catch(() => {});
      router.push(`/app/items/${itemId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const uploading = photos.some((p) => p.uploading) || videos.some((v) => v.uploading);
  const topCats = categories.filter((c) => !c.parent_id);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const selCat = catById.get(d.category_id);
  const selParent = selCat?.parent_id ? catById.get(selCat.parent_id) : null;
  const isVehicle = !!selCat && (selCat.slug === "vehicles" || selParent?.slug === "vehicles");
  const vehicleSlug = selCat?.slug || "";
  const needsTitle = ["cars-trucks", "motorcycles", "boats", "rvs", "atvs"].includes(vehicleSlug);
  const childCats = (pid: string) => categories.filter((c) => c.parent_id === pid);

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold flex items-center gap-2">{mode === "new" ? "Add item" : "Edit item"} <HelpTip topic="add-item" /></h1>

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
          <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold" style={{ borderColor: "var(--brand)" }}>
            <span className="text-2xl">🖼</span>
            Upload photos
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold" style={{ borderColor: "var(--line)" }}>
            <span className="text-2xl">📷</span>
            Take a photo
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <label className="flex items-center gap-2 text-xs muted"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Clean background on new photos (studio look; off = your photo as-is)</label>

        {isPro && <div className="space-y-2">
          <h2 className="font-semibold">Video {videos.length ? `(${videos.length})` : ""} <span className="muted font-normal text-xs">optional; a clip of it working sells faster</span></h2>
          {videos.map((v) => (
            <div key={v.id} className="card p-2 flex items-center gap-2 text-sm">
              <span className="text-xl">🎬</span>
              <span className="truncate flex-1">{v.kind === "link" ? v.url : v.uploading ? "Uploading…" : "Uploaded clip"}</span>
              <button type="button" onClick={() => removeVideo(v.id)} className="pill" aria-label="Remove video">×</button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => videoRef.current?.click()}>🎬 Upload a clip</button>
            <div className="flex gap-1">
              <input className="input" placeholder="Paste YouTube/FB link" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} />
              <button type="button" className="btn btn-secondary" onClick={addVideoLink}>Add</button>
            </div>
          </div>
          <p className="text-[11px] muted">Clips up to 50 MB (about a minute from a phone). Longer videos: upload to YouTube and paste the link.</p>
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => { addVideo(e.target.files); e.target.value = ""; }} />
        </div>}
        {!isPro && <p className="text-xs muted">🎬 Video on listings is a Pro feature. Payouts → Upgrade to Pro.</p>}

        {step === "photos" && (
          <>
            <div>
              <label className="label">Anything the photos don&apos;t show? (optional)</label>
              <div className="space-y-1"><textarea className="input" rows={3} style={{ minHeight: 72, fieldSizing: "content" } as React.CSSProperties} placeholder="e.g. tested, works great, new belt, missing remote" value={hints} onChange={(e) => setHints(e.target.value)} /><Mic onText={(t) => setHints((h) => (h ? h.trimEnd() + " " : "") + t)} /></div>
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
            <div><div className="flex items-center justify-between"><label className="label">Description</label><Mic onText={(t) => set({ description: (d.description ? d.description.trimEnd() + " " : "") + t })} /></div><textarea className="input" rows={6} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
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
            {isVehicle && (
              <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)" }}>
                <p className="font-semibold text-sm">🚗 Vehicle details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Year</label><input className="input" inputMode="numeric" maxLength={4} value={d.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, "") })} /></div>
                  <div><label className="label">{/boat|rv|atv|equip|tractor/i.test(vehicleSlug) ? "Hours" : "Miles"}</label><input className="input" inputMode="numeric" value={d.mileage} onChange={(e) => set({ mileage: e.target.value.replace(/\D/g, "") })} /></div>
                </div>
                <div><label className="label">VIN / hull number / serial</label><input className="input" autoCapitalize="characters" value={d.vin} onChange={(e) => set({ vin: e.target.value.toUpperCase() })} /><p className="text-xs muted">Shown on the listing so buyers can run a history check. Skip for trailers or bikes if there isn&apos;t one.</p></div>
                {needsTitle && (
                  <>
                    <div><label className="label">Title</label><select className="input" value={d.title_status} onChange={(e) => set({ title_status: e.target.value })}><option value="">Pick one…</option><option value="clean">Clean title</option><option value="salvage">Salvage title</option><option value="rebuilt">Rebuilt title</option><option value="bill_of_sale_only">Bill of sale only</option><option value="none">No title</option></select></div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.title_in_hand} onChange={(e) => set({ title_in_hand: e.target.checked })} /> I have the title in my hand, in my name, with no lien</label>
                    <p className="text-xs muted">You can&apos;t list a car, truck, or motorcycle without the title in hand. Buyers put down a deposit through the site; you meet, they pay the balance, and the site prints the bill of sale for both of you to sign.</p>
                  </>
                )}
              </div>
            )}
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
            {d.shipping_ok && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Weight (lbs, packed)</label><input className="input" type="number" inputMode="decimal" value={d.weight_lbs} onChange={(e) => set({ weight_lbs: e.target.value })} /></div>
                  <div><label className="label">Box</label><select className="input" value={d.box} onChange={(e) => set({ box: e.target.value })}><option value="small">Small (shoebox)</option><option value="medium">Medium (microwave)</option><option value="large">Large (receiver)</option><option value="xl">XL (tower speaker)</option><option value="freight">Too big to ship</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Shipping</label><select className="input" value={d.shipping_mode === "free" ? "free" : "calculated"} onChange={(e) => set({ shipping_mode: e.target.value })}><option value="calculated">Buyer pays the rate for their ZIP (recommended)</option><option value="free">Free shipping (label cost comes out of your payout)</option></select></div>
                  {d.shipping_mode !== "free" && <div><label className="label">Estimate $ (shown only if live rates are down)</label><input className="input" type="number" inputMode="decimal" value={d.shipping_price} onChange={(e) => set({ shipping_price: e.target.value })} /></div>}
                </div>
                <p className="text-[11px] muted">Every shipped order ships with a label bought on the order page; that&apos;s how tracking, delivery, and your payout are handled. Weight and box set the rate, so use the packed weight.</p>
              </div>
            )}
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
