import {
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Scan,
  Shirt,
  Store,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar, which fits five. */
  primary?: boolean;
  locked?: boolean;
  /** Rendered as visible text beside a locked entry, never as a tooltip. */
  lockedReason?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, primary: true },
  { href: "/closet", label: "My Clothes", icon: Shirt, primary: true },
  { href: "/storage", label: "Where Things Are", icon: MapPin },
  { href: "/plan", label: "My Plans", icon: CalendarDays, primary: true },
  {
    href: "/try-on",
    label: "Try It On",
    icon: Scan,
    primary: true,
    locked: true,
    lockedReason: "Add a photo of yourself to use this",
  },
  { href: "/shop", label: "Sales", icon: Tag, primary: true },
  { href: "/marketplace", label: "Buy and Sell", icon: Store, primary: true },
  { href: "/friends", label: "Borrow from Friends", icon: Users, primary: true },
];

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);
