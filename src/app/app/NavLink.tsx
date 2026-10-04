"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Menu link that always works: tapping the page you're already on (like ➕ Add while a half-filled
 * or stuck form is open) starts it fresh instead of doing nothing.
 */
export default function NavLink({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const path = usePathname();
  const same = path === href.split("?")[0];
  return (
    <Link href={href} className={className} style={style} onClick={(e) => { if (same) { e.preventDefault(); window.location.replace(href); } }}>
      {children}
    </Link>
  );
}
