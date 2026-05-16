import Link from "next/link";
import { IconWell } from "@/components/ui/IconWell";

export default function HomePage() {
  return (
    <section className="space-y-12 md:space-y-16">
      {/* Hero — neumorphic surface, no gradients */}
      <div className="relative overflow-hidden rounded-neu bg-surface p-8 shadow-neu md:p-12 lg:p-16">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Flash sale platform</p>
          <h1 className="page-title mt-3 text-4xl md:text-5xl lg:text-6xl">
            Imports priced to disappear.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted md:text-lg">
            SwiftDrop runs scheduled flash sales of limited overseas stock. Buy fast, buy fair — with
            atomic stock reservation, ATM-style extensions, and a tamper-evident audit chain.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/events" className="btn-secondary">
              Browse events
            </Link>
            <Link href="/register" className="btn-primary">
              Create account
            </Link>
          </div>
        </div>

        <div
          className="pointer-events-none absolute -right-8 top-1/2 hidden h-48 w-48 -translate-y-1/2 rounded-full bg-surface shadow-neu md:block lg:h-56 lg:w-56"
          aria-hidden
        >
          <div className="absolute inset-4 flex items-center justify-center rounded-full shadow-neu-inset-deep">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-3xl font-extrabold text-white shadow-neu-accent animate-float">
              SD
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className="card-interactive flex flex-col gap-4 p-8">
          <div className="flex items-center gap-4">
            <IconWell>
              <span className="text-lg font-bold text-accent">C</span>
            </IconWell>
            <div>
              <h2 className="section-title">Customer</h2>
              <p className="text-xs text-muted">Browse and purchase flash-sale items</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Sign in with your customer account to reserve items, track orders, and manage your profile.
          </p>
          <Link href="/login" className="btn-primary mt-auto text-center">
            Customer sign in
          </Link>
        </div>

        <div className="card-interactive flex flex-col gap-4 p-8 ring-2 ring-accent/20">
          <div className="flex items-center gap-4">
            <IconWell variant="accent">
              <span className="text-lg font-bold">A</span>
            </IconWell>
            <div>
              <h2 className="section-title flex flex-wrap items-center gap-2">
                Admin
                <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-muted">Manage events, customers, and system logs</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Sign in with your admin credentials to access the dashboard, create events, and view the
            audit chain.
          </p>
          <Link href="/login" className="btn-secondary mt-auto text-center">
            Admin sign in
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 md:gap-8">
        {[
          {
            title: "Zero oversell",
            body: "Single-statement conditional UPDATE + UNIQUE partial index — no race can sell more than stock.",
          },
          {
            title: "Hold + 2 extensions",
            body: "Click Buy and we hold the unit for 60 s. Extend up to twice, just like an ATM.",
          },
          {
            title: "Hash-chained audit",
            body: "Every state change is logged in a SHA-256 hash chain. Admins prove integrity in one click.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-6 md:p-8">
            <h3 className="font-display text-lg font-bold text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
