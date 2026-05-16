"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useEventSocket } from "@/lib/socket";
import { Countdown } from "@/components/Countdown";
import { PaymentModal } from "@/components/PaymentModal";

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

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null); // item id while waiting for server
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    reservationId: string;
    expiresAt: string;
    extensionsRemaining: number;
    itemName: string;
    priceCents: number;
  } | null>(null);

  const { availableByItem, eventStatus } = useEventSocket(id);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ ok: true; event: Event }>(`/api/events/${id}`);
        setEvent(r.event);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p>Loading event…</p>;
  if (!event) return <p>Not found.</p>;

  const statusNow = (eventStatus ?? event.status) as Event["status"];

  async function buy(item: Item) {
    setError(null);
    setBuying(item.id);
    try {
      const r = await api<{ ok: true; reservation: { reservationId: string; expiresAt: string; extensionsRemaining: number } }>(
        "/api/purchase/reserve",
        { method: "POST", body: JSON.stringify({ itemId: item.id }) },
      );
      setModal({
        reservationId: r.reservation.reservationId,
        expiresAt: r.reservation.expiresAt,
        extensionsRemaining: r.reservation.extensionsRemaining,
        itemName: item.name,
        priceCents: item.unitPriceCents,
      });
    } catch (e: any) {
      if (e instanceof ApiError && e.code === "UNAUTHORIZED") {
        router.push("/login");
        return;
      }
      setError((e as Error).message);
    } finally {
      setBuying(null);
    }
  }

  return (
    <>
      <article className="space-y-6">
        <div className="aspect-[2/1] overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-300">
          {event.coverPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <div className="text-sm text-zinc-500">
            {statusNow === "locked" ? (
              <>Opens in <Countdown target={event.goLiveAt} /></>
            ) : (
              <>Status: {statusNow.replace("_", " ")}</>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {event.items.map((i) => {
            const liveAvailable = availableByItem[i.id] ?? i.available;
            const soldOut = liveAvailable <= 0 || statusNow === "sold_out";
            const canBuy = statusNow === "live" && !soldOut && buying !== i.id;
            return (
              <div key={i.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{i.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      ₹{(i.unitPriceCents / 100).toLocaleString("en-IN")}
                    </p>
                  </div>
                  {soldOut ? (
                    <span className="badge-sold-out">Sold Out</span>
                  ) : (
                    <span className="badge-live">{liveAvailable} left</span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    of {i.stockQuantity} total · {i.soldCount} sold
                  </p>
                  <button
                    onClick={() => buy(i)}
                    disabled={!canBuy}
                    className="btn-primary"
                  >
                    {buying === i.id
                      ? "Reserving…"
                      : statusNow !== "live"
                      ? "Not live"
                      : soldOut
                      ? "Sold out"
                      : "Buy now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {modal && (
        <PaymentModal
          reservation={modal}
          onClose={() => setModal(null)}
          onFinished={() => {
            setModal(null);
            router.push("/orders");
          }}
        />
      )}
    </>
  );
}
