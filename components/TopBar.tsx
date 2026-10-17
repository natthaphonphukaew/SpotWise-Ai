import Link from "next/link";
import type { ReactNode } from "react";

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink bg-paper">
      <div className="flex h-11 items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold whitespace-nowrap">
          SpotWise
          <sup className="ml-0.5 align-[6px] font-mono text-[9px] font-medium tracking-widest">AI</sup>
        </Link>
        <div className="flex min-w-0 gap-4 overflow-hidden font-mono text-[11px] whitespace-nowrap text-ink-2">{right}</div>
      </div>
    </header>
  );
}

export function Readout({ k, v, accent = false, className = "" }: { k: string; v: ReactNode; accent?: boolean; className?: string }) {
  return (
    <span className={className}>
      {k} <b className={`font-medium ${accent ? "text-accent" : "text-ink"}`}>{v}</b>
    </span>
  );
}
