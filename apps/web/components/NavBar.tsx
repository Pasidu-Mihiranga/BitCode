"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState } from "react";

export function NavBar() {
  const { me, loaded } = useMe();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // proceed even if server-side fails
    }
    router.push("/login");
    router.refresh();
    setSigningOut(false);
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo — always goes to landing page */}
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-brand">Swift</span>Drop
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {/* Marketplace is always visible */}
          <Link href="/events" className="hover:underline">
            Marketplace
          </Link>

          {!loaded ? (
            /* Skeleton while session loads — avoids flash */
            <span className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
          ) : me ? (
            <>
              {/* Role-specific links */}
              {me.role === "admin" ? (
                <>
                  <Link href="/admin/dashboard" className="hover:underline">
                    Dashboard
                  </Link>
                  <Link href="/admin/customers" className="text-zinc-500 hover:underline">
                    Customers
                  </Link>
                  <Link href="/admin/system-logs" className="text-zinc-500 hover:underline">
                    System Logs
                  </Link>
                </>
              ) : (
                <Link href="/orders" className="hover:underline">
                  My Orders
                </Link>
              )}

              {/* User badge + sign-out */}
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {me.displayName}
                {me.role === "admin" && (
                  <span className="ml-1 rounded bg-brand px-1 py-0.5 text-[10px] font-semibold text-white">
                    ADMIN
                  </span>
                )}
              </span>
              <button
                onClick={logout}
                disabled={signingOut}
                className="btn-secondary text-xs"
              >
                {signingOut ? "…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              {/* Not logged in */}
              <Link href="/login" className="hover:underline text-zinc-600">
                Login
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
