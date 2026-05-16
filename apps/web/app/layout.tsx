import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import { NavBar } from "@/components/NavBar";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SwiftDrop — Flash Sale Marketplace",
  description: "High-concurrency flash sale platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">{children}</main>
        <footer className="mt-20 border-t border-black/5">
          <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted md:px-6">
            SwiftDrop demo build · MailHog inbox at{" "}
            <code className="rounded-xl bg-surface px-2 py-1 shadow-neu-inset-sm">
              http://localhost:8025
            </code>
          </div>
        </footer>
      </body>
    </html>
  );
}
