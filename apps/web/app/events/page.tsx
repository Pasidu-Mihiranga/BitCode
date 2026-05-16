"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Countdown } from "@/components/Countdown";
import { formatLkr } from "@/lib/currency";

type Item = {
  id: string;
  name: string;
  unitPriceCents: number;
  stockQuantity: number;
  reservedStock: number;
  soldCount: number;
  available: number;
};
type Event = {
  id: string;
  name: string;
  coverPhotoUrl: string | null;
  goLiveAt: string;
  status: "locked" | "live" | "closed" | "sold_out";
  items: Item[];
};

function statusBadge(s: Event["status"]) {
  const cls =
    s === "live"
      ? "badge-live"
      : s === "locked"
      ? "badge-locked"
      : s === "sold_out"
      ? "badge-sold-out"
      : "badge-closed";
  return <span className={cls}>{s.replace("_", " ")}</span>;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ ok: true; events: Event[] }>("/api/events");
        setEvents(r.events);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-muted">Loading events…</p>;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <h1 className="page-title">Marketplace</h1>
        <p className="text-sm text-muted">{events.length} events</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="card-interactive overflow-hidden p-0"
          >
            <div className="media-well relative flex aspect-video items-center justify-center rounded-none rounded-t-2xl">
              {e.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.coverPhotoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {e.status === "locked" && (
                <div
                  className="relative z-10 flex flex-col items-center justify-center gap-1 px-4 text-center"
                  aria-live="polite"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Opens in
                  </span>
                  <Countdown target={e.goLiveAt} size="lg" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-foreground">{e.name}</h3>
                {statusBadge(e.status)}
              </div>
              <div className="mt-2 text-sm text-muted">
                {e.status === "locked" ? (
                  <span>Drop starts {new Date(e.goLiveAt).toLocaleString()}</span>
                ) : e.status === "live" ? (
                  <span>{e.items.reduce((s, i) => s + i.available, 0)} units left</span>
                ) : (
                  <span>{new Date(e.goLiveAt).toLocaleString()}</span>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {e.items.slice(0, 3).map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span className="truncate pr-2">{i.name}</span>
                    <span className="font-medium text-foreground">{formatLkr(i.unitPriceCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
