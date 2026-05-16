"use client";

import { useEffect, useState } from "react";

export function Countdown({ target, onZero }: { target: string | Date; onZero?: () => void }) {
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
  if (ms === 0) return <span className="text-rose-600 font-mono">00:00</span>;
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return <span className="font-mono">{d}d {h}h {m}m</span>;
  if (h > 0) return <span className="font-mono">{h}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s</span>;
  return <span className="font-mono">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}
