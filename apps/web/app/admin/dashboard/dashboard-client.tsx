"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatLkr } from "@/lib/currency";
import { FormField } from "@/components/admin/FormField";
import { cn } from "@/lib/cn";

type DashboardEvent = {
  id: string;
  name: string;
  status: string;
  goLiveAt: string;
  totalRevenueCents: number;
  totalUnitsSold: number;
  items: {
    id: string;
    name: string;
    unitPriceCents: number;
    stockQuantity: number;
    reservedStock: number;
    soldCount: number;
    unitsSold: number;
    revenueCents: number;
  }[];
};

type SkuRow = {
  itemId: string;
  itemName: string;
  eventId: string;
  eventName: string;
  unitsSold: number;
  revenueCents: number;
};

type EventRevenueRow = {
  eventId: string;
  eventName: string;
  status: string;
  revenueCents: number;
  unitsSold: number;
};

type AdminAnalytics = {
  totals: {
    confirmedOrders: number;
    totalRevenueCents: number;
    totalUnitsSold: number;
    eventsTotal: number;
    eventsLive: number;
    uniqueItemsListed: number;
  };
  topByUnits: SkuRow[];
  topByRevenue: SkuRow[];
  eventsByRevenue: EventRevenueRow[];
};

type AdminAccountRow = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
};

type TabId = "events" | "insights" | "accounts";

const TAB_ITEMS: { id: TabId; label: string }[] = [
  { id: "events", label: "Event performance" },
  { id: "insights", label: "Sales insights" },
  { id: "accounts", label: "Admin accounts" },
];

function tabFromSearch(raw: string | null): TabId {
  if (raw === "insights" || raw === "accounts") return raw;
  return "events";
}

