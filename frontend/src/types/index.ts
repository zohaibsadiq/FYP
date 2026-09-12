/**
 * TypeScript types that mirror the Django models.
 *
 * RULE for this project: whenever we add a field in Django, we add it here too.
 * That way the editor warns us immediately if the frontend and backend drift
 * apart, instead of us finding out at runtime.
 */

// ---------------------------------------------------------------------------
// Auth / User
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  city: string;
  country_code: string;
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
}

// ---------------------------------------------------------------------------
// Shared API shapes
// ---------------------------------------------------------------------------

/**
 * Every list endpoint in DRF returns this shape because we turned on
 * pagination in settings.py (PAGE_SIZE = 24).
 */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Django validation errors come back as {"field_name": ["message", ...]}.
 * We use this to show the message under the right input box.
 */
export type ApiFieldErrors = Record<string, string[] | string>;
