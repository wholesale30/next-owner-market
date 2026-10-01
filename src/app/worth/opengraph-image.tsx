import { shareCard } from "@/lib/og";
export const runtime = "nodejs"; export const size = { width: 1200, height: 630 }; export const contentType = "image/png"; export const alt = "What's it worth?";
export default function Image() { return shareCard({ title: "Take a photo. Find out what it's worth and where to sell it.", big: "What's it worth?", sub: "Free · 30 seconds · no listing needed" }); }