export function AdminDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));

  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [admins, setAdmins] = useState<AdminAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  function setTab(next: TabId) {
    if (next === "events") router.replace("/admin/dashboard", { scroll: false });
    else router.replace(`/admin/dashboard?tab=${next}`, { scroll: false });
  }

  async function load() {
    try {
      const [dash, ana] = await Promise.all([
        api<{ ok: true; events: DashboardEvent[] }>("/api/admin/dashboard"),
        api<{ ok: true } & AdminAnalytics>("/api/admin/analytics"),
      ]);
      setEvents(dash.events);
      setAnalytics({
        totals: ana.totals,
        topByUnits: ana.topByUnits,
        topByRevenue: ana.topByRevenue,
        eventsByRevenue: ana.eventsByRevenue,
      });
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadAdmins() {
    setAdminsLoading(true);
    try {
      const r = await api<{ ok: true; admins: AdminAccountRow[] }>("/api/admin/admins");
      setAdmins(r.admins);
    } catch {
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "accounts") loadAdmins();
  }, [tab]);

  async function force(eventId: string, action: "force-open" | "force-close") {
    await api(`/api/admin/events/${eventId}/${action}`, { method: "POST" });
    load();
  }

  async function onCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminBusy(true);
    setAdminError(null);
    try {
      await api("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          email: adminEmail,
          displayName: adminName,
          password: adminPassword,
        }),
      });
      setAdminEmail("");
      setAdminName("");
      setAdminPassword("");
      await loadAdmins();
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : "Could not create admin");
    } finally {
      setAdminBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <section className="relative">
      <div
        className={
          "sticky top-0 z-20 -mx-4 border-b border-black/5 bg-surface/95 px-4 pb-5 pt-3 " +
          "shadow-[0_12px_28px_-16px_rgb(163_177_198_/_0.55)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/88 " +
          "md:-mx-6 md:px-6"
        }
      >
        <div className="mb-3 h-1 w-10 rounded-full bg-accent shadow-neu-sm" aria-hidden />
        <header>
          <h1 className="page-title">Admin dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {tab === "accounts"
              ? "Provision staff logins with immediate access — no email verification step."
              : "Live event status, sold units, and revenue."}
          </p>
        </header>

        <div className="mt-5 max-w-full overflow-x-auto pb-0.5">
          <div
            className="inline-flex w-fit max-w-full gap-1 rounded-2xl p-1 shadow-neu-inset"
            role="tablist"
            aria-label="Dashboard sections"
          >
            {TAB_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={cn(
                  "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-all duration-neu",
                  tab === id
                    ? "font-semibold text-foreground shadow-neu-sm"
                    : "font-medium text-muted hover:text-foreground",
                )}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-6">
        {tab === "events" && (
          <div className="grid gap-4">
            {events.map((ev) => (
              <div key={ev.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{ev.name}</h3>
                    <p className="text-sm text-muted">
                      {ev.status} · go-live {new Date(ev.goLiveAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ev.status === "locked" && (
                      <>
                        <Link
                          href={`/admin/events/${ev.id}/edit`}
                          className="btn-primary inline-flex items-center justify-center no-underline"
                        >
                          Edit details
                        </Link>
                        <button type="button" onClick={() => force(ev.id, "force-open")} className="btn-ghost ">
                          Force open
                        </button>
                      </>
                    )}
                    {ev.status === "live" && (
                      <button type="button" onClick={() => force(ev.id, "force-close")} className="btn-danger">
                        Force close
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <Metric label="Units sold" value={ev.totalUnitsSold.toLocaleString()} />
                  <Metric label="Revenue" value={formatLkr(ev.totalRevenueCents)} />
                  <Metric label="Items" value={String(ev.items.length)} />
                  <Metric
                    label="Remaining"
                    value={String(
                      ev.items.reduce(
                        (s, i) => s + Math.max(i.stockQuantity - i.reservedStock - i.soldCount, 0),
                        0,
                      ),
                    )}
                  />
                </div>
                <div className="table-wrap mt-4">
                  <table className="table-neu w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Stock</th>
                        <th>Reserved</th>
                        <th>Sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.items.map((i) => (
                        <tr key={i.id} className="table-neu-row">
                          <td>{i.name}</td>
                          <td>{i.stockQuantity}</td>
                          <td>{i.reservedStock}</td>
                          <td>{i.soldCount}</td>
                          <td>{formatLkr(i.revenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "insights" && analytics && <SalesInsights data={analytics} />}

        {tab === "accounts" && (
          <div className="space-y-8">
            <div className="card p-5 md:p-6">
              <h2 className="section-title">New administrator</h2>
              <p className="mt-1 text-sm text-muted">Minimum 8 characters. Account is active immediately.</p>
              <form onSubmit={onCreateAdmin} className="mt-6 grid max-w-xl gap-4">
                <FormField label="Email">
                  <input
                    className="input"
                    type="email"
                    required
                    autoComplete="off"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </FormField>
                <FormField label="Display name">
                  <input
                    className="input"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </FormField>
                <FormField label="Password" hint="Share credentials securely outside this app.">
                  <input
                    className="input"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </FormField>
                {adminError && <p className="alert-error">{adminError}</p>}
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={adminBusy}>
                  {adminBusy ? "Creating…" : "Create admin account"}
                </button>
              </form>
            </div>

            <div>
              <h2 className="section-title mb-4">Administrators</h2>
              {adminsLoading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : admins.length === 0 ? (
                <EmptyPanel
                  message="No administrators yet."
                  detail="Create the first account above, or seed your database with an initial admin."
                />
              ) : (
                <div className="table-wrap overflow-hidden rounded-neu-sm shadow-neu-inset-deep">
                  <table className="table-neu w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((a) => (
                        <tr key={a.id} className="table-neu-row">
                          <td className="font-medium">{a.displayName}</td>
                          <td className="text-muted">{a.email}</td>
                          <td>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-neu-inset-sm",
                                a.status === "active" ? "bg-accent-soft text-accent-dark" : "bg-surface text-muted",
                              )}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "revenue";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 shadow-neu-sm transition-shadow duration-neu hover:shadow-neu-hover",
        accent === "revenue" ? "bg-surface ring-1 ring-accent/20" : "bg-surface",
      )}
    >
      <div
        className={cn(
          "mb-3 h-1 w-11 rounded-full shadow-neu-sm",
          accent === "revenue" ? "bg-accent" : "bg-black/25",
        )}
        aria-hidden
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-extrabold tracking-tight", accent === "revenue" && "text-accent-dark")}>
        {value}
      </p>
    </div>
  );
}

function SalesInsights({ data }: { data: AdminAnalytics }) {
  const { totals, topByUnits, topByRevenue, eventsByRevenue } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Confirmed orders" value={totals.confirmedOrders.toLocaleString()} />
        <KpiCard label="Total revenue" value={formatLkr(totals.totalRevenueCents)} accent="revenue" />
        <KpiCard label="Units sold" value={totals.totalUnitsSold.toLocaleString()} />
        <KpiCard label="Events (total / live)" value={`${totals.eventsTotal} / ${totals.eventsLive}`} />
        <KpiCard label="SKUs listed" value={totals.uniqueItemsListed.toLocaleString()} />
      </div>

      <InsightTable
        title="Top SKUs by units"
        subtitle="Confirmed orders only."
        rows={topByUnits}
        empty="No sales yet."
      />
      <InsightTable
        title="Top SKUs by revenue"
        subtitle="Confirmed orders only."
        rows={topByRevenue}
        empty="No sales yet."
      />
      <div className="card p-5">
        <h2 className="section-title">Events by revenue</h2>
        <p className="mt-1 text-sm text-muted">Ranked by confirmed order revenue.</p>
        <div className="mt-5">
          {eventsByRevenue.length === 0 ? (
            <EmptyPanel message="No revenue recorded yet." detail="Rankings appear after customers complete checkout." />
          ) : (
            <div className="table-wrap">
              <table className="table-neu w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Units</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsByRevenue.map((r) => (
                    <tr key={r.eventId} className="table-neu-row">
                      <td>{r.eventName}</td>
                      <td className="capitalize">{r.status}</td>
                      <td>{r.unitsSold.toLocaleString()}</td>
                      <td>{formatLkr(r.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="rounded-2xl px-6 py-10 text-center shadow-neu-inset">
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function InsightTable({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: SkuRow[];
  empty: string;
}) {
  return (
    <div className="card p-5">
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-5">
        {rows.length === 0 ? (
          <EmptyPanel message={empty} detail="Sell-through and revenue will show here once orders confirm." />
        ) : (
          <div className="table-wrap">
            <table className="table-neu w-full text-left text-sm">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Event</th>
                  <th>Units</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.itemId} className="table-neu-row">
                    <td>{r.itemName}</td>
                    <td className="text-muted">{r.eventName}</td>
                    <td>{r.unitsSold.toLocaleString()}</td>
                    <td>{formatLkr(r.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

