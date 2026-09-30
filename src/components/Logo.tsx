/** Brand mark: a price tag handing off to the right (the "next owner"). Inline SVG so it inherits color. */
export function LogoMark({ size = 32, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 14a6 6 0 0 1 6-6h17.5a6 6 0 0 1 4.24 1.76L54 28l-18 18L14.5 24.5A6 6 0 0 1 12.8 20.3L8 14z" fill={color} opacity=".18" />
      <path d="M10 12a4 4 0 0 1 4-4h16.3a6 6 0 0 1 4.25 1.76L52 27.2 34.2 45 11.76 22.55A6 6 0 0 1 10 18.3V12z" stroke={color} strokeWidth="4.5" strokeLinejoin="round" />
      <circle cx="21" cy="19" r="4" fill={color} />
      <path d="M30 54h24m0 0-7-7m7 7-7 7" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 leading-none">
      <LogoMark size={compact ? 30 : 36} />
      <span className="flex flex-col">
        <span className="font-extrabold tracking-tight whitespace-nowrap" style={{ fontSize: compact ? 16 : 17 }}>Next Owner</span>
        {!compact && <span className="hidden min-[400px]:block text-[11px] font-semibold uppercase tracking-[0.18em] opacity-90">Market</span>}
      </span>
    </span>
  );
}
