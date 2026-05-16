"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export type Me = {
  id: string;
  email: string;
  displayName: string;
  role: "customer" | "admin";
  status: "pending_verification" | "active" | "deactivated";
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ ok: boolean; user?: Me }>("/api/auth/me");
        setMe(r.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);
  return { me, loaded };
}
