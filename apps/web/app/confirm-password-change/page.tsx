import { Suspense } from "react";
import { ConfirmPasswordChangeClient } from "./confirm-password-change-client";

export default function ConfirmPasswordChangePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <div className="card p-6 text-center">
            <p className="text-sm text-zinc-600">Loading…</p>
          </div>
        </div>
      }
    >
      <ConfirmPasswordChangeClient />
    </Suspense>
  );
}
