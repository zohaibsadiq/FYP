import type { GarmentListItem, Season } from "./wardrobe";

export interface WeatherAdvice {
  /** A word or two: Mild, Warm, Very hot. */
  headline: string;
  /** A full sentence, already written for the reader. */
  wear: string;
  /** Which warmth_level values on a garment suit today. */
  warmth_levels: number[];
  season: Season;
  take_umbrella: boolean;
}

export interface Weather {
  city: string;
  country: string;
  temp_c: number;
  feels_like_c: number;
  high_c: number;
  low_c: number;
  humidity: number;
  wind_kph: number;
  /** Clear, Clouds, Rain, Drizzle, Thunderstorm, Snow, Mist and so on. */
  condition: string;
  description: string;
  icon: string;
  is_day: boolean;
  /** Percent, over the next day. */
  rain_chance: number;
  advice: WeatherAdvice;
}

/** Why there is no reading. The reason is already a sentence worth showing. */
export interface WeatherUnavailable {
  code: "no_city" | "unknown_city" | "not_configured" | "timeout" | "unreachable" | "rate_limited";
  reason: string;
}

export interface TodayPlan {
  weather: Weather | null;
  unavailable: WeatherUnavailable | null;
}

/** One day in the calendar and the clothes set aside for it. */
export interface PlannedOutfit {
  id: number;
  planned_for: string;
  label: string;
  note: string;
  /** Ids only, which is what a save sends back. */
  items: number[];
  /** The same items with names and pictures, for drawing them. */
  item_details: GarmentListItem[];
  is_confirmed: boolean;
  worn_confirmed_at: string | null;
  /** Negative once the day has passed. */
  days_away: number;
  created_at: string;
  updated_at: string;
}

/** One square of the month grid, without its contents. */
export interface PlanDay {
  date: string;
  label: string;
  item_count: number;
  is_confirmed: boolean;
}

export interface PlanPayload {
  planned_for: string;
  label?: string;
  note?: string;
  items?: number[];
}

export interface ConfirmedPlan {
  recorded: number;
  plan: PlannedOutfit;
}
