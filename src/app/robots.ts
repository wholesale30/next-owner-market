import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/app/", "/account", "/account/", "/api/", "/login", "/signup", "/reset", "/forgot", "/unsubscribe"] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
