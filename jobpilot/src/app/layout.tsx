// ============================================================
// src/app/layout.tsx
// Root layout — wraps every page in the app.
//
// In Next.js App Router, layout.tsx defines the shared shell
// that persists across page navigations (sidebar, nav, etc.).
// ============================================================

import type { Metadata } from "next";
// Using local geist package (works without internet access)
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { Toaster } from "@/components/ui/toaster";

// Force dynamic rendering — this app is fully authenticated,
// so static generation is never needed.
export const dynamic = "force-dynamic";

// `Metadata` type from Next.js — defines <title>, <description>, etc.
export const metadata: Metadata = {
  title: "JobPilot — Automated Job Applications",
  description:
    "AI-powered job discovery and application system with modular CV lens matching",
};

/**
 * RootLayout is a Server Component (no 'use client' directive).
 * It wraps every page with the HTML shell, sidebar, and toaster.
 *
 * TS concept: `{ children: React.ReactNode }` — a prop type where
 * `children` can be any valid React content (elements, text, null, etc.).
 * `React.ReactNode` is a union type covering all valid JSX values.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` prevents errors from browser extensions
    // that add attributes to the <html> element
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} bg-slate-950 text-slate-100 antialiased`}
      >
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar navigation — always visible on desktop */}
          <SidebarNav />

          {/* Main content area — scrolls independently from sidebar */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Toast notifications — rendered at the root so they overlay everything */}
        <Toaster />
      </body>
    </html>
  );
}
