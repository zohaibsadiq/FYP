// Values mirror the TextChoices in apps/wardrobe/models.py.
export const SLOTS = [
  "TOP",
  "BOTTOM",
  "FULL_BODY",
  "OUTERWEAR",
  "FOOTWEAR",
  "ACCESSORY",
  "HEADWEAR",
  "OTHER",
] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  TOP: "Tops",
  BOTTOM: "Bottoms",
  FULL_BODY: "Full body",
  OUTERWEAR: "Outerwear",
  FOOTWEAR: "Footwear",
  ACCESSORY: "Accessories",
  HEADWEAR: "Headwear",
  OTHER: "Other",
};

export const ITEM_STATUSES = [
  "IN_WARDROBE",
  "IN_LAUNDRY",
  "LENT_OUT",
  "FOR_SALE",
  "SOLD",
  "ARCHIVED",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const SEASONS = ["SUMMER", "WINTER", "SPRING", "AUTUMN"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  SUMMER: "Summer",
  WINTER: "Winter",
  SPRING: "Spring",
  AUTUMN: "Autumn",
};

export const OCCASIONS = [
  "CASUAL",
  "FORMAL",
  "BUSINESS",
  "PARTY",
  "TRADITIONAL",
  "SPORT",
  "LOUNGE",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  CASUAL: "Every day",
  FORMAL: "Formal",
  BUSINESS: "Work",
  PARTY: "Party",
  TRADITIONAL: "Traditional",
  SPORT: "Sport",
  LOUNGE: "At home",
};

export const PATTERNS = ["SOLID", "STRIPED", "CHECKED", "PRINTED", "FLORAL", "OTHER"] as const;
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_LABELS: Record<Pattern, string> = {
  SOLID: "One plain colour",
  STRIPED: "Stripes",
  CHECKED: "Checks",
  PRINTED: "Printed",
  FLORAL: "Flowers",
  OTHER: "Something else",
};

export const STORAGE_KINDS = [
  "ROOM",
  "WARDROBE",
  "CABINET",
  "DRAWER",
  "SHELF",
  "RAIL",
  "HANGER",
  "BOX",
  "SUITCASE",
  "OTHER",
] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

/** Mirrors StorageLocation.MAX_DEPTH in apps/wardrobe/models.py. */
export const MAX_STORAGE_DEPTH = 4;

/**
 * Whether a place at this depth has room for something `levels` deep. A brand
 * new place is 1 level; moving a wardrobe that already holds drawers is more.
 * StorageLocation.clean() rejects anything deeper, so the picker greys these
 * out rather than letting a form be filled in and then refused.
 */
export function hasRoomInside(depth: number, levels = 1): boolean {
  return depth + levels <= MAX_STORAGE_DEPTH - 1;
}

export const STORAGE_KIND_LABELS: Record<StorageKind, string> = {
  ROOM: "Room",
  WARDROBE: "Wardrobe / Closet",
  CABINET: "Cabinet",
  DRAWER: "Drawer",
  SHELF: "Shelf",
  RAIL: "Hanging rail",
  HANGER: "Hanger slot",
  BOX: "Box / Storage bin",
  SUITCASE: "Suitcase",
  OTHER: "Other",
};

export interface Category {
  id: number;
  name: string;
  slot: Slot;
  slot_label: string;
  icon: string;
  sort_order: number;
  is_system: boolean;
  item_count: number;
}

export interface StorageLocation {
  id: number;
  name: string;
  kind: StorageKind;
  kind_label: string;
  parent: number | null;
  full_path: string;
  depth: number;
  notes: string;
  item_count: number;
  created_at: string;
}

/** The nested shape returned by /storage/tree/. */
export interface StorageNode {
  id: number;
  name: string;
  kind: StorageKind;
  kind_label: string;
  notes: string;
  item_count: number;
  children: StorageNode[];
}

/** Trimmed shape the closet grid lists; the detail view uses Garment. */
export interface GarmentListItem {
  id: number;
  name: string;
  brand: string;
  category: number;
  category_name: string;
  category_slot: Slot;
  display_image_url: string;
  primary_color_hex: string;
  primary_color_name: string;
  status: ItemStatus;
  status_label: string;
  is_favorite: boolean;
  /** Off means friends never see this one, even when your closet is shared. */
  is_lendable: boolean;
  storage_location: number | null;
  location_path: string;
  wear_count: number;
  last_worn_date: string | null;
  days_since_worn: number | null;
  /** What the most recent wearing was for, when one was written down. */
  last_worn_note: string;
  purchase_price: string | null;
  currency: string;
  cost_per_wear: number | null;
  created_at: string;
}

export interface Garment extends Omit<GarmentListItem, "category_slot"> {
  size: string;
  material: string;
  pattern: Pattern;
  category_slot: Slot;
  secondary_color_hex: string;
  seasons: Season[];
  occasions: Occasion[];
  warmth_level: number;
  is_waterproof: boolean;
  original_image_url: string;
  clean_image_url: string;
  is_wearable_now: boolean;
  purchase_date: string | null;
  notes: string;
  updated_at: string;
}

/** Response from POST /api/wardrobe/upload/ once rembg has cut the background out. */
export interface ImageUploadResult {
  original_image_url: string;
  original_image_public_id: string;
  clean_image_url: string;
  clean_image_public_id: string;
  detected: {
    primary_color_hex: string;
    primary_color_name: string;
    width: number;
    height: number;
  };
  processing_ms: number;
  coverage: number;
  warning: string | null;
}

export interface GarmentPayload {
  name: string;
  category: number;
  brand?: string;
  size?: string;
  material?: string;
  pattern?: Pattern;
  primary_color_hex?: string;
  primary_color_name?: string;
  seasons?: Season[];
  occasions?: Occasion[];
  warmth_level?: number;
  is_waterproof?: boolean;
  is_lendable?: boolean;
  storage_location?: number | null;
  purchase_price?: string | null;
  currency?: string;
  purchase_date?: string | null;
  notes?: string;
  original_image_url?: string;
  original_image_public_id?: string;
  clean_image_url?: string;
  clean_image_public_id?: string;
}

/** Query params accepted by apps/wardrobe/filters.py. */
export interface GarmentFilters {
  /** Only things sold or put away, which the list otherwise leaves out. */
  gone?: boolean;
  search?: string;
  slot?: Slot;
  category?: number;
  status?: ItemStatus;
  location?: number;
  season?: Season;
  occasion?: Occasion;
  color?: string;
  is_favorite?: boolean;
  no_location?: boolean;
  unworn_days?: number;
  wearable?: boolean;
  has_image?: boolean;
  brand?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface WardrobeStats {
  total: number;
  in_wardrobe: number;
  in_laundry: number;
  /** Sold or put away. Deliberately not part of `total`, which is what you still own. */
  gone: number;
  favorites: number;
  unplaced: number;
  never_worn: number;
  total_spent: number;
  total_wears: number;
  worn_this_week: number;
  not_worn_in_90_days: number;
  storage_locations: number;
  by_slot: { slot: Slot; count: number }[];
}

/** One day an item was worn. At most one per item per day. */
export interface WearEvent {
  id: number;
  item: number;
  item_name: string;
  item_image_url: string;
  item_slot: Slot;
  worn_on: string;
  note: string;
  days_ago: number;
  created_at: string;
}

/** How many things were worn on one day, for drawing a month grid. */
export interface WearDay {
  date: string;
  count: number;
}
