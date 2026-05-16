"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { FormField } from "@/components/admin/FormField";
import { CURRENCY_LABEL } from "@/lib/currency";

type ItemDraft = { name: string; unitPriceCents: number; stockQuantity: number };

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goLiveLocal, setGoLiveLocal] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { name: "", unitPriceCents: 0, stockQuantity: 100 },
  ]);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function addItem() {
    setItems((a) => [...a, { name: "", unitPriceCents: 0, stockQuantity: 100 }]);
  }

  function removeItem(idx: number) {
    setItems((a) => (a.length <= 1 ? a : a.filter((_, i) => i !== idx)));
  }

  function clearCover() {
    setCover(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
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
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="page-title">New event</h1>
        <p className="mt-1 text-sm text-muted">
          Schedule a flash drop, upload a cover, and add one or more SKUs (100–500 units each).
        </p>
      </header>

      <form onSubmit={onSubmit} className="form-shell">
        <div className="form-section">
          <div>
            <h2 className="form-section-title">Event details</h2>
            <p className="form-section-subtitle">Name, go-live time, and optional hero image.</p>
          </div>

          <FormField label="Event name">
            <input
              className="input"
              required
              placeholder="e.g. Friday Night Drop"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField
            label="Go-live time"
            hint="Customers can buy only after this time (unless you force-open from the dashboard)."
          >
            <input
              className="input"
              type="datetime-local"
              required
              value={goLiveLocal}
              onChange={(e) => setGoLiveLocal(e.target.value)}
            />
          </FormField>

          <FormField
            label="Cover photo"
            hint="JPEG, PNG, or WebP under 5 MB. Sanitized server-side: magic-byte check, EXIF strip, max 1920×1080."
          >
            <label className="file-drop">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              />
              <span className="icon-well" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16l4.5-5 4 3.5 6-7 5.5 8.5H4z" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-foreground">
                {cover ? cover.name : "Choose an image"}
              </span>
              <span className="text-xs text-muted">Click to browse</span>
            </label>
            {coverPreview && (
              <div className="mt-3 space-y-2">
                <div className="media-well aspect-[21/9] max-h-44">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                </div>
                <button type="button" className="btn-ghost w-full text-sm sm:w-auto" onClick={clearCover}>
                  Remove cover photo
                </button>
              </div>
            )}
          </FormField>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Items</h2>
              <p className="form-section-subtitle">
                At least one product. Stock must be between 100 and 500 per SKU.
              </p>
            </div>
            <button type="button" onClick={addItem} className="btn-secondary shrink-0 text-sm">
              + Add item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((it, idx) => (
              <article key={idx} className="item-row">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="item-row-index">{idx + 1}</span>
                    <span className="text-sm font-semibold text-foreground">Product line</span>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <FormField label="Name">
                      <input
                        className="input"
                        required
                        placeholder="Product name"
                        value={it.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <div className="md:col-span-3">
                    <FormField label={`Price (${CURRENCY_LABEL})`}>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.01}
                        required
                        placeholder="0.00"
                        value={it.unitPriceCents ? it.unitPriceCents / 100 : ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            unitPriceCents: Math.round(Number(e.target.value || 0) * 100),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="md:col-span-3">
                    <FormField label="Stock">
                      <input
                        className="input"
                        type="number"
                        min={100}
                        max={500}
                        required
                        value={it.stockQuantity}
                        onChange={(e) => updateItem(idx, { stockQuantity: Number(e.target.value) })}
                      />
                    </FormField>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {error && <p className="alert-error">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={busy}
            onClick={() => router.push("/admin/dashboard")}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-[12rem]" disabled={busy}>
            {busy ? "Creating…" : "Create event"}
          </button>
        </div>
      </form>
    </section>
  );
}
