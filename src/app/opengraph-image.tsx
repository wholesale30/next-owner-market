import { shareCard } from "@/lib/og";
export const runtime = "nodejs"; export const size = { width: 1200, height: 630 }; export const contentType = "image/png"; export const alt = "Next Owner Market";
export default function Image() { return shareCard({ title: "Photograph the pile. Get the listings. Get paid.", big: "Next Owner Market", sub: "Sell anywhere. Buy safe. Money held until you have it." }); }
