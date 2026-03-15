// ============================================================
// src/components/sidebar-nav.tsx
// Dark sidebar navigation with links to all main pages.
// Includes mobile hamburger menu support via Sheet component.
// ============================================================

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GitMerge,
  Briefcase,
  KanbanSquare,
  User,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// NAV ITEMS CONFIGURATION
// TS concept: Array of objects with a specific shape.
// Using `as const` would make it readonly — here we keep it mutable.
// ============================================================

interface NavItem {
  label: string;
  href: string;
  // `React.ComponentType` is a generic type for any React component
  // that accepts SVG props (like lucide-react icons)
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: GitMerge },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Tracker", href: "/tracker", icon: KanbanSquare },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ============================================================
// NAV LINK COMPONENT
// ============================================================

interface NavLinkProps {
  item: NavItem;
  // Optional callback for closing the mobile sheet after navigation
  onNavigate?: () => void;
}

function NavLink({ item, onNavigate }: NavLinkProps) {
  // `usePathname()` returns the current URL path (e.g. "/pipeline")
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

// ============================================================
// SIDEBAR CONTENT (shared between desktop and mobile)
// ============================================================

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const router = useRouter();
  const supabase = createClient();

  // TS concept: `async` event handler — the function is async
  // so we can use `await` inside it
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh(); // Clear Next.js router cache
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo / App name */}
      <div className="flex items-center gap-2 px-4 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Rocket className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">JobPilot</span>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">RJ</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Rahul Jha</p>
            <p className="text-xs text-slate-400 truncate">rjha1909@gmail.com</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-slate-400 hover:text-white"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN SIDEBAR COMPONENT
// ============================================================

export function SidebarNav() {
  // TS concept: `useState<boolean>` — state with explicit type parameter.
  // Without the generic, TypeScript infers the type from the initial value.
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 flex-col border-r border-slate-800 bg-slate-900">
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger button + slide-out sheet */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-4 z-40 text-slate-400"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0 bg-slate-900 border-slate-800">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
