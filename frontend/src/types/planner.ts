import type { GarmentListItem, Season, Slot } from "./wardrobe";

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

export interface SlotPick {
  slot: Slot;
  slot_label: string;
  items: GarmentListItem[];
}

export interface TodayPlan {
  weather: Weather | null;
  unavailable: WeatherUnavailable | null;
  picks: SlotPick[];
}
