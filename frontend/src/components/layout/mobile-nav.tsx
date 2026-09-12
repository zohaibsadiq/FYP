"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation bar for phones. Shown only below the `lg` breakpoint.
 *
 * This is the "responsive" half of the design you promised your supervisor:
 * the same app is a sidebar layout on a laptop and a bottom-tab layout on a
 * phone, with no separate mobile codebase.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <ul className="flex items-stretch">
        {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon, soon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              {soon ? (
                <span className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground/40">
                  <Icon className="size-5" />
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
