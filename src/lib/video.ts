// Turn a pasted video link into something embeddable.
export function embedFor(url: string): { type: "iframe" | "video"; src: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return { type: "iframe", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname.startsWith("/shorts/")) return { type: "iframe", src: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
      const v = u.searchParams.get("v");
      if (v) return { type: "iframe", src: `https://www.youtube.com/embed/${v}` };
    }
    if (host === "facebook.com" || host === "fb.watch") return { type: "iframe", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false` };
    if (host === "vimeo.com") return { type: "iframe", src: `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}` };
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(u.pathname)) return { type: "video", src: u.toString() };
    return null;
  } catch {
    return null;
  }
}
