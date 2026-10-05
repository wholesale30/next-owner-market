import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteFooter from "./SiteFooter";

export const metadata: Metadata = {
  title: { default: "Next Owner Market", template: "%s · Next Owner Market" },
  description: "Surplus, vintage audio, tools, and more. Find its next owner.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Next Owner", statusBarStyle: "default" },
  verification: { google: "6GHBgjvXekKj7yRXQa5Erseo1K8W6K7v89Fk8J4oLnE" },
  alternates: { types: { "application/rss+xml": [{ url: "/feed/items.xml", title: "New items" }, { url: "/feed/valued.xml", title: "What things are worth" }, { url: "/feed/blog.xml", title: "Blog" }] } },
};

export const viewport: Viewport = {
  themeColor: "#1f6f5c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}<SiteFooter /></body>
    </html>
  );
}
