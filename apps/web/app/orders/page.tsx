"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";

type Order = {
  orderId: string;
  createdAt: string;
  status: string;
  quantity: number;
  pricePaidCents: number;
  paymentMethod: string;
  eventName: string;
  itemName: string;
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ ok: true; orders: Order[] }>("/api/orders");
        setOrders(r.orders);
      } catch (e) {
        if (e instanceof ApiError && e.code === "UNAUTHORIZED") router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <p>Loading…</p>;
  if (orders.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-lg font-semibold">No orders yet</h1>
        <p className="mt-1 text-sm text-zinc-500">Pick up something in the marketplace.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">My orders</h1>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderId} className="border-t border-zinc-100">
                <td className="px-4 py-3 text-zinc-500">{new Date(o.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{o.eventName}</td>
                <td className="px-4 py-3">{o.itemName}</td>
                <td className="px-4 py-3 uppercase">{o.paymentMethod}</td>
                <td className="px-4 py-3">₹{(o.pricePaidCents / 100).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <span className={o.status === "confirmed" ? "badge-live" : "badge-closed"}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
