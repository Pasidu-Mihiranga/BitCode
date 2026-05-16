import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-10 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Imports priced to disappear.</h1>
        <p className="mt-2 max-w-xl text-white/90">
          SwiftDrop runs scheduled flash sales of limited overseas stock.
          Buy fast, buy fair — with atomic stock reservation, ATM-style
          extensions, and a tamper-evident audit chain.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/events" className="btn-secondary">Browse events</Link>
          <Link href="/register" className="btn-primary bg-white text-brand hover:bg-zinc-100">
            Create account
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h3 className="font-semibold">Zero oversell</h3>
          <p className="text-sm text-zinc-600">
            Single-statement conditional UPDATE + UNIQUE partial index = no
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
