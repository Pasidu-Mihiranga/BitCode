import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-10 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Imports priced to disappear.</h1>
        <p className="mt-2 max-w-xl text-white/90">
          SwiftDrop runs scheduled flash sales of limited overseas stock.
          Buy fast, buy fair — with atomic stock reservation, ATM-style
          extensions, and a tamper-evident audit chain.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/events" className="btn-secondary">
            Browse events
          </Link>
          <Link
            href="/register"
            className="btn-primary bg-white text-brand hover:bg-zinc-100"
          >
            Create account
          </Link>
        </div>
      </div>

      {/* Sign-in cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer */}
        <div className="card flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand text-lg font-bold">
              C
            </span>
            <div>
              <h2 className="font-semibold">Customer</h2>
              <p className="text-xs text-zinc-500">Browse and purchase flash-sale items</p>
            </div>
          </div>
          <p className="text-sm text-zinc-600">
            Sign in with your customer account to reserve items, track orders, and
            manage your profile.
          </p>
          <Link href="/login" className="btn-primary mt-auto text-center">
            Customer Sign In
          </Link>
        </div>

        {/* Admin */}
        <div className="card flex flex-col gap-3 border-brand/30 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white text-lg font-bold">
              A
            </span>
            <div>
              <h2 className="font-semibold">
                Admin
                <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  ADMIN
                </span>
              </h2>
              <p className="text-xs text-zinc-500">Manage events, customers, and system logs</p>
            </div>
          </div>
          <p className="text-sm text-zinc-600">
            Sign in with your admin credentials to access the dashboard, create
            events, and view the audit chain.
          </p>
          <Link href="/login" className="btn-secondary mt-auto text-center">
            Admin Sign In
          </Link>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h3 className="font-semibold">Zero oversell</h3>
          <p className="text-sm text-zinc-600">
            Single-statement conditional UPDATE + UNIQUE partial index — no
            race condition can sell more than what's in stock.
          </p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold">Hold + 2 extensions</h3>
          <p className="text-sm text-zinc-600">
            Click Buy and we hold the unit for 60 s. Need a moment? Extend
            up to twice, just like an ATM.
          </p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold">Hash-chained audit</h3>
          <p className="text-sm text-zinc-600">
            Every state change is logged in a SHA-256 hash chain. Admins
            can prove integrity in a single click.
          </p>
        </div>
      </div>
    </section>
  );
}
