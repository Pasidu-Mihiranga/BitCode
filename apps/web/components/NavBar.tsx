"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function NavBar() {
  const { me, loaded } = useMe();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // proceed even if server-side fails
    }
    setMenuOpen(false);
    // Hard navigation forces layout remount so the navbar re-reads the session.
    window.location.href = "/login";
  }

  const inAdmin = pathname.startsWith("/admin");

  const navLink = (href: string, label: string, muted = false) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={cn(
        pathname === href || pathname.startsWith(`${href}/`) ? "link-nav-active" : "link-nav",
        muted && pathname !== href && !pathname.startsWith(`${href}/`) && "text-muted",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span className="text-accent">Swift</span>Drop
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {!inAdmin && navLink("/events", "Marketplace")}
          {!loaded ? (
            <span className="mx-2 h-10 w-20 animate-pulse rounded-2xl bg-surface shadow-neu-inset-sm" />
          ) : me ? (
            <>
              {!inAdmin &&
                (me.role === "admin"
                  ? navLink("/admin/dashboard", "Dashboard")
                  : navLink("/orders", "My Orders"))}
              {!(inAdmin && me.role === "admin") && (
                <>
                  <span className="mx-2 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-neu-inset-sm">
                    {me.displayName}
                    {me.role === "admin" && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-neu-sm">
                        Admin
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
              )}
            </>
          ) : (
            <>
              {navLink("/login", "Login")}
              <Link href="/register" className="btn-primary text-sm">
                Register
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="btn-secondary h-12 w-12 p-0 md:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav
          className="border-t border-black/5 bg-surface px-4 py-4 shadow-neu md:hidden"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-2">
            {!inAdmin && navLink("/events", "Marketplace")}
            {!loaded ? null : me ? (
              <>
                {!inAdmin &&
                  (me.role === "admin"
                    ? navLink("/admin/dashboard", "Dashboard")
                    : navLink("/orders", "My Orders"))}
                {!(inAdmin && me.role === "admin") && (
                  <>
                    <p className="px-3 py-2 text-xs text-muted">{me.displayName}</p>
                    <button onClick={logout} disabled={signingOut} className="btn-secondary w-full">
                      {signingOut ? "…" : "Sign out"}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {navLink("/login", "Login")}
                <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary w-full text-center">
                  Register
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
