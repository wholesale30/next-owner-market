export function rss(title: string, link: string, desc: string, items: { title: string; link: string; desc: string; date: string; image?: string | null }[]) {
  const esc = (s: string) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>${esc(title)}</title><link>${link}</link><description>${esc(desc)}</description><atom:link href="${link}" rel="self" type="application/rss+xml"/>
${items.map((i) => `<item><title>${esc(i.title)}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>${new Date(i.date).toUTCString()}</pubDate><description>${esc(i.desc)}</description>${i.image ? `<media:content url="${esc(i.image)}" medium="image"/>` : ""}</item>`).join("\n")}
</channel></rss>`;
}
