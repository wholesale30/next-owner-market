"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/md";

type P = { id: string; slug: string; title: string; excerpt: string; body: string; cover_url: string; published: boolean };

export default function PostEditor({ post, meId }: { post: P | null; meId: string }) {
  const router = useRouter();
  const sb = createClient();
  const [p, setP] = useState<P>(post || { id: "", slug: "", title: "", excerpt: "", body: "", cover_url: "", published: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function cover(f: File) {
    const path = `blog/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await sb.storage.from("item-photos").upload(path, f);
    if (error) return setMsg(error.message);
    setP({ ...p, cover_url: sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl });
  }
  async function save(publish?: boolean) {
    setBusy(true); setMsg(null);
    const slug = p.slug || slugify(p.title);
    const row = { slug, title: p.title.trim(), excerpt: p.excerpt || null, body: p.body, cover_url: p.cover_url || null, author_id: meId, published_at: (publish ?? p.published) ? new Date().toISOString() : null };
    const patch: Record<string, unknown> = { ...row };
    if (p.id && p.published && publish !== false) delete patch.published_at; // keep original publish date
    const r = p.id ? await sb.from("posts").update(patch).eq("id", p.id).select("id").single() : await sb.from("posts").insert(row).select("id").single();
    setBusy(false);
    if (r.error) return setMsg(r.error.message);
    setMsg(publish ? "Published." : "Saved.");
    if (!p.id) router.replace(`/app/blog/${r.data.id}`);
    setP({ ...p, id: r.data.id, slug, published: publish ?? p.published });
    router.refresh();
  }
  async function del() { if (!confirm("Delete this post?")) return; await sb.from("posts").delete().eq("id", p.id); router.push("/app/blog"); }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{p.id ? "Edit post" : "New post"}</h1>
      <div><label className="label">Title</label><input className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value, slug: p.id ? p.slug : slugify(e.target.value) })} /></div>
      <div><label className="label">Web address</label><div className="flex items-center gap-1 text-sm"><span className="muted">/blog/</span><input className="input" value={p.slug} onChange={(e) => setP({ ...p, slug: slugify(e.target.value) })} /></div></div>
      <div><label className="label">One-line summary (shows in the list and on Google)</label><input className="input" maxLength={200} value={p.excerpt} onChange={(e) => setP({ ...p, excerpt: e.target.value })} /></div>
      <div><label className="label">Cover photo</label>{p.cover_url && <img src={p.cover_url} alt="" className="w-full aspect-[2/1] object-cover rounded-xl mb-2" />}<input className="input" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && cover(e.target.files[0])} /></div>
      <div><label className="label">Post</label><textarea className="input font-mono text-sm" rows={18} value={p.body} onChange={(e) => setP({ ...p, body: e.target.value })} placeholder={"Write like you talk.\n\n## A heading\n\nA paragraph. **Bold** for emphasis.\n\n- a list\n- another"} /></div>
      {msg && <p className="text-sm">{msg}</p>}
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-secondary" disabled={busy || !p.title} onClick={() => save(false)}>Save draft</button>
        <button className="btn btn-primary" disabled={busy || !p.title || !p.body} onClick={() => save(true)}>{p.published ? "Update live post" : "Publish"}</button>
        {p.published && <a className="btn btn-secondary" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">View</a>}
        {p.id && <button className="btn btn-danger" disabled={busy} onClick={del}>Delete</button>}
      </div>
    </div>
  );
}
