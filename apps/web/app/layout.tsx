import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SwiftDrop — Flash Sale Marketplace",
  description: "High-concurrency flash sale platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              <span className="text-brand">Swift</span>Drop
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/events" className="hover:underline">Marketplace</Link>
              <Link href="/orders" className="hover:underline">My Orders</Link>
              <Link href="/admin/dashboard" className="text-zinc-500 hover:underline">Admin</Link>
              <Link href="/login" className="btn-primary text-sm">Login</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mt-16 border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-zinc-500">
            SwiftDrop demo build · MailHog inbox at <code className="rounded bg-zinc-100 px-1 py-0.5">http://localhost:8025</code>
          </div>
        </footer>
      </body>
    </html>
  );
}
