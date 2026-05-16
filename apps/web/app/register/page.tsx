"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password }),
      });
      setDone(true);
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6 text-center">
          <h1 className="text-xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-zinc-600">
            We sent a verification link to <strong>{email}</strong>. Click
            it to activate your account.
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            Demo: open <a className="text-brand underline" href="http://localhost:8025" target="_blank" rel="noreferrer">MailHog</a> to grab the link instantly.
          </p>
          <Link href="/login" className="btn-secondary mt-6 inline-block">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-zinc-500">Minimum 8 characters. Hashed with argon2id (m=19 MiB, t=2).</p>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
