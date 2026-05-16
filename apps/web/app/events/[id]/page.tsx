"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useEventSocket } from "@/lib/socket";
import { Countdown } from "@/components/Countdown";
import { PaymentModal } from "@/components/PaymentModal";
import { formatLkr } from "@/lib/currency";

type Item = {
  id: string;
  name: string;
  unitPriceCents: number;
  stockQuantity: number;
  reservedStock: number;
  soldCount: number;
  available: number;
  imageUrl?: string | null;
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

  if (loading) return <p className="text-muted">Loading event…</p>;
  if (!event) return <p className="text-muted">Not found.</p>;

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
        <div className="media-well relative flex aspect-[2/1] items-center justify-center">
          {event.coverPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverPhotoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {statusNow === "locked" && (
            <div className="relative z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
                Opens in
              </span>
              <Countdown target={event.goLiveAt} size="xl" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="page-title text-2xl md:text-3xl">{event.name}</h1>
          <div className="text-sm text-muted">
            {statusNow === "locked" ? (
              <span>Starts {new Date(event.goLiveAt).toLocaleString()}</span>
            ) : (
              <>Status: {statusNow.replace("_", " ")}</>
            )}
          </div>
        </div>

        {error && (
          <div className="alert-error">{error}</div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {event.items.map((i) => {
            const liveAvailable = availableByItem[i.id] ?? i.available;
            const soldOut = liveAvailable <= 0 || statusNow === "sold_out";
            const canBuy = statusNow === "live" && !soldOut && buying !== i.id;
            return (
              <div key={i.id} className="card overflow-hidden p-0">
                {i.imageUrl ? (
                  <div className="media-well relative aspect-[4/3] max-h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{i.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {formatLkr(i.unitPriceCents)}
                    </p>
                  </div>
                  {soldOut ? (
                    <span className="badge-sold-out">Sold Out</span>
                  ) : (
                    <span className="badge-live">{liveAvailable} left</span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted">
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
