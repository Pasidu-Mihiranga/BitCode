"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type ItemDraft = { name: string; unitPriceCents: number; stockQuantity: number };

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goLiveLocal, setGoLiveLocal] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { name: "", unitPriceCents: 0, stockQuantity: 100 },
  ]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("goLiveAt", new Date(goLiveLocal).toISOString());
      fd.append("items", JSON.stringify(items));
      if (cover) fd.append("cover", cover);
      await api("/api/admin/events", { method: "POST", body: fd });
      router.push("/admin/dashboard");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">New event</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <label className="label">Event name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Go-live time</label>
          <input
            className="input"
            type="datetime-local"
            required
            value={goLiveLocal}
            onChange={(e) => setGoLiveLocal(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Cover photo (JPEG/PNG/WebP, &lt;5MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-zinc-500">Sanitized server-side: magic-byte check, EXIF strip, max 1920×1080.</p>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Items</h3>
            <button
              type="button"
              onClick={() => setItems((a) => [...a, { name: "", unitPriceCents: 0, stockQuantity: 100 }])}
              className="btn-ghost text-sm"
            >
              + Add item
            </button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-3 border-t border-zinc-50 py-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="label">Name</label>
                <input className="input" required value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="label">Price (LKR)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  required
                  value={it.unitPriceCents / 100}
                  onChange={(e) => updateItem(idx, { unitPriceCents: Math.round(Number(e.target.value) * 100) })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="label">Stock (100–500)</label>
                <input
                  className="input"
                  type="number"
                  min={100}
                  max={500}
                  required
                  value={it.stockQuantity}
                  onChange={(e) => updateItem(idx, { stockQuantity: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>
    </section>
  );
}
