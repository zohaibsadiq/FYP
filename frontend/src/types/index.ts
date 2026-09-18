// A field added to a serializer belongs here in the same commit.

/** Which part of a clothes shop to open on. Not a claim about anybody. */
export const SHOPPING_FOR = ["WOMEN", "MEN", "KIDS", "EVERYTHING"] as const;
export type ShoppingFor = (typeof SHOPPING_FOR)[number];

export const SHOPPING_FOR_LABELS: Record<ShoppingFor, string> = {
  WOMEN: "Women's clothes",
  MEN: "Men's clothes",
  KIDS: "Children's clothes",
  EVERYTHING: "Everything",
};

export interface User {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  city: string;
  country_code: string;
  /** Which clothes to show first. Every page can still be switched. */
  shopping_for: ShoppingFor;
  /** Given to one person only, when a sale is agreed. Never listed publicly. */
  phone: string;
  body_photo_url: string;
  has_body_photo: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

/** What POST /api/auth/login/ and /register/ return. */
export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  full_name: string;
  password: string;
  password_confirm: string;
  city?: string;
  country_code?: string;
  shopping_for?: ShoppingFor;
}

/** Envelope around every list endpoint; page size is set in settings.py. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  /** True when nothing matched what was typed and these are the nearest spellings. */
  spelling_guessed?: boolean;
}

/** Validation errors arrive as {"field_name": ["message", ...]}. */
export type ApiFieldErrors = Record<string, string[] | string>;
