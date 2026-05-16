/**
 * WebSocket hub backed by Redis Pub/Sub. Every API replica owns its local
 * connections; when stock changes anywhere, the producing replica PUBLISHes
 * to `stock:<eventId>` or `event:<eventId>` and every replica forwards the
 * message to its connected clients. This is how FR-M03/M04/M05 work across
 * the 2 api replicas behind NGINX.
 */

import { Elysia, t } from "elysia";
import { redisSub, redisPub, RedisChannels } from "../shared/redis";

type AnyWs = {
  send: (msg: string) => void;
  raw?: unknown;
};

const stockSubscribers = new Map<string, Set<AnyWs>>(); // eventId -> sockets
const eventSubscribers = new Map<string, Set<AnyWs>>(); // eventId -> sockets (status changes)

let subscriberStarted = false;
function ensureSubscriber() {
  if (subscriberStarted) return;
  subscriberStarted = true;
  redisSub.psubscribe("stock:*", "event:*").catch((e) => console.error("[ws] psubscribe", e));
  redisSub.on("pmessage", (_pattern, channel, message) => {
    if (channel.startsWith("stock:")) {
      const id = channel.slice("stock:".length);
      const subs = stockSubscribers.get(id);
      if (!subs || subs.size === 0) return;
      for (const ws of subs) {
        try {
          ws.send(message);
        } catch {
          /* ignore broken socket; cleanup happens on close */
        }
      }
    } else if (channel.startsWith("event:")) {
      const id = channel.slice("event:".length);
      const subs = eventSubscribers.get(id);
      if (!subs || subs.size === 0) return;
      for (const ws of subs) {
        try {
          ws.send(message);
        } catch {
          /* ignore */
        }
      }
    }
  });
}

export async function broadcastStock(
  eventId: string,
  payload: { itemId: string; available: number; soldCount: number; reservedStock: number; stockQuantity: number },
): Promise<void> {
  ensureSubscriber();
  await redisPub.publish(
    RedisChannels.stock(eventId),
    JSON.stringify({ type: "stock", eventId, ...payload, ts: Date.now() }),
  );
}

export async function broadcastEvent(
  eventId: string,
  payload: { status: "locked" | "live" | "closed" | "sold_out"; reason?: string },
): Promise<void> {
  ensureSubscriber();
  await redisPub.publish(
    RedisChannels.event(eventId),
    JSON.stringify({ type: "event", eventId, ...payload, ts: Date.now() }),
  );
}

export const wsHub = new Elysia()
  .ws("/ws/events/:id", {
    params: t.Object({ id: t.String({ minLength: 8 }) }),
    open(ws) {
      ensureSubscriber();
      const id = (ws.data.params as { id: string }).id;
      let s = stockSubscribers.get(id);
      if (!s) {
        s = new Set();
        stockSubscribers.set(id, s);
      }
      s.add(ws as unknown as AnyWs);
      let es = eventSubscribers.get(id);
      if (!es) {
        es = new Set();
        eventSubscribers.set(id, es);
      }
      es.add(ws as unknown as AnyWs);
      ws.send(JSON.stringify({ type: "hello", eventId: id }));
    },
    close(ws) {
      const id = (ws.data.params as { id: string }).id;
      stockSubscribers.get(id)?.delete(ws as unknown as AnyWs);
      eventSubscribers.get(id)?.delete(ws as unknown as AnyWs);
    },
    message(ws, _msg) {
      // ping/pong
      try {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      } catch {}
    },
  });
