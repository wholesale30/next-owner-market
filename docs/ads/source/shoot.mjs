import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const [mode, out] = [process.argv[2], process.argv[3]];
const exe = process.env.CHROME;
const b = await chromium.launch({ executablePath: exe });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.goto("file://" + process.cwd() + "/ad.html");
await pg.evaluate(() => document.fonts.ready);
await pg.waitForTimeout(500);
mkdirSync(out, { recursive: true });
if (mode === "preview") {
  for (const t of [1.5, 4.5, 7.0, 8.3, 12.0, 15.5, 17.5, 20.8, 25.0]) { await pg.evaluate((t) => window.render(t), t); await pg.screenshot({ path: `${out}/t${String(t).replace(".", "_")}.png` }); }
} else {
  const fps = 30, T = await pg.evaluate(() => window.T);
  for (let i = 0; i < Math.round(T * fps); i++) { await pg.evaluate((t) => window.render(t), i / fps); await pg.screenshot({ path: `${out}/f${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 }); }
}
await b.close();
