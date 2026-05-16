"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loaded } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    if (!me || me.role !== "admin") {
      router.replace("/login");
    }
  }, [me, loaded, router]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted">
        Checking permissions…
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return null;
  }

  return (
    <div className="relative min-w-0">
      <Suspense
        fallback={
          <div
            className="mb-6 rounded-neu bg-surface/80 p-4 shadow-neu-inset lg:fixed lg:mb-0 lg:h-screen lg:w-56"
            aria-hidden
          />
        }
      >
        <AdminSidebar />
      </Suspense>
      <div className="min-w-0 lg:pl-56">{children}</div>
    </div>
  );
}
