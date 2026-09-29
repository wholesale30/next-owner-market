/**
 * Photo helpers that run in the browser: compress, and optional background cleanup.
 * Background removal uses an on-device model (no per-image fees). First run downloads ~40MB, then it's cached.
 */

export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
}

let removerPromise: Promise<typeof import("@imgly/background-removal")> | null = null;
function loadRemover() {
  if (!removerPromise) removerPromise = import("@imgly/background-removal");
  return removerPromise;
}

/** Warm the model download early (call on page load when the user has cleanup turned on). */
export function preloadBackgroundModel() {
  loadRemover().then((m) => m.preload({ model: "isnet_quint8" })).catch(() => {});
}

/**
 * Cuts the subject out and places it on a solid background, with a little padding.
 * Falls back to the plain compressed photo if the model fails (bad signal, old phone).
 */
export async function cleanBackground(file: Blob, bg = "#ffffff", maxSide = 1600): Promise<{ blob: Blob; cleaned: boolean }> {
  const compressed = await compressImage(file, maxSide, 0.9);
  try {
    const { removeBackground } = await loadRemover();
    const cutout = await removeBackground(compressed, { model: "isnet_quint8", output: { format: "image/png", quality: 0.9 } });
    const bmp = await createImageBitmap(cutout);
    // trim transparent edges so the item fills the frame
    const probe = document.createElement("canvas");
    probe.width = bmp.width; probe.height = bmp.height;
    const pctx = probe.getContext("2d")!;
    pctx.drawImage(bmp, 0, 0);
    const data = pctx.getImageData(0, 0, probe.width, probe.height).data;
    let minX = probe.width, minY = probe.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < probe.height; y += 2) {
      for (let x = 0; x < probe.width; x += 2) {
        if (data[(y * probe.width + x) * 4 + 3] > 40) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    // if the mask is empty or absurdly small, the model didn't find a subject; keep the original
    if (!found || (maxX - minX) * (maxY - minY) < probe.width * probe.height * 0.02) return { blob: compressed, cleaned: false };
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(probe.width - sx, maxX - minX + pad * 2), sh = Math.min(probe.height - sy, maxY - minY + pad * 2);
    const side = Math.max(sw, sh);
    const out = document.createElement("canvas");
    out.width = side; out.height = side;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(probe, sx, sy, sw, sh, (side - sw) / 2, (side - sh) / 2, sw, sh);
    const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), "image/jpeg", 0.88));
    return { blob, cleaned: true };
  } catch {
    return { blob: compressed, cleaned: false };
  }
}
