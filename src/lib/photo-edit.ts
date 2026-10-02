/**
 * Photo touch-ups that run on the phone (free, no per-photo fee, nothing leaves the device until saved).
 *  - fixLight: brightens dull/dark photos, stretches contrast, a little more color (the "dusty, dull" look).
 *  - removeSpecks: finds small isolated specks (dust, lint, crumbs) and fills them from the surface around them.
 *    Lines and lettering are left alone (they aren't isolated), so labels and model numbers stay readable.
 *  - rotate: quarter turn.
 * It does NOT repaint the item: scratches, chips and stains stay, so photos stay honest.
 */

export async function toCanvas(src: Blob | string, maxSide = 1600): Promise<HTMLCanvasElement> {
  const blob = typeof src === "string" ? await (await fetch(src, { mode: "cors" })).blob() : src;
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

export function toBlob(c: HTMLCanvasElement, q = 0.88): Promise<Blob> {
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", q));
}

export function rotate(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = document.createElement("canvas");
  o.width = c.height; o.height = c.width;
  const x = o.getContext("2d")!;
  x.translate(o.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
  return o;
}

const lum = (d: Uint8ClampedArray, i: number) => (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;

/** Auto light: gentle contrast stretch (never crushes dark items to black), lifts dark photos, +6% color. */
export function fixLight(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, n = d.length / 4;
  const hist = new Uint32Array(256);
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) { const l = lum(d, i) | 0; hist[l]++; sum += l; }
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.005) break; }
  acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.005) break; }
  lo = Math.min(lo, 18); hi = Math.max(hi, 215); // small, safe stretch only
  const mean = sum / n;
  const gamma = mean < 90 ? 0.82 : mean < 120 ? 0.92 : 1;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const st = 255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / Math.max(1, hi - lo))), gamma);
    lut[v] = v * 0.35 + st * 0.65;
  }
  for (let i = 0; i < d.length; i += 4) {
    const r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]];
    const m = (r + g + b) / 3;
    d[i] = m + (r - m) * 1.06; d[i + 1] = m + (g - m) * 1.06; d[i + 2] = m + (b - m) * 1.06;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Sum-table over a w*h grid. */
function integral(src: Float32Array | Uint8Array, w: number, h: number) {
  const t = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += src[y * w + x]; t[(y + 1) * (w + 1) + x + 1] = t[y * (w + 1) + x + 1] + row; }
  }
  return t;
}
function boxSum(t: Float64Array, w: number, h: number, x: number, y: number, r: number) {
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
  const W = w + 1;
  return { s: t[y1 * W + x1] - t[y0 * W + x1] - t[y1 * W + x0] + t[y0 * W + x0], n: (x1 - x0) * (y1 - y0) };
}

/** Brightness median over a (2r+1) square, 64 levels (Huang sliding histogram). */
function median(L: Uint8Array, w: number, h: number, r: number) {
  const out = new Uint8Array(w * h), half = ((2 * r + 1) * (2 * r + 1)) >> 1;
  const hist = new Int32Array(64);
  for (let y = 0; y < h; y++) {
    hist.fill(0);
    let cnt = 0;
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    const col = (x: number, s: number) => { if (x < 0 || x >= w) return; for (let yy = y0; yy <= y1; yy++) { hist[L[yy * w + x] >> 2] += s; cnt += s; } };
    for (let x = -r; x <= r; x++) col(x, 1);
    for (let x = 0; x < w; x++) {
      const want = Math.min(half, cnt >> 1);
      let k = 0, a = 0;
      while (k < 63 && a + hist[k] <= want) { a += hist[k]; k++; }
      out[y * w + x] = (k << 2) + 2;
      col(x - r, -1); col(x + r + 1, 1);
    }
  }
  return out;
}

