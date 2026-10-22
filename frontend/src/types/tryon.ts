export type TryOnStatus = "PENDING" | "READY" | "FAILED";

export interface TryOn {
  id: number;
  /** The closet garment, when there is one. Null for an upload that was not kept. */
  item: number | null;
  /** Recorded when the picture was made, so it survives the garment changing. */
  garment_name: string;
  garment_image_url: string;
  garment_slot: string;
  garment_slot_label: string;
  status: TryOnStatus;
  status_label: string;
  result_url: string;
  /** A sentence to show the owner. Never a stack trace. */
  error: string;
  created_at: string;
  completed_at: string | null;
}

export interface BodyPhotoState {
  has_body_photo: boolean;
  body_photo_url: string;
  consented_at: string | null;
}

export interface TryOnAvailability {
  available: boolean;
  has_body_photo: boolean;
  daily_limit: number;
  used_today: number;
  left_today: number;
}

/** Slots the supplier can draw. Mirrors GARMENT_FIELD in apps/tryon/providers.py. */
export const WEARABLE_SLOTS = ["TOP", "BOTTOM", "OUTERWEAR", "FULL_BODY"] as const;

/** Asked only for an uploaded photo. A closet garment answers it by its category. */
export const UPLOAD_SLOTS = [
  { value: "TOP", label: "Top half" },
  { value: "BOTTOM", label: "Bottom half" },
  { value: "FULL_BODY", label: "Full outfit" },
] as const;

export type UploadSlot = (typeof UPLOAD_SLOTS)[number]["value"];
