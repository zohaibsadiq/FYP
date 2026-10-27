"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  MapPin,
  Plus,
  Scan,
  Shirt,
  WashingMachine,
} from "lucide-react";

import { WeatherCard } from "@/components/planner/weather-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ForgottenItems } from "@/components/wardrobe/forgotten-items";
import { GARMENT_SHAPES } from "@/components/wardrobe/garment-shapes";
import { ItemCard } from "@/components/wardrobe/item-card";
import { RecentWears } from "@/components/wardrobe/recent-wears";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCountUp } from "@/hooks/use-count-up";
import { useGarments, useWardrobeStats } from "@/hooks/use-wardrobe";
import { cn } from "@/lib/utils";
import { SLOT_LABELS, type Slot, type WardrobeStats } from "@/types/wardrobe";

// Each tile carries its own colour, written out in full so the styles exist.
const TILES: {
  stat: keyof WardrobeStats;
  label: string;
  icon: typeof Shirt;
  href: string;
  chip: string;
}[] = [
  { stat: "in_laundry", label: "In the wash", icon: WashingMachine, href: "/closet", chip: "bg-chart-2/15 text-chart-2" },
  { stat: "storage_locations", label: "Places you keep them", icon: MapPin, href: "/storage", chip: "bg-chart-3/15 text-chart-3" },
  { stat: "worn_this_week", label: "Worn this week", icon: CalendarDays, href: "/plan", chip: "bg-chart-4/20 text-chart-4" },
];

const QUICK = [
  { href: "/closet/add", label: "Add an item", icon: Plus, primary: true },
  { href: "/plan", label: "Plan today", icon: CalendarDays },
  { href: "/try-on", label: "Try something on", icon: Scan },
];

const FIRST_STEPS = [
  { icon: Camera, title: "Take a photo", body: "Pick something you wear often, on a plain surface." },
  { icon: MapPin, title: "Say where it lives", body: "The drawer or shelf you keep it in." },
  { icon: Shirt, title: "Watch the closet grow", body: "A few items in, and the app starts earning its keep." },
];

// The pages are built ahead of time, where there is no clock to read. Until
// the browser is running, the greeting is neutral; after that it knows the
// time of day. Null means "not known yet".
const noChanges = () => () => {};
const dayNow = () => new Date().toDateString();
const dayUnknown = () => null;

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const { data: stats, isPending: statsPending } = useWardrobeStats();
  const { data: recent } = useGarments({ ordering: "-created_at" });

  const today = useSyncExternalStore(noChanges, dayNow, dayUnknown);
  const greeting = today ? greetingFor(new Date().getHours()) : "Hello";
  const dateLine = today
    ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const isEmpty = !statsPending && (stats?.total ?? 0) === 0;

  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-80 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/4 top-6 size-64 rounded-full bg-chart-4/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          {dateLine ? (
            <p className="text-sm font-medium text-primary">{dateLine}</p>
          ) : (
            <p className="h-5" aria-hidden />
          )}
          {userPending ? (
            <Skeleton className="mt-2 h-10 w-72" />
          ) : (
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting}, {user?.display_name}
            </h1>
          )}
          <p className="mt-2 text-muted-foreground">
            {isEmpty ? "Let us get your clothes into the app." : "Here is what is in your closet today."}
          </p>
        </div>

        <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
          {QUICK.map(({ href, label, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                buttonVariants({ variant: primary ? "default" : "outline" }),
                "h-11 gap-2 px-4 transition-transform hover:-translate-y-0.5",
                primary && "shadow-lg shadow-primary/20",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:80ms]">
        <WeatherCard />
      </div>

      {statsPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12" aria-busy>
          <Skeleton className="h-56 rounded-2xl sm:col-span-2 lg:col-span-6" />
          <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
        </div>
      ) : isEmpty ? (
        <FirstSteps />
      ) : (
        <>
          <section
            aria-label="Your closet in numbers"
            className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 duration-500 fill-mode-both [animation-delay:160ms] sm:grid-cols-2 lg:grid-cols-12"
          >
            <OwnedTile stats={stats} loading={false} />
            {TILES.map((tile, index) => (
              <StatTile
                key={tile.stat}
                label={tile.label}
                icon={tile.icon}
                href={tile.href}
                chip={tile.chip}
                value={stats?.[tile.stat] as number | undefined}
                loading={false}
                delay={index * 60}
              />
            ))}
          </section>

          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:240ms]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Added recently</p>
                <h2 className="font-display text-2xl font-semibold tracking-tight">The newest things in your closet</h2>
              </div>
              <Link href="/closet" className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex">
                See all my clothes
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recent?.results.slice(0, 4).map((item, index) => (
                <ItemCard key={item.id} item={item} priority={index < 2} />
              ))}
            </div>
            <Link href="/closet" className="mt-4 flex items-center gap-1 text-sm font-medium text-primary sm:hidden">
              See all my clothes
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>

          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-500 fill-mode-both [animation-delay:320ms]">
            <RecentWears />
            <ForgottenItems limit={4} />
          </div>
        </>
      )}
    </div>
  );
}

