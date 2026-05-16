import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "SwiftDrop — Flash Sale Marketplace",
  description: "High-concurrency flash sale platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mt-16 border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-zinc-500">
            SwiftDrop demo build · MailHog inbox at{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              http://localhost:8025
            </code>
          </div>
        </footer>
      </body>
    </html>
  );
}
