"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Customer = {
  id: string;
  email: string;
  displayName: string;
  status: "pending_verification" | "active" | "deactivated";
  createdAt: string;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await api<{ ok: true; rows: Customer[]; total: number }>("/api/admin/customers?page=1&size=50");
    setRows(r.rows);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function deactivate(id: string) {
    await api(`/api/admin/customers/${id}/deactivate`, { method: "POST" });
    load();
  }

  if (loading) return <p>Loading…</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Customers</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Display name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{c.displayName}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      c.status === "active"
                        ? "badge-live"
                        : c.status === "deactivated"
                        ? "badge-sold-out"
                        : "badge-locked"
                    }
                  >
                    {c.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {c.status === "active" && (
                    <button className="btn-danger text-xs" onClick={() => deactivate(c.id)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
