"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { formatLkr } from "@/lib/currency";

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

  if (loading) return <p className="text-muted">Loading…</p>;
  if (orders.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h1 className="section-title">No orders yet</h1>
        <p className="mt-2 text-sm text-muted">Pick up something in the marketplace.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="page-title">My orders</h1>
      <div className="table-wrap">
        <table className="table-neu">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Item</th>
              <th>Method</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderId}>
                <td className="text-muted">{new Date(o.createdAt).toLocaleString()}</td>
                <td>{o.eventName}</td>
                <td>{o.itemName}</td>
                <td className="uppercase">{o.paymentMethod}</td>
                <td className="font-medium">{formatLkr(o.pricePaidCents)}</td>
                <td>
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
