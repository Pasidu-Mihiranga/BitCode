import { Suspense } from "react";
import { AdminDashboardInner } from "./dashboard-client";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-muted">Loading…</p>}>
      <AdminDashboardInner />
    </Suspense>
  );
}
