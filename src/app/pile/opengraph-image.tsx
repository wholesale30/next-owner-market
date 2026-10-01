import { shareCard } from "@/lib/og";
export const runtime = "nodejs"; export const size = { width: 1200, height: 630 }; export const contentType = "image/png"; export const alt = "Sort the pile";
export default function Image() { return shareCard({ title: "Photograph a box. Know what to keep, sell, donate, or toss.", big: "Sort the pile", sub: "Free · lists the good ones in one tap" }); }