/** Removes small specks (dust, lint, crumbs). Letters, lines, buttons and lights are bigger than a speck, so they stay. */
export function removeSpecks(c: HTMLCanvasElement): { canvas: HTMLCanvasElement; specks: number } {
  const w = c.width, h = c.height, N = w * h;
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const L = new Uint8Array(N);
  for (let p = 0; p < N; p++) L[p] = lum(d, p * 4);
  const r = Math.max(3, Math.round(Math.max(w, h) / 450)); // ~4px at 1600
  const M = median(L, w, h, r);
  const mask = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (Math.abs(L[p] - M[p]) > 16) mask[p] = 1;
  // keep only small blobs (specks); anything longer or bigger is part of the item
  const maxSide = 3 * r + 3, maxArea = maxSide * maxSide;
  const small = 2 * r + 2;
  const seen = new Uint8Array(N), speck = new Uint8Array(N), stack = new Int32Array(N);
  type Blob_ = { px: number[]; x0: number; x1: number; y0: number; y1: number };
  const cands: Blob_[] = [];
  const marks: Blob_[] = []; // every mark up to letter size, for the lettering guard
  for (let p0 = 0; p0 < N; p0++) {
    if (!mask[p0] || seen[p0]) continue;
    let sp = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, big = false;
    const px: number[] = [];
    stack[sp++] = p0; seen[p0] = 1;
    while (sp) {
      const p = stack[--sp]; const x = p % w, y = (p / w) | 0;
      if (!big) { px.push(p); if (px.length > maxArea * 6) big = true; }
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (!big && bw <= maxSide * 4 && bh <= maxSide * 4) marks.push({ px: [], x0, x1, y0, y1 });
    if (big || bw > maxSide || bh > maxSide || px.length > maxArea) continue;
    // bigger than a single speck: only if it's a solid round-ish clump, not a thin letter shape
    if ((bw > small || bh > small) && px.length < bw * bh * 0.5) continue;
    // the ring around it must be plain surface (not the edge of a letter, button or light)
    let n = 0, s1 = 0, s2 = 0;
    for (let y = Math.max(0, y0 - 3); y <= Math.min(h - 1, y1 + 3); y++) for (let x = Math.max(0, x0 - 3); x <= Math.min(w - 1, x1 + 3); x++) {
      if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1) continue;
      const q = y * w + x; if (mask[q]) continue;
      n++; s1 += L[q]; s2 += L[q] * L[q];
    }
    if (n < 8) continue;
    const sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2));
    if (sd > 10) continue;
    cands.push({ px, x0, x1, y0, y1 });
  }
  // lettering guard: marks of similar height lined up side by side (model numbers, serials, small print) stay
  const cell = 24, grid = new Map<number, number[]>();
  const key = (gx: number, gy: number) => gy * 100000 + gx;
  marks.forEach((b, i) => { const k = key(((b.x0 + b.x1) / 2 / cell) | 0, ((b.y0 + b.y1) / 2 / cell) | 0); const a = grid.get(k); if (a) a.push(i); else grid.set(k, [i]); });
  let specks = 0;
  cands.forEach((b) => {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
    let row = 0;
    const gx = (cx / cell) | 0, gy = (cy / cell) | 0;
    for (let yy = gy - 1; yy <= gy + 1 && row < 2; yy++) for (let xx = gx - 2; xx <= gx + 2 && row < 2; xx++) {
      for (const j of grid.get(key(xx, yy)) || []) {
        const o = marks[j];
        if (o.x0 === b.x0 && o.y0 === b.y0 && o.x1 === b.x1) continue;
        const oh = o.y1 - o.y0 + 1;
        const ocy = (o.y0 + o.y1) / 2;
        const gap = Math.max(o.x0 - b.x1, b.x0 - o.x1);
        if (Math.abs(ocy - cy) <= Math.max(bh, oh) * 0.3 && gap >= 0 && gap <= Math.max(bw, bh) * 1.5 + 2 && oh / bh > 0.6 && oh / bh < 2.2 && bh >= 4) row++;
        if (row >= 2) break;
      }
    }
    if (row >= 2) return;
    for (const p of b.px) speck[p] = 1;
    specks++;
  });
  if (!specks) return { canvas: c, specks: 0 };
  // fill each speck (plus a 1px halo) from nearby clean pixels, matched to the median brightness
  const fill = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (speck[p]) {
    const x = p % w, y = (p / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) fill[yy * w + xx] = 1; }
  }
  const good = new Uint8Array(N), R0 = new Float32Array(N), G0 = new Float32Array(N), B0 = new Float32Array(N);
  for (let p = 0; p < N; p++) if (!fill[p] && !mask[p]) { good[p] = 1; R0[p] = d[p * 4]; G0[p] = d[p * 4 + 1]; B0[p] = d[p * 4 + 2]; }
  const tG = integral(good, w, h), tR = integral(R0, w, h), tGg = integral(G0, w, h), tB = integral(B0, w, h);
  for (let p = 0; p < N; p++) if (fill[p]) {
    const x = p % w, y = (p / w) | 0;
    let k = r, g = boxSum(tG, w, h, x, y, k).s;
    while (g < 6 && k < r * 8) { k *= 2; g = boxSum(tG, w, h, x, y, k).s; }
    if (g < 1) continue;
    d[p * 4] = boxSum(tR, w, h, x, y, k).s / g;
    d[p * 4 + 1] = boxSum(tGg, w, h, x, y, k).s / g;
    d[p * 4 + 2] = boxSum(tB, w, h, x, y, k).s / g;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, specks };
}

/** One tap: light + dust. Used by the batch option and "✨ Do it all". */
export async function touchUp(src: Blob | string, maxSide = 1600): Promise<Blob> {
  const c = await toCanvas(src, maxSide);
  removeSpecks(c); removeSpecks(c); // second pass catches dust that was clumped
  fixLight(c);
  return toBlob(c);
}
