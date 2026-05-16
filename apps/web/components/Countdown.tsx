"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type CountdownSize = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<CountdownSize, string> = {
  sm: "text-sm font-semibold",
  md: "text-4xl font-extrabold tracking-tight",
  lg: "text-5xl font-extrabold tracking-tight sm:text-6xl",
  xl: "text-6xl font-extrabold tracking-tight sm:text-7xl md:text-8xl",
};

export function Countdown({
  target,
  onZero,
  size = "md",
  className,
}: {
  target: string | Date;
  onZero?: () => void;
  size?: CountdownSize;
  className?: string;
}) {
  const targetTs = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, targetTs - now);
  useEffect(() => {
    if (ms === 0 && onZero) onZero();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms === 0]);

  const base = cn("font-mono tabular-nums text-accent", sizeClass[size], className);

  if (ms === 0) {
    return <span className={cn(base, "text-accent-dark")}>00:00</span>;
  }

  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (d > 0) return <span className={base}>{d}d {h}h {m}m</span>;
  if (h > 0) {
    return (
      <span className={base}>
        {h}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      </span>
    );
  }
  return (
    <span className={base}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
