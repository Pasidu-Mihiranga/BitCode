"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Countdown } from "@/components/Countdown";

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

  if (loading) return <p>Loading events…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-sm text-zinc-500">{events.length} events</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="aspect-video bg-gradient-to-br from-zinc-200 to-zinc-300">
              {e.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{e.name}</h3>
                {statusBadge(e.status)}
              </div>
              <div className="mt-2 text-sm text-zinc-500">
                {e.status === "locked" ? (
                  <span>Opens in <Countdown target={e.goLiveAt} /></span>
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
                    <span className="text-zinc-500">₹{(i.unitPriceCents / 100).toLocaleString("en-IN")}</span>
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
