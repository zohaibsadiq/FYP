import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeatherCard } from "./weather-card";
import type { TodayPlan, Weather } from "@/types/planner";

let plan: TodayPlan;
let pending = false;
let failed = false;
const updateMutate = vi.fn();
let user: { city: string; country_code: string } | undefined = { city: "", country_code: "" };

vi.mock("@/hooks/use-planner", () => ({
  plannerKeys: { all: ["planner"] },
  usePlannerToday: () => ({ data: plan, isPending: pending, isError: failed }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ data: user }),
  useUpdateProfile: () => ({ mutate: updateMutate, isPending: false }),
}));

function weather(overrides: Partial<Weather> = {}): Weather {
  return {
    city: "Lahore",
    country: "PK",
    temp_c: 28,
    feels_like_c: 34,
    high_c: 33,
    low_c: 26,
    humidity: 80,
    wind_kph: 7,
    condition: "Clear",
    description: "clear sky",
    icon: "01d",
    is_day: true,
    rain_chance: 0,
    advice: {
      headline: "Very hot",
      wear: "The lightest and loosest you own.",
      warmth_levels: [1],
      season: "SUMMER",
      take_umbrella: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  updateMutate.mockReset();
  pending = false;
  failed = false;
  user = { city: "", country_code: "" };
  plan = { weather: weather(), unavailable: null };
});

describe("WeatherCard", () => {
  it("shows the temperature, the place and what it looks like outside", () => {
    render(<WeatherCard />);
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("Lahore")).toBeInTheDocument();
    expect(screen.getByText("clear sky")).toBeInTheDocument();
  });

  it("leads with the advice rather than the raw numbers", () => {
    render(<WeatherCard />);
    expect(screen.getByText(/lightest and loosest/i)).toBeInTheDocument();
  });

  it("shows how it feels separately from what the thermometer says", () => {
    render(<WeatherCard />);
    expect(screen.getByText("Feels like")).toBeInTheDocument();
    expect(screen.getByText("34 C")).toBeInTheDocument();
  });

  it("never suggests clothes from the closet", () => {
    render(<WeatherCard />);
    expect(screen.queryByText(/from your closet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /closet/i })).not.toBeInTheDocument();
  });

  it("asks for a city instead of showing a blank box", () => {
    plan = {
      weather: null,
      unavailable: { code: "no_city", reason: "Tell us your city." },
    };
    render(<WeatherCard />);
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
  });

  it("saves the city in upper case country form", async () => {
    plan = {
      weather: null,
      unavailable: { code: "no_city", reason: "Tell us your city." },
    };
    render(<WeatherCard />);

    await userEvent.type(screen.getByLabelText("City"), "  Multan  ");
    await userEvent.clear(screen.getByLabelText("Country"));
    await userEvent.type(screen.getByLabelText("Country"), "pk");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(updateMutate).toHaveBeenCalledWith(
      { city: "Multan", country_code: "PK" },
      expect.anything(),
    );
  });

  it("puts a misspelled city back in the box so it can be corrected", () => {
    user = { city: "Lahor", country_code: "PK" };
    plan = {
      weather: null,
      unavailable: { code: "unknown_city", reason: "That city was not found." },
    };
    render(<WeatherCard />);
    expect(screen.getByLabelText("City")).toHaveValue("Lahor");
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it("does not offer a form for something the reader cannot fix", () => {
    plan = {
      weather: null,
      unavailable: { code: "timeout", reason: "The weather service did not answer in time." },
    };
    render(<WeatherCard />);
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
    expect(screen.getByText(/did not answer in time/i)).toBeInTheDocument();
  });

  it("keeps quiet rather than showing an error box when the whole call fails", () => {
    failed = true;
    const { container } = render(<WeatherCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
