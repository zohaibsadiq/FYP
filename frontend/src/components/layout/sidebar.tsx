"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt } from "lucide-react";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * Desktop sidebar. Hidden below the `lg` breakpoint, where MobileNav takes over.
 *
 * usePathname() tells us the current URL so we can highlight the active link.
 * That is why this file needs "use client".
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      {/* ---- Logo ---- */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Shirt className="size-4" />
        </span>
        <span className="font-semibold tracking-tight text-sidebar-foreground">Lumiere</span>
      </div>

      {/* ---- Links ---- */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, soon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          // Pages we have not built yet render as a non-clickable row, so the
          // navigation looks complete without producing 404s.
          if (soon) {
            return (
              <div
                key={href}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/35"
                title="Coming in a later phase"
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <span className="rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-accent-foreground/60">
                  soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/40">
          Smart Wardrobe Management System
          <br />
          Final Year Project
        </p>
      </div>
    </aside>
  );
}
