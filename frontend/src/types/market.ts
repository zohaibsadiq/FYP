import type { Slot } from "./wardrobe";

export type Condition = "NEW" | "LIKE_NEW" | "GOOD" | "WORN";
export type ListingStatus = "ACTIVE" | "RESERVED" | "SOLD" | "WITHDRAWN";
export type Audience = "WOMEN" | "MEN" | "KIDS" | "UNKNOWN";

/** The row across the top of Buy and Sell. "" means everyone. */
export const AUDIENCE_TABS: { value: Audience | ""; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "WOMEN", label: "Women" },
  { value: "MEN", label: "Men" },
  { value: "KIDS", label: "Kids" },
];
export type EnquiryStatus = "SENT" | "ACCEPTED" | "DECLINED" | "CLOSED";

export const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: "NEW", label: "New with tags", hint: "Never worn" },
  { value: "LIKE_NEW", label: "Worn once or twice", hint: "As good as new" },
  { value: "GOOD", label: "Good", hint: "Worn a few times, nothing wrong with it" },
  { value: "WORN", label: "Well worn", hint: "Still wearable, but it shows" },
];

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "NOT_CLOTHING", label: "Not a piece of clothing" },
  { value: "FAKE", label: "Looks fake or stolen" },
  { value: "OFFENSIVE", label: "Offensive picture or wording" },
  { value: "CONTACT", label: "Trying to move the deal off the app" },
  { value: "OTHER", label: "Something else" },
];

/** The garment as a buyer sees it. Deliberately far less than the owner sees. */
export interface GarmentForSale {
  name: string;
  brand: string;
  size: string;
  material: string;
  pattern: string;
  pattern_label: string;
  category_name: string;
  category_slot: Slot;
  display_image_url: string;
  primary_color_hex: string;
  primary_color_name: string;
}

export interface Seller {
  id: number;
  display_name: string;
  city: string;
}

export interface Listing {
  id: number;
  item: GarmentForSale;
  seller: Seller;
  asking_price: string;
  currency: string;
  condition: Condition;
  condition_label: string;
  audience: Audience;
  audience_label: string;
  note: string;
  city: string;
  status: ListingStatus;
  status_label: string;
  created_at: string;
  /** Empty when I have not asked about this one. */
  my_enquiry_status: EnquiryStatus | "";
}

export interface MyListing extends Listing {
  enquiry_count: number;
  waiting_count: number;
  closed_at: string | null;
}

/** Only ever filled in on a request the seller has accepted. */
export interface Contact {
  name: string;
  city: string;
  email: string;
  phone: string;
}

export interface Enquiry {
  id: number;
  listing: Listing;
  buyer: Seller;
  message: string;
  status: EnquiryStatus;
  status_label: string;
  created_at: string;
  answered_at: string | null;
  contact: Contact | null;
}

export interface PriceSuggestion {
  /** Null when nobody recorded what the garment cost. */
  suggested_price: string | null;
  currency: string;
  paid: string | null;
  condition: Condition;
  explanation: string;
}

export interface MarketplaceStats {
  listings_open: number;
  cities: number;
  my_listings: number;
  enquiries_waiting_on_me: number;
  my_enquiries_answered: number;
}

export interface Block {
  id: number;
  blocked: number;
  blocked_name: string;
  created_at: string;
}

export interface ListingFilters {
  search?: string;
  city?: string;
  near_me?: boolean;
  slot?: Slot | "";
  category?: string;
  size?: string;
  color?: string;
  brand?: string;
  condition?: Condition | "";
  audience?: Audience | "";
  min_price?: number;
  max_price?: number;
  ordering?: string;
  page?: number;
}

export const LISTING_SORTS: { value: string; label: string }[] = [
  { value: "-created_at", label: "Newest first" },
  { value: "asking_price", label: "Cheapest first" },
  { value: "-asking_price", label: "Dearest first" },
];

export interface ListingPayload {
  item: number;
  asking_price: string;
  condition: Condition;
  audience?: Audience;
  note?: string;
  city?: string;
}
