"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function ConfirmPasswordChangeContent() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await api<{ ok: true; message: string }>(
          `/api/email/confirm-password-change?token=${encodeURIComponent(token)}`,
        );
        setState("ok");
        setMsg(r.message);
      } catch (e: any) {
        setState("err");
        setMsg((e as Error).message);
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 text-center">
        <h1 className="text-xl font-semibold">Confirm password change</h1>
        {!token && <p className="mt-2 text-sm text-zinc-600">Missing token.</p>}
        {state === "idle" && token && <p className="mt-2 text-sm text-zinc-600">Confirming…</p>}
        {state === "ok" && (
          <>
            <p className="mt-2 text-sm text-emerald-600">{msg}</p>
            <Link href="/login" className="btn-primary mt-6 inline-block">
              Sign in
            </Link>
          </>
        )}
        {state === "err" && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      </div>
    </div>
  );
}

export default function ConfirmPasswordChangePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <div className="card p-6 text-center">
            <p className="text-sm text-zinc-600">Loading…</p>
          </div>
        </div>
      }
    >
      <ConfirmPasswordChangeContent />
    </Suspense>
  );
}
