"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/auth";

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
    return null; // redirect is in flight
  }

  return <>{children}</>;
}
