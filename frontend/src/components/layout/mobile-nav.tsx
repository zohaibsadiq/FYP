"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import { PRIMARY_NAV_ITEMS } from "./nav-items";
import { useWaiting } from "@/hooks/use-friends";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { data: waiting } = useWaiting();

  const counts: Record<string, number> = {
    "/friends": (waiting?.friend_requests ?? 0) + (waiting?.borrow_asks ?? 0),
    "/marketplace": waiting?.buy_requests ?? 0,
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex items-stretch">
        {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon, locked }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              {locked ? (
                <span
                  aria-disabled="true"
                  className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs text-muted-foreground"
                >
                  <span className="relative">
                    <Icon className="size-6" aria-hidden />
                    <Lock
                      className="absolute -right-1.5 -top-1 size-3 rounded-full bg-card"
                      aria-hidden
                    />
                  </span>
                  <span className="text-center leading-tight">{label}</span>
                  <span className="sr-only">(not available yet)</span>
                </span>
              ) : (
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs transition-colors",
                    isActive ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-6" aria-hidden />
                    {counts[href] > 0 ? (
                      <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
                        {counts[href] > 9 ? "9+" : counts[href]}
                        <span className="sr-only">waiting for you</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
