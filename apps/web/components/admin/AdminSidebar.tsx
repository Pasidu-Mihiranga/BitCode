"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";

const links: Array<{
  href: string;
  label: string;
  variant: "primary" | "secondary";
  isActive: (pathname: string, sp: URLSearchParams) => boolean;
}> = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    variant: "secondary",
    isActive: (p, sp) => p === "/admin/dashboard" && sp.get("tab") !== "accounts",
  },
  {
    href: "/admin/dashboard?tab=accounts",
    label: "Admin accounts",
    variant: "secondary",
    isActive: (p, sp) => p === "/admin/dashboard" && sp.get("tab") === "accounts",
  },
  {
    href: "/admin/events/new",
    label: "+ New event",
    variant: "primary",
    isActive: (p) => p.startsWith("/admin/events"),
  },
  {
    href: "/admin/customers",
    label: "Customers",
    variant: "secondary",
    isActive: (p) => p === "/admin/customers" || p.startsWith("/admin/customers/"),
  },
  {
    href: "/admin/system-logs",
    label: "System logs",
    variant: "secondary",
    isActive: (p) => p === "/admin/system-logs" || p.startsWith("/admin/system-logs/"),
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    <aside
      className={cn(
        "admin-sidebar mb-6 w-full shrink-0 overflow-x-hidden rounded-neu p-4 sm:p-5",
        "lg:fixed lg:left-0 lg:top-0 lg:mb-0 lg:flex lg:h-screen lg:w-56 lg:max-w-[14rem] lg:rounded-none lg:rounded-tr-[32px] lg:p-5 lg:pr-4",
        "admin-sidebar-scroll overflow-y-auto",
      )}
    >
      <header className="admin-sidebar-brand mb-5">
        <div className="admin-sidebar-brand-mark" aria-hidden />
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Console</p>
        <Link
          href="/admin/dashboard"
          className="font-display block text-xl font-extrabold tracking-tight text-foreground transition-colors hover:text-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:text-2xl"
        >
          <span className="text-accent">Swift</span>Drop
        </Link>
      </header>

      <nav className="admin-sidebar-nav flex-1 lg:min-h-0" aria-label="Admin navigation">
        {links.map(({ href, label, variant, isActive }) => {
          const active = isActive(pathname, searchParams);
          return (
            <Link
              key={href + label}
              href={href}
              className={cn(
                variant === "primary"
                  ? "btn-primary w-full justify-center text-center"
                  : cn("admin-nav-item", active && "admin-nav-item-active"),
              )}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <footer className="mt-6 border-t border-black/5 pt-5 lg:mt-auto">
        <div className="admin-sidebar-footer">
          <Link href="/" className="btn-secondary w-full justify-center text-center text-sm">
            ← Back to site
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={signingOut}
            className="btn-ghost w-full text-center text-sm"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
      </footer>
    </aside>
  );
}
