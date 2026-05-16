"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";

type DashboardEvent = {
  id: string;
  name: string;
  status: string;
  goLiveAt: string;
  totalRevenueCents: number;
  totalUnitsSold: number;
  items: {
    id: string;
    name: string;
    unitPriceCents: number;
    stockQuantity: number;
    reservedStock: number;
    soldCount: number;
    unitsSold: number;
    revenueCents: number;
  }[];
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await api<{ ok: true; events: DashboardEvent[] }>("/api/admin/dashboard");
      setEvents(r.events);
    } catch (e: any) {
      if (e instanceof ApiError && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function force(eventId: string, action: "force-open" | "force-close") {
    await api(`/api/admin/events/${eventId}/${action}`, { method: "POST" });
    load();
  }

  if (loading) return <p>Loading…</p>;

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-zinc-500">Live event status, sold units, and revenue.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/events/new" className="btn-primary">+ New event</Link>
          <Link href="/admin/customers" className="btn-secondary">Customers</Link>
          <Link href="/admin/system-logs" className="btn-secondary">System logs</Link>
        </div>
      </header>

      <div className="grid gap-4">
        {events.map((e) => (
          <div key={e.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{e.name}</h3>
                <p className="text-sm text-zinc-500">
                  {e.status} · go-live {new Date(e.goLiveAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {e.status === "locked" && (
                  <button onClick={() => force(e.id, "force-open")} className="btn-ghost border border-zinc-200">
                    Force open
                  </button>
                )}
                {e.status === "live" && (
                  <button onClick={() => force(e.id, "force-close")} className="btn-danger">
                    Force close
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Metric label="Units sold" value={e.totalUnitsSold.toLocaleString()} />
              <Metric label="Revenue" value={`₹${(e.totalRevenueCents / 100).toLocaleString("en-IN")}`} />
              <Metric label="Items" value={String(e.items.length)} />
              <Metric
                label="Remaining"
                value={String(
                  e.items.reduce(
                    (s, i) => s + Math.max(i.stockQuantity - i.reservedStock - i.soldCount, 0),
                    0,
                  ),
                )}
              />
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1">Stock</th>
                  <th className="py-1">Reserved</th>
                  <th className="py-1">Sold</th>
                  <th className="py-1">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {e.items.map((i) => (
                  <tr key={i.id} className="border-t border-zinc-100">
                    <td className="py-2">{i.name}</td>
                    <td className="py-2">{i.stockQuantity}</td>
                    <td className="py-2">{i.reservedStock}</td>
                    <td className="py-2">{i.soldCount}</td>
                    <td className="py-2">₹{(i.revenueCents / 100).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
