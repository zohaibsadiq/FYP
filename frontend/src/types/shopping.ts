import type { Slot } from "./wardrobe";

export type Audience = "WOMEN" | "MEN" | "KIDS" | "UNKNOWN";

/** The tabs across the top of the page. "" means everything. */
export const AUDIENCE_TABS: { value: Audience | ""; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "WOMEN", label: "Women" },
  { value: "MEN", label: "Men" },
  { value: "KIDS", label: "Kids" },
];

/** One product in one shop, at the price it was last seen at. */
export interface Deal {
  id: number;
  title: string;
  /** The shop's own product page. Opened in a new tab; we never sell anything. */
  url: string;
  image_url: string;
  vendor: string;

  shop_name: string;
  shop_slug: string;
  currency: string;

  /** What the shop calls it, kept exactly as they publish it. */
  shop_category: string;
  category: number | null;
  category_name: string;
  slot: Slot;
  slot_label: string;

  color_name: string;
  color_hex: string;

  /** Who the shop says it is for. UNKNOWN when the shop did not say. */
  audience: Audience;
  audience_label: string;

  price: string;
  /** The price it was cut from. Null when the shop is not calling it a sale. */
  was_price: string | null;
  discount_percent: number;
  saving: string | null;

  sizes: string[];
  in_stock: boolean;

  checked_at: string;
  price_fell_at: string | null;
  just_dropped: boolean;
}

export interface PriceChange {
  price: string;
  was_price: string | null;
  noticed_at: string;
}

export interface ShopStatus {
  id: number;
  name: string;
  slug: string;
  site_url: string;
  currency: string;
  last_checked_at: string | null;
  last_result: "NEVER" | "OK" | "FAILED";
  last_result_label: string;
  deal_count: number;
}

/** How old the prices are. Shown on the page rather than kept quiet. */
export interface Freshness {
  checked_at: string | null;
  is_stale: boolean;
  stale_after_hours: number;
  /** Already written for a reader, e.g. "Prices checked 2 hours ago." */
  summary: string;
  shops_working: number;
  shops_total: number;
  deals_listed: number;
  deals_on_sale: number;
  shops: ShopStatus[];
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface FilterOptions {
  audiences: Facet[];
  slots: Facet[];
  categories: Facet[];
  shops: Facet[];
  colors: Facet[];
  sizes: Facet[];
  price_floor: number;
  price_ceiling: number;
}

export interface DealFilters {
  search?: string;
  audience?: Audience | "";
  slot?: Slot | "";
  category?: string;
  shop?: string;
  color?: string;
  size?: string;
  min_price?: number;
  max_price?: number;
  min_discount?: number;
  on_sale?: boolean;
  in_stock?: boolean;
  just_dropped?: boolean;
  ordering?: string;
  page?: number;
}

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "-discount_percent", label: "Biggest saving" },
  { value: "price", label: "Cheapest first" },
  { value: "-price", label: "Dearest first" },
  { value: "-price_fell_at", label: "Price dropped most recently" },
  { value: "-first_seen_at", label: "Newly added" },
];
