import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, ExternalHyperlink, AlignmentType, BorderStyle } from "docx";
import sharp from "sharp";
import type { DeepReport, QA } from "@/lib/deepcheck";

/** 🔬 The saved Advanced What's it worth report as a Word white paper (owner, Oct 26, 2026). */
const money = (n: number | null | undefined) => (n ? `$${Math.round(n).toLocaleString()}` : "—");
const p = (text: string, o: { bold?: boolean; size?: number; italics?: boolean } = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold: o.bold, size: o.size, italics: o.italics })] });
const h1 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 } });
const h2 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } });
const bullet = (t: string) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 60 } });
const linkPara = (title: string, url: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: title || url, style: "Hyperlink" })] })] });
const border = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const cell = (t: string, bold = false) => new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t, bold })] })] });
const table = (rows: string[][], head = true) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((r, i) => new TableRow({ children: r.map((t) => cell(t, head && i === 0)) })) });

async function photo(url: string): Promise<ImageRun | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const img = sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: 900, height: 900, fit: "inside" }).jpeg({ quality: 80 });
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    const w = 300, h = Math.round((info.height / info.width) * w);
    return new ImageRun({ type: "jpg", data, transformation: { width: w, height: h } });
  } catch { return null; }
}

export async function deepDocx(x: { report: DeepReport; qa: QA[]; notes: string | null; photoUrls: string[]; createdAt: string }): Promise<Buffer> {
  const r = x.report;
  const kids: (Paragraph | Table)[] = [];
  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: r.what })] }));
  kids.push(p(`Next Owner Market · Advanced What's it worth · ${new Date(x.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })}${r.era ? ` · Made ${r.era}` : ""}`, { italics: true }));
  const pics = (await Promise.all(x.photoUrls.slice(0, 2).map(photo))).filter(Boolean) as ImageRun[];
  if (pics.length) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: pics.flatMap((im, i) => (i ? [new TextRun("  "), im] : [im])) }));
  kids.push(new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: `Expected price: ${money(r.expected_price)}`, bold: true, size: 36 })] }));
  kids.push(p(`List price ${money(r.list_price)} · Fast price ${money(r.fast_price)} · Top ${money(r.top_price)}${r.hold ? " · Worth holding for top dollar" : ""}`, { bold: true }));
  kids.push(p(r.summary));
  if (x.notes) kids.push(p(`Owner's notes: ${x.notes}`, { italics: true }));

  kids.push(h1("1. What it's worth"));
  kids.push(table([["Price", "Amount"], ["Expected (as described)", money(r.expected_price)], ["List price (price box)", money(r.list_price)], ["Fast sale", money(r.fast_price)], ["Top dollar", money(r.top_price)], ["New / original retail", money(r.retail_new)], ["For parts / not working", money(r.parts_value)], ["Scrap", money(r.scrap_value)], ["Weight", r.item_lbs ? `${r.item_lbs} lb` : "—"], ["Shipping weight and box", r.ship_lbs ? `${r.ship_lbs} lb${r.box_l && r.box_w && r.box_h ? ` in a ${r.box_l} x ${r.box_w} x ${r.box_h} in box` : ""}` : "—"]]));
  kids.push(p(r.value_why));
  if (r.comps.length) {
    kids.push(h2("Comparable prices found"));
    kids.push(table([["Where", "What", "Price", "Sold?"], ...r.comps.map((c) => [c.where, c.what, money(c.price), c.sold ? "Sold" : "Asking"])]));
    for (const c of r.comps.filter((c) => c.url)) kids.push(linkPara(`${c.where}: ${c.what} (${money(c.price)})`, c.url!));
  }
  if (r.who_buys.length) { kids.push(h2("Who buys it")); r.who_buys.forEach((t) => kids.push(bullet(t))); }
  if (r.alternate_uses.length) { kids.push(h2("Parts and other uses")); r.alternate_uses.forEach((t) => kids.push(bullet(t))); }

  if (r.specs.length) { kids.push(h1("2. Specs")); kids.push(table([["Spec", "Value"], ...r.specs.map((s) => [s.label, s.value])])); }

  kids.push(h1("3. How to test it"));
  if (r.safety.length) { kids.push(h2("Safety first")); r.safety.forEach((t) => kids.push(bullet(t))); }
  if (r.tools_needed.length) { kids.push(h2("Tools you need")); r.tools_needed.forEach((t) => kids.push(bullet(t))); }
  kids.push(h2("Test steps, in order"));
  r.test_steps.forEach((s, i) => {
    kids.push(p(`Step ${i + 1}. ${s.title}`, { bold: true }));
    kids.push(p(s.how));
    kids.push(p(`Good: ${s.good}`));
    kids.push(p(`Problem: ${s.bad}`));
  });
  if (r.check_before_listing.length) { kids.push(h2("Check these before you price it")); r.check_before_listing.forEach((t) => kids.push(bullet(t))); }

  if (r.common_faults.length) {
    kids.push(h1("4. Known problems and fixes"));
    kids.push(table([["Problem", "Signs", "Fix", "Rough cost"], ...r.common_faults.map((f) => [f.fault, f.signs, f.fix, f.cost])]));
    if (r.value_after_fix) kids.push(p(r.value_after_fix));
  }
  if (r.manuals.length || r.parts_sources.length) {
    kids.push(h1("5. Manuals and parts"));
    r.manuals.forEach((m) => kids.push(linkPara(m.title, m.url!)));
    r.parts_sources.forEach((s) => kids.push(s.url ? linkPara(`${s.part}: ${s.where}`, s.url) : bullet(`${s.part}: ${s.where}`)));
  }

  kids.push(h1("6. Ready-to-paste listing"));
  kids.push(p(`Title: ${r.listing_title}`, { bold: true }));
  kids.push(p(`Price box: ${money(r.list_price)}`, { bold: true }));
  r.listing_description.split(/\n+/).forEach((t) => kids.push(p(t)));
  if (r.listing_keywords.length) kids.push(p(`Keywords: ${r.listing_keywords.join(", ")}`));
  kids.push(p(`Shipping: ${r.ship_or_pickup}`));

  if (x.qa.length) {
    kids.push(h1("7. Questions and answers"));
    for (const q of x.qa) {
      kids.push(p(`Q: ${q.q}`, { bold: true }));
      q.a.split(/\n+/).forEach((t) => kids.push(p(t)));
      q.links.forEach((l) => kids.push(linkPara(l.title, l.url!)));
    }
  }
  if (r.sources.length) { kids.push(h1("Sources")); r.sources.forEach((s) => kids.push(linkPara(s.title, s.url!))); }
  kids.push(p(`Prices come from ${r.searches} live web searches on ${r.checked_at.slice(0, 10)}. Test steps are general guidance: unplug and discharge before opening anything, and stop if something smells hot or smokes.`, { italics: true, size: 18 }));

  const doc = new Document({ creator: "Next Owner Market", title: r.what, styles: { default: { document: { run: { font: "Calibri", size: 22 } } } }, sections: [{ children: kids }] });
  return Packer.toBuffer(doc);
}
