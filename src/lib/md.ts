import { marked } from "marked";

/** Markdown → HTML for staff-written blog posts. Community posts are plain text (rendered with line breaks, never as HTML). */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export const BOARDS: { key: string; label: string; blurb: string }[] = [
  { key: "finds", label: "What I found", blurb: "Show off the haul. Estate sales, auctions, curbside, the works." },
  { key: "worth", label: "What's it worth?", blurb: "Post a photo, get opinions before you price it." },
  { key: "questions", label: "Questions", blurb: "How do I…? Anything about selling, shipping, fixing." },
  { key: "tips", label: "Tips & tricks", blurb: "What's working for you. Photos, pricing, which sites." },
  { key: "general", label: "General", blurb: "Everything else." },
];
