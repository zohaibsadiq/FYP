"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Shirt } from "lucide-react";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Shirt className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          Closette
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, locked, lockedReason }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          if (locked) {
            return (
              <div
                key={href}
                aria-disabled="true"
                className="flex items-start gap-3 rounded-lg px-3 py-3 text-sidebar-foreground/60"
              >
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {label}
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">(not available yet)</span>
                  </span>
                  {lockedReason ? (
                    <span className="mt-0.5 block text-xs leading-snug">{lockedReason}</span>
                  ) : null}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
