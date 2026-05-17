import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "./providers";

export const metadata: Metadata = {
  title: "Wellness Planner",
  description: "Cycle-aware weekly workout planning",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen font-mono">
        <SessionProvider>
          <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-sm tracking-tight">
              Wellness Planner <span className="text-gray-400 font-normal">MVP</span>
            </span>
            <div className="flex gap-4 text-sm">
              <a href="/plan" className="hover:underline">Weekly Plan</a>
              <a href="/profile" className="hover:underline">Profile</a>
              <a href="/debug" className="hover:underline text-gray-400">Debug</a>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
