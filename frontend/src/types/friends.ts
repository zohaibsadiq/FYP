/** Borrow from Friends. Friends are added by code; names are yours alone. */

export type FriendRequestStatus = "SENT" | "ACCEPTED" | "DECLINED";
export type LoanStatus = "ASKED" | "AGREED" | "RETURNED" | "DECLINED" | "CANCELLED";

export interface FriendPerson {
  id: number;
  display_name: string;
  city: string;
}

export interface Friend {
  id: number;
  /** Your own private label for them. They never see it. */
  nickname: string;
  blocked: boolean;
  person: FriendPerson;
  /** Whether THEY have opened their closet to you. */
  shares_closet: boolean;
  items_to_borrow: number;
  created_at: string;
}

export interface FriendRequest {
  id: number;
  from_person: FriendPerson;
  to_person: FriendPerson;
  status: FriendRequestStatus;
  status_label: string;
  created_at: string;
}

/** What a friend is allowed to see. No price, no wear count, no drawer. */
export interface GarmentToBorrow {
  id: number;
  name: string;
  brand: string;
  size: string;
  material: string;
  category_name: string;
  category_slot: string;
  primary_color_hex: string;
  primary_color_name: string;
  display_image_url: string;
  availability: string;
}

export interface LoanItem {
  id: number;
  name: string;
  brand: string;
  size: string;
  category_name: string;
  display_image_url: string;
  primary_color_hex: string;
  primary_color_name: string;
}

export interface Loan {
  id: number;
  item: LoanItem;
  lender: FriendPerson;
  borrower: FriendPerson;
  /** Your own name for whoever is on the other side of this loan. */
  their_name: string;
  status: LoanStatus;
  status_label: string;
  borrow_from: string;
  borrow_until: string;
  message: string;
  is_overdue: boolean;
  days_late: number;
  created_at: string;
  answered_at: string | null;
  returned_at: string | null;
}

export interface MyCode {
  code: string;
  shares_closet: boolean;
}

export interface CircleStats {
  friends: number;
  requests_waiting: number;
  asks_waiting_on_me: number;
  lent_out: number;
  borrowed: number;
  overdue: number;
}

/** Counts of everything sitting unanswered, for the badges in the menu. */
export interface Waiting {
  friend_requests: number;
  borrow_asks: number;
  buy_requests: number;
  /** Things YOU are late giving back. Reported, but left out of `total`. */
  overdue: number;
  total: number;
}
