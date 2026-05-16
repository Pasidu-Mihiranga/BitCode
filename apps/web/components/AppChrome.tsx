"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/NavBar";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin && <NavBar />}
      <main
        className={
          isAdmin
            ? "w-full px-4 py-6 md:px-6 md:py-8"
            : "mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12"
        }
      >
        {children}
      </main>
      {!isAdmin && (
        <footer className="mt-20 border-t border-black/5">
          <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted md:px-6">
            SwiftDrop demo build · MailHog inbox at{" "}
            <code className="rounded-xl bg-surface px-2 py-1 shadow-neu-inset-sm">
              http://localhost:8025
            </code>
          </div>
        </footer>
      )}
    </>
  );
}
