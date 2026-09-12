import {
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Scan,
  Shirt,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The app's navigation, defined once and used by BOTH the desktop sidebar and
 * the mobile bottom bar. Adding a page later means editing only this file.
 *
 * `phase` is just a note for us during development - it does not affect the UI.
 * `soon: true` greys the link out until we build that page, so the nav looks
 * complete from day one without leading to broken screens.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  phase: number;
  soon?: boolean;
  /** Shown in the mobile bottom bar (max 5 fit comfortably). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, phase: 1, primary: true },
  { href: "/closet", label: "My Closet", icon: Shirt, phase: 2, soon: true, primary: true },
  { href: "/storage", label: "Storage Finder", icon: MapPin, phase: 2, soon: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, phase: 3, soon: true, primary: true },
  { href: "/try-on", label: "Fitting Room", icon: Scan, phase: 5, soon: true, primary: true },
  { href: "/steal-the-look", label: "Steal the Look", icon: Sparkles, phase: 5, soon: true },
  { href: "/marketplace", label: "Marketplace", icon: Store, phase: 6, soon: true, primary: true },
  { href: "/swaps", label: "Friend Swaps", icon: Users, phase: 6, soon: true },
];

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);
