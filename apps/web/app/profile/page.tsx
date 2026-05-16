"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type Me = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ ok: true; user: Me }>("/api/auth/me");
        setMe(r.user);
        setDisplayName(r.user.displayName);
      } catch (e) {
        if (e instanceof ApiError && e.code === "UNAUTHORIZED") router.push("/login");
      }
    })();
  }, [router]);

  if (!me) return <p>Loading…</p>;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ displayName }) });
      setInfo("Display name updated.");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setInfo("Confirmation email sent. Open it to apply the new password.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  }

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="card p-4">
        <div className="text-sm text-zinc-500">Signed in as</div>
        <div className="font-mono text-sm">{me.email}</div>
        <button onClick={logout} className="btn-secondary mt-3 text-sm">Sign out</button>
      </div>

      <form onSubmit={saveName} className="card space-y-3 p-4">
        <h3 className="font-medium">Display name</h3>
        <input
          className="input"
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={busy}>Save</button>
      </form>

      <form onSubmit={changePassword} className="card space-y-3 p-4">
        <h3 className="font-medium">Change password</h3>
        <input
          className="input"
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="New password (min 8 chars)"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="text-xs text-zinc-500">
          For safety, password changes require an emailed confirmation link before they apply.
        </p>
        <button type="submit" className="btn-primary" disabled={busy}>Send confirmation email</button>
      </form>

      {info && <p className="text-sm text-emerald-600">{info}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  );
}
