"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNeedsVerify(false);
    try {
      const out = await api<{ ok: true; role: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(out.role === "admin" ? "/admin/dashboard" : "/events");
    } catch (e: any) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/email/resend", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setError("We sent a fresh verification link. Check your inbox (or MailHog).");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {needsVerify && (
            <button type="button" onClick={resend} className="btn-secondary w-full" disabled={busy}>
              Resend verification email
            </button>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link href="/register" className="text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
