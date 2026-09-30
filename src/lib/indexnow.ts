/** IndexNow: tell Bing/Yandex/DuckDuckGo/Seznam about new or changed pages. Key file lives in /public. Free, no account. */
export const INDEXNOW_KEY = "32dca0837eb21cc9ae1965c58b74043c";

export async function indexNow(paths: string[]) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const host = new URL(site).host;
  const urlList = paths.map((p) => (p.startsWith("http") ? p : site + p)).slice(0, 10000);
  if (!urlList.length) return;
  try {
    await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* best effort */ }
}
