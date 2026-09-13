"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  Moon,
  Shirt,
  Snowflake,
  Sun,
  Umbrella,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useUpdateProfile } from "@/hooks/use-auth";
import { usePlannerToday } from "@/hooks/use-planner";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Weather } from "@/types/planner";

// Built once rather than picked as a component inside render, which would
// remount the icon on every redraw.
const DRAWN = "size-8";
const SKY: Record<string, ReactNode> = {
  Clear: <Sun className={DRAWN} aria-hidden />,
  Clouds: <CloudSun className={DRAWN} aria-hidden />,
  Rain: <CloudRain className={DRAWN} aria-hidden />,
  Drizzle: <CloudRain className={DRAWN} aria-hidden />,
  Thunderstorm: <CloudLightning className={DRAWN} aria-hidden />,
  Snow: <Snowflake className={DRAWN} aria-hidden />,
  Mist: <CloudFog className={DRAWN} aria-hidden />,
  Fog: <CloudFog className={DRAWN} aria-hidden />,
  Haze: <CloudFog className={DRAWN} aria-hidden />,
  Smoke: <CloudFog className={DRAWN} aria-hidden />,
  Dust: <CloudFog className={DRAWN} aria-hidden />,
  Sand: <CloudFog className={DRAWN} aria-hidden />,
};

const CLEAR_NIGHT = <Moon className={DRAWN} aria-hidden />;
const UNKNOWN_SKY = <Cloud className={DRAWN} aria-hidden />;

function skyIcon(weather: Weather): ReactNode {
  if (weather.condition === "Clear" && !weather.is_day) return CLEAR_NIGHT;
  return SKY[weather.condition] ?? UNKNOWN_SKY;
}

export function WeatherCard() {
  const { data: today, isPending, isError } = usePlannerToday();

  if (isError) return null;

  if (isPending) {
    return <Skeleton className="h-44 rounded-2xl" />;
  }

  if (!today.weather) {
    return <NoWeather code={today.unavailable?.code} reason={today.unavailable?.reason} />;
  }

  const weather = today.weather;

  return (
    <section aria-labelledby="weather-heading" className="space-y-4">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border",
          "bg-gradient-to-br from-sky-50 to-indigo-50",
          "dark:from-sky-950/40 dark:to-indigo-950/30",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-6 p-5">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-sky-700 dark:bg-white/10 dark:text-sky-200">
              {skyIcon(weather)}
            </span>

            <div>
              <h2 id="weather-heading" className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums">{weather.temp_c}</span>
                <span className="text-xl text-muted-foreground">C</span>
              </h2>
              <p className="mt-1 text-sm capitalize">{weather.description}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
                {weather.city}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Reading label="Feels like" value={`${weather.feels_like_c} C`} />
            <Reading label="Today" value={`${weather.low_c} to ${weather.high_c} C`} />
            <Reading
              label="Rain"
              value={`${weather.rain_chance}%`}
              icon={weather.rain_chance >= 40 ? Umbrella : Droplets}
            />
            <Reading label="Wind" value={`${weather.wind_kph} kph`} icon={Wind} />
          </dl>
        </div>

        <p className="border-t border-border/60 bg-white/50 px-5 py-3 text-sm dark:bg-black/20">
          <span className="font-semibold">{weather.advice.headline}.</span>{" "}
          {weather.advice.wear}
        </p>
      </div>

      {today.picks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            From your closet, for this weather
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {today.picks.map((group) => (
              <div key={group.slot} className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.slot_label}
                </p>
                <ul className="space-y-1.5">
                  {group.items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/closet/${item.id}`}
                        className="flex items-center gap-2 rounded-lg p-1 text-sm transition-colors hover:bg-accent"
                      >
                        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {item.display_image_url ? (
                            <Image
                              src={item.display_image_url}
                              alt=""
                              fill
                              sizes="36px"
                              className="object-contain p-0.5"
                            />
                          ) : (
                            <Shirt className="size-4 text-muted-foreground" aria-hidden />
                          )}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Reading({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * A missing city is the one cause the reader can fix, so that case gets a form
 * rather than a message.
 */
function NoWeather({ code, reason }: { code?: string; reason?: string }) {
  const { data: user } = useCurrentUser();
  const update = useUpdateProfile();
  const [city, setCity] = useState(user?.city ?? "");
  const [country, setCountry] = useState(user?.country_code ?? "PK");
  const [problem, setProblem] = useState("");

  // The profile may still be loading when this first draws, so a misspelled
  // city would otherwise never appear in the box for correcting.
  const saved = user?.city ?? "";
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setCity(saved);
    setCountry(user?.country_code || "PK");
  }

  const fixable = code === "no_city" || code === "unknown_city";

  if (!fixable) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {reason ?? "The weather could not be fetched just now."}
      </p>
    );
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");
    update.mutate(
      { city: city.trim(), country_code: country.trim().toUpperCase() },
      {
        onError: (error) =>
          setProblem(getErrorMessage(error, "That could not be saved. Try again.")),
      },
    );
  }

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-2xl border border-border bg-muted/30 p-5"
    >
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <CloudSun className="size-5 text-primary" aria-hidden />
          Which city do you live in?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {code === "unknown_city"
            ? reason
            : "Once we know, this box shows today's weather and picks out what to wear for it."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="weather-city" className="mb-2 block">
            City
          </Label>
          <Input
            id="weather-city"
            value={city}
            required
            placeholder="Lahore"
            onChange={(event) => setCity(event.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "weather-city-problem" : undefined}
            className="h-11"
          />
        </div>

        <div className="w-28">
          <Label htmlFor="weather-country" className="mb-2 block">
            Country
          </Label>
          <Input
            id="weather-country"
            value={country}
            maxLength={2}
            placeholder="PK"
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            className="h-11 uppercase"
          />
        </div>

        <Button type="submit" disabled={update.isPending} className="h-11 gap-2 px-5">
          {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>

      {problem ? (
        <p id="weather-city-problem" role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