/** The big tile: how many things are owned, and what they are. */
function OwnedTile({ stats, loading }: { stats: WardrobeStats | undefined; loading: boolean }) {
  const total = useCountUp(stats?.total);
  const slots = (stats?.by_slot ?? []).slice(0, 5);
  const biggest = Math.max(1, ...slots.map((row) => row.count));

  return (
    <Link
      href="/closet"
      className="group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 sm:col-span-2 lg:col-span-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Things you own</p>
          {loading ? (
            <Skeleton className="mt-1 h-11 w-20" />
          ) : (
            <p className="mt-1 font-display text-5xl font-semibold tabular-nums tracking-tight">{total}</p>
          )}
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Shirt className="size-5" aria-hidden />
        </span>
      </div>

      {slots.length > 0 ? (
        <ul className="mt-5 space-y-2" aria-label="By kind">
          {slots.map((row, index) => (
            <li key={row.slot} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground">{SLOT_LABELS[row.slot as Slot] ?? row.slot}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary/70 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.round((row.count / biggest) * 100)}%`, transitionDelay: `${index * 60}ms` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  );
}

function StatTile({
  label,
  icon: Icon,
  href,
  chip,
  value,
  loading,
  delay,
}: {
  label: string;
  icon: typeof Shirt;
  href: string;
  chip: string;
  value: number | undefined;
  loading: boolean;
  delay: number;
}) {
  const shown = useCountUp(value);

  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className="group animate-in fade-in zoom-in-95 flex flex-col justify-between rounded-2xl border border-border bg-card p-5 duration-500 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 lg:col-span-2"
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", chip)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="mt-auto pt-6">
        {loading ? (
          <Skeleton className="h-9 w-12" />
        ) : (
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{shown}</p>
        )}
        <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

/** What a brand new closet shows instead of empty numbers. */
function FirstSteps() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-4/10 p-6 duration-500 fill-mode-both [animation-delay:160ms] sm:p-8">
      <div aria-hidden className="absolute right-6 top-6 hidden gap-3 opacity-60 sm:flex">
        {(["TOP", "BOTTOM", "OUTERWEAR", "FOOTWEAR"] as Slot[]).map((slot, index) => (
          <svg key={slot} viewBox="0 0 100 100" className="animate-float size-16" style={{ animationDelay: `${index * 0.7}s` }}>
            <path d={GARMENT_SHAPES[slot]} className={index % 2 ? "fill-chart-2/60" : "fill-primary/50"} />
          </svg>
        ))}
      </div>

      <p className="text-sm font-medium text-primary">Your closet is empty</p>
      <h2 className="mt-1 max-w-lg font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Start with one item
      </h2>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {FIRST_STEPS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 font-mono text-xs text-muted-foreground">Step {index + 1}</p>
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <Link
        href="/closet/add"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 h-12 gap-2 px-6 shadow-lg shadow-primary/20")}
      >
        <Plus className="size-5" aria-hidden />
        Add my first item
      </Link>
    </section>
  );
}
