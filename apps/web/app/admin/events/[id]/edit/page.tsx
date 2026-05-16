"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

/** Display go-live time in `<input type="datetime-local"/>` local zone (not UTC). */
function dateToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Item = {
  id: string;
  name: string;
  unitPriceCents: number;
  stockQuantity: number;
  imageUrl?: string | null;
};

type Event = {
  id: string;
  name: string;
  status: string;
  goLiveAt: string;
  coverPhotoUrl: string | null;
  items: Item[];
};

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [evt, setEvt] = useState<Event | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [itemFiles, setItemFiles] = useState<(File | null)[]>([]);
  const [itemPreviewUrls, setItemPreviewUrls] = useState<(string | null)[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitError(null);
    (async () => {
      try {
        const r = await api<{ ok: true; event: Event }>(`/api/events/${id}`);
        if (!cancelled) {
          setEvt(r.event);
          setItems(r.event.items);
          setItemFiles(r.event.items.map(() => null));
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        const msg =
          e instanceof ApiError && e.code === "EVENT_NOT_FOUND"
            ? "Event not found."
            : "Could not load this event.";
        setInitError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    const urls = itemFiles.map((f) => (f ? URL.createObjectURL(f) : null));
    setItemPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [itemFiles]);

  if (initError) {
    return (
      <section className="mx-auto max-w-2xl">
        <p className="text-sm text-rose-600">{initError}</p>
      </section>
    );
  }
  if (!evt) return <p>Loading…</p>;

  const editable = evt.status === "locked";

  function update(idx: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function setItemImageAt(idx: number, file: File | null) {
    setItemFiles((prev) => prev.map((x, i) => (i === idx ? file : x)));
  }

  function clearCoverSelection() {
    setCover(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", evt!.name.trim());
      fd.append("goLiveAt", new Date(evt!.goLiveAt).toISOString());
      fd.append(
        "items",
        JSON.stringify(
          items.map(({ name, unitPriceCents, stockQuantity, imageUrl }) => ({
            name,
            unitPriceCents,
            stockQuantity,
            ...(imageUrl != null ? { imageUrl } : {}),
          })),
        ),
      );
      itemFiles.forEach((file, idx) => {
        if (file) fd.append(`itemImage_${idx}`, file);
      });
      if (cover) fd.append("cover", cover);
      await api(`/api/admin/events/${id}`, { method: "PATCH", body: fd });
      router.push("/admin/dashboard");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Edit event</h1>
      {!editable && (
        <p className="rounded bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Only locked events can be edited. Current status: {evt.status}.
        </p>
      )}
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <label className="label">Event name</label>
          <input
            className="input"
            disabled={!editable}
            value={evt.name}
            onChange={(e) => setEvt({ ...evt, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Go-live time</label>
          <input
            className="input"
            type="datetime-local"
            disabled={!editable}
            value={dateToDatetimeLocal(evt.goLiveAt)}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) return;
              const d = new Date(raw);
              if (!Number.isNaN(d.getTime())) setEvt({ ...evt, goLiveAt: d.toISOString() });
            }}
          />
        </div>
        <div>
          <label className="label">Cover photo (replace)</label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!editable}
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
          {cover && editable && (
            <p className="mt-2 text-sm text-muted">
              Selected: {cover.name}{" "}
              <button type="button" className="btn-ghost ml-2 inline-flex px-3 py-1 text-xs" onClick={clearCoverSelection}>
                Clear
              </button>
            </p>
          )}
        </div>
        <div className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 font-medium">Items</h3>
          {items.map((it, idx) => {
            const thumb = itemPreviewUrls[idx] ?? it.imageUrl ?? null;
            return (
            <div key={it.id} className="space-y-3 border-t border-zinc-50 py-3">
              {thumb ? (
                <div className="flex items-start gap-4">
                  <div className="media-well h-24 w-24 shrink-0 rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="label">Replace item photo</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!editable}
                      onChange={(e) => setItemImageAt(idx, e.target.files?.[0] ?? null)}
                    />
                    {itemFiles[idx] && editable ? (
                      <button
                        type="button"
                        className="btn-ghost inline-flex px-3 py-1 text-xs"
                        onClick={() => setItemImageAt(idx, null)}
                      >
                        Cancel new upload
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">Item photo (optional)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!editable}
                    onChange={(e) => setItemImageAt(idx, e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <input
                  className="input"
                  disabled={!editable}
                  value={it.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="label">Price (LKR)</label>
                <input
                  className="input"
                  type="number"
                  disabled={!editable}
                  value={it.unitPriceCents / 100}
                  onChange={(e) => update(idx, { unitPriceCents: Math.round(Number(e.target.value) * 100) })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="label">Stock (100–500)</label>
                <input
                  className="input"
                  type="number"
                  min={100}
                  max={500}
                  disabled={!editable}
                  value={it.stockQuantity}
                  onChange={(e) => update(idx, { stockQuantity: Number(e.target.value) })}
                />
              </div>
            </div>
            </div>
            );
          })}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={!editable || busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
