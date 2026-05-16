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
      // Hard navigation so the full layout remounts and picks up the new cookie.
      window.location.href = out.role === "admin" ? "/admin/dashboard" : "/events";
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
      }
      setError((err as Error).message);
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
      setError("A fresh verification link has been sent. Check your MailHog inbox.");
    } catch (err: any) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card p-6">
        <h1 className="section-title">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">
          Both customers and admins use this login page.
        </p>

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

          {error && <p className="alert-error">{error}</p>}

          {needsVerify && (
            <button
              type="button"
              onClick={resend}
              className="btn-secondary w-full"
              disabled={busy}
            >
              Resend verification email
            </button>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-accent hover:text-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
            Create an account
          </Link>
        </p>
      </div>

      {/* Demo credential hints */}
      <div className="demo-panel space-y-1">
        <p className="font-semibold text-foreground">Demo credentials</p>
        <p>
          <span className="font-medium">Customer</span>&nbsp;
          customer@swiftdrop.local / Customer#12345
        </p>
        <p>
          <span className="font-medium">Admin</span>&nbsp;
          admin@swiftdrop.local / Admin#12345
        </p>
      </div>
    </div>
  );
}
