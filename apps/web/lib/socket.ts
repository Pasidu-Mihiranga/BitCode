/**
 * Tiny WebSocket subscriber for /ws/events/:id. Handles auto-reconnect with
 * exponential backoff capped at 10 s.
 */

import { useEffect, useRef, useState } from "react";

type StockMsg = {
  type: "stock";
  eventId: string;
  itemId: string;
  available: number;
  reservedStock: number;
  soldCount: number;
  stockQuantity: number;
  ts: number;
};
type EventMsg = {
  type: "event";
  eventId: string;
  status: "locked" | "live" | "closed" | "sold_out";
  reason?: string;
  ts: number;
};
export type WsMsg = StockMsg | EventMsg | { type: "hello"; eventId: string } | { type: "pong"; ts: number };

export function useEventSocket(eventId: string | null) {
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    let attempt = 0;
    const base = (process.env.NEXT_PUBLIC_WS_BASE_URL ??
      `ws://${typeof window !== "undefined" ? window.location.host : "localhost:8080"}`).replace(
      /\/$/,
      "",
    );

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(`${base}/ws/events/${eventId}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as WsMsg;
          if (data.type === "stock") {
            setAvailable((prev) => ({ ...prev, [data.itemId]: data.available }));
          } else if (data.type === "event") {
            setEventStatus(data.status);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(10_000, 500 * 2 ** attempt++);
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [eventId]);

  return { availableByItem: available, eventStatus };
}
