"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

export function PaymentSuccess({
  orderId,
  amountCents,
  onDone,
}: {
  orderId: string;
  amountCents: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-4 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="rounded-full bg-emerald-100 p-4"
      >
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5">
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 12l5 5L20 7"
          />
        </svg>
      </motion.div>
      <h2 className="mt-4 text-lg font-semibold text-emerald-700">Payment succeeded</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paid ₹{(amountCents / 100).toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-zinc-400">Order #{orderId.slice(0, 8)}</p>
    </motion.div>
  );
}
