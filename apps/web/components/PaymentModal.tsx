"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Countdown } from "./Countdown";
import { PaymentSuccess } from "./PaymentSuccess";

type Method = "card" | "upi" | "wallet" | "netbanking";

const METHOD_LABELS: Record<Method, string> = {
  card: "Credit / Debit Card",
  upi: "UPI",
  wallet: "Wallet",
  netbanking: "Net Banking",
};

export function PaymentModal({
  reservation,
  onClose,
  onFinished,
}: {
  reservation: {
    reservationId: string;
    expiresAt: string;
    extensionsRemaining: number;
    itemName: string;
    priceCents: number;
  };
  onClose: () => void;
  onFinished: (orderId: string) => void;
}) {
  const [phase, setPhase] = useState<"timer" | "methods" | "success">("timer");
  const [methods, setMethods] = useState<Method[]>([]);
  const [extLeft, setExtLeft] = useState(reservation.extensionsRemaining);
  const [expiresAt, setExpiresAt] = useState(reservation.expiresAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  async function extend() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: true; reservation: any }>(
        `/api/purchase/${reservation.reservationId}/extend`,
        { method: "POST" },
      );
      setExpiresAt(r.reservation.expiresAt);
      setExtLeft(r.reservation.extensionsRemaining);
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/purchase/${reservation.reservationId}/decline`, { method: "POST" });
      onClose();
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startConfirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: true; methods: Method[] }>(
        `/api/purchase/${reservation.reservationId}/confirm`,
        { method: "POST" },
      );
      setMethods(r.methods);
      setPhase("methods");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pay(method: Method) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: true; order: { orderId: string } }>(
        `/api/purchase/${reservation.reservationId}/pay`,
        { method: "POST", body: JSON.stringify({ method }) },
      );
      setOrderId(r.order.orderId);
      setPhase("success");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="card relative w-full max-w-md p-6"
      >
        <AnimatePresence mode="wait">
          {phase === "timer" && (
            <motion.div key="timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-semibold">Stock reserved for you</h2>
              <p className="mt-1 text-sm text-zinc-600">{reservation.itemName}</p>
              <p className="mt-1 text-sm text-zinc-500">
                ₹{(reservation.priceCents / 100).toLocaleString("en-IN")}
              </p>
              <div className="mt-6 text-center">
                <div className="text-4xl">
                  <Countdown target={expiresAt} onZero={onClose} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">Time left to confirm</p>
                <p className="mt-1 text-xs text-zinc-400">{extLeft} extension{extLeft === 1 ? "" : "s"} remaining</p>
              </div>
              {error && <p className="mt-3 text-sm text-rose-600 text-center">{error}</p>}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button onClick={decline} disabled={busy} className="btn-secondary">Decline</button>
                <button
                  onClick={extend}
                  disabled={busy || extLeft === 0}
                  className="btn-ghost border border-zinc-200"
                >
                  {extLeft === 0 ? "No extensions" : `+60 s (${extLeft} left)`}
                </button>
                <button onClick={startConfirm} disabled={busy} className="btn-primary">Confirm payment</button>
              </div>
              <p className="mt-3 text-center text-xs text-zinc-400">
                Demo build — no real payment gateway is contacted.
              </p>
            </motion.div>
          )}

          {phase === "methods" && (
            <motion.div key="methods" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-semibold">Choose payment method</h2>
              <p className="mt-1 text-sm text-zinc-500">Mock pickers — any choice succeeds.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {methods.map((m) => (
                  <button
                    key={m}
                    onClick={() => pay(m)}
                    disabled={busy}
                    className="rounded-xl border border-zinc-200 p-4 text-left transition hover:border-brand hover:shadow-md"
                  >
                    <div className="text-sm font-medium">{METHOD_LABELS[m]}</div>
                    <div className="mt-1 text-xs text-zinc-500">tap to pay</div>
                  </button>
                ))}
              </div>
              {error && <p className="mt-3 text-sm text-rose-600 text-center">{error}</p>}
              <div className="mt-4 text-center">
                <button onClick={() => setPhase("timer")} className="text-sm text-zinc-500 hover:underline">
                  Back
                </button>
              </div>
            </motion.div>
          )}

          {phase === "success" && orderId && (
            <PaymentSuccess
              orderId={orderId}
              amountCents={reservation.priceCents}
              onDone={() => onFinished(orderId)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
