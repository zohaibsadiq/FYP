"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Handshake,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Store,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AudienceRow } from "@/components/market/audience-row";
import { EnquiryDialog } from "@/components/market/enquiry-dialog";
import { ListingCard } from "@/components/market/listing-card";
import { ReportDialog } from "@/components/market/report-dialog";
import { SellDialog } from "@/components/market/sell-dialog";
import { ChoiceField } from "@/components/form/choice-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-auth";
import { useListings, useMarketStats } from "@/hooks/use-market";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CONDITIONS,
  LISTING_SORTS,
  type Audience,
  type Listing,
  type ListingFilters,
} from "@/types/market";
import { SLOT_LABELS, type Slot } from "@/types/wardrobe";

const TYPING_PAUSE = 350;

const SLOT_CHOICES = (["TOP", "BOTTOM", "FULL_BODY", "OUTERWEAR", "FOOTWEAR", "ACCESSORY"] as Slot[])
  .map((slot) => ({ value: slot, label: SLOT_LABELS[slot] }));

// The three things a buyer does here, in the order they happen.
const HOW_TO_BUY = [
  {
    icon: Search,
    title: "Find something you like",
    body: "Browse by who it is for, or search by name. Every card is a real person's own clothes.",
  },
  {
    icon: MessageCircle,
    title: "Tap Ask to buy",
    body: "A short request goes to the seller. A message is optional. No money changes hands here.",
  },
  {
    icon: Handshake,
    title: "Meet and pay in person",
    body: "If they say yes, you both see each other's details and arrange it between you.",
  },
];

export default function MarketplacePage() {
  const { data: me } = useCurrentUser();

  // Opens on whatever this person usually shops for, until they say otherwise.
  const preferred =
    me?.shopping_for && me.shopping_for !== "EVERYTHING"
      ? (me.shopping_for as Audience)
      : undefined;
  const [touchedAudience, setTouchedAudience] = useState(false);

  const [filters, setFilters] = useState<ListingFilters>({ ordering: "-created_at" });
  const [typed, setTyped] = useState("");
  const [selling, setSelling] = useState(false);
  const [asking, setAsking] = useState<Listing | null>(null);
  const [reporting, setReporting] = useState<Listing | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: typed.trim() || undefined })),
      TYPING_PAUSE,
    );
    return () => clearTimeout(timer);
  }, [typed]);

  const audience = touchedAudience ? filters.audience : (filters.audience ?? preferred);

  const { data: stats } = useMarketStats();
  const {
    data,
    isPending,
    isPlaceholderData,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListings({ ...filters, audience });

  // Results for the previous filter stay in memory while the new ones load,
  // so the page does not jump. They must not be shown as the answer, though:
  // on a slow connection, women's clothes under the Men tab looks like a bug.
  const waiting = isPending || isPlaceholderData;

  const listings = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);
  const total = data?.pages[0]?.count ?? 0;

  function change(patch: Partial<ListingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearAll() {
    setTyped("");
    // The chosen audience survives a clear, the same as the sort order: it is
    // where somebody is browsing, not a filter they switched on.
    setFilters({ ordering: "-created_at", audience });
    setTouchedAudience(true);
  }

  function changeAudience(next: Audience | "") {
    setTouchedAudience(true);
    setFilters((current) => ({ ...current, audience: next || undefined }));
  }

  const activeCount = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "ordering" &&
      key !== "audience" &&
      value !== undefined &&
      value !== "" &&
      value !== false,
  ).length;

  return (
    <div className="relative mx-auto max-w-7xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-3/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">From people like you</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Buy and Sell
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Clothes other people are selling. Money is never handled here: you agree with
            each other and settle it yourselves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/marketplace/selling"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2 px-5")}
          >
            <Tag className="size-4" aria-hidden />
            My selling and requests
          </Link>
          <Button
            type="button"
            onClick={() => setSelling(true)}
            className="h-11 gap-2 px-5 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-5" aria-hidden />
            Sell something
          </Button>
        </div>
      </header>

      <HowItWorks />

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:120ms]">
        <AudienceRow value={audience ?? ""} onChange={changeAudience} />
      </div>

      <MyBits stats={stats} />

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both space-y-3 rounded-2xl border border-border bg-card p-3 duration-500 [animation-delay:180ms] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label htmlFor="market-search" className="sr-only">
              Search what is for sale
            </Label>
            <div className="relative flex">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="market-search"
                type="search"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Search what is for sale, like: kurta"
                className="h-12 rounded-full border-transparent bg-muted/60 pl-12 pr-12 focus-visible:border-ring focus-visible:bg-card"
              />
              {typed ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setTyped("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full"
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Clear the search box</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* The dropdown keeps its label for screen readers; on screen the
              word in front of it says what it does. */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">Order by</span>
            <div className="min-w-44 flex-1 [&_label]:sr-only">
              <ChoiceField
                id="market-sort"
                label="Order by"
                choices={LISTING_SORTS}
                value={filters.ordering ?? LISTING_SORTS[0].value}
                onChange={(ordering) => change({ ordering: ordering ?? LISTING_SORTS[0].value })}
              />
            </div>
          </div>
        </div>

        <Filters filters={filters} onChange={change} onClear={clearAll} activeCount={activeCount} />
      </div>

      <section>
        <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
          {waiting
            ? "Looking..."
            : `${total.toLocaleString("en-US")} ${total === 1 ? "thing" : "things"} for sale`}
        </p>

        {/* Keyed on the chosen audience so switching Everyone/Women/Men/Kids
            eases the new results in instead of snapping to them. */}
        <div
          key={audience ?? "all"}
          aria-busy={waiting}
          className="duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          {isError ? (
            <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              {getErrorMessage(error, "The marketplace could not be loaded. Try again shortly.")}
            </p>
          ) : waiting ? (
            <LoadingGrid />
          ) : listings.length === 0 ? (
            <NothingHere activeCount={activeCount} onClear={clearAll} onSell={() => setSelling(true)} />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing, index) => (
                  <li
                    key={listing.id}
                    className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                    style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
                  >
                    <ListingCard listing={listing} onAsk={setAsking} onReport={setReporting} />
                  </li>
                ))}
              </ul>

              {hasNextPage ? (
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="h-11 rounded-full px-8"
                  >
                    {isFetchingNextPage ? "Loading more..." : "Show more"}
                  </Button>
                </div>
              ) : (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  That is everything for sale right now.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <SellDialog open={selling} onOpenChange={setSelling} />
      {/* Keyed on the listing, so each one opens with an empty box instead of
          the last one's words. */}
      <EnquiryDialog
        key={`ask-${asking?.id ?? "none"}`}
        listing={asking}
        onClose={() => setAsking(null)}
        onSent={() => toast.success("Your request has been sent.")}
      />
      <ReportDialog
        key={`report-${reporting?.id ?? "none"}`}
        listing={reporting}
        onClose={() => setReporting(null)}
        onSent={() => toast.success("Thank you. Somebody will look at it.")}
      />
    </div>
  );
}

/** The three steps of buying, so nobody has to guess what a request does. */
function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-3/10 p-5 duration-500 [animation-delay:60ms] sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 id="how-heading" className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Find it, ask, meet. The app never touches the money.
          </h2>
        </div>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {HOW_TO_BUY.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[0.7rem] text-muted-foreground">Step {index + 1}</span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The seller-side summary, and the link into it. */
function MyBits({ stats }: { stats?: { my_listings: number; enquiries_waiting_on_me: number; my_enquiries_answered: number } }) {
  if (!stats) return null;
  const nothingYet =
    stats.my_listings === 0 && stats.enquiries_waiting_on_me === 0 && stats.my_enquiries_answered === 0;
  if (nothingYet) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm duration-500">
      {stats.enquiries_waiting_on_me > 0 ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 font-medium text-primary-foreground shadow-md shadow-primary/20">
          <Bell className="size-4" aria-hidden />
          {stats.enquiries_waiting_on_me}{" "}
          {stats.enquiries_waiting_on_me === 1 ? "person is" : "people are"} waiting on your answer
        </span>
      ) : null}
      {stats.my_listings > 0 ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-muted-foreground">
          <Tag className="size-4 text-primary" aria-hidden />
          {stats.my_listings} of yours {stats.my_listings === 1 ? "is" : "are"} up for sale
        </span>
      ) : null}
      {stats.my_enquiries_answered > 0 ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-muted-foreground">
          <Check className="size-4 text-primary" aria-hidden />
          {stats.my_enquiries_answered} of your requests {stats.my_enquiries_answered === 1 ? "was" : "were"} accepted
        </span>
      ) : null}

      <Link
        href="/marketplace/selling"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto h-9 gap-2 rounded-full")}
      >
        <Tag className="size-4" aria-hidden />
        My selling and requests
      </Link>
    </div>
  );
}

function Filters({
  filters,
  onChange,
  onClear,
  activeCount,
}: {
  filters: ListingFilters;
  onChange: (patch: Partial<ListingFilters>) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const chip = (on: boolean) =>
    cn(
      "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200",
      "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      on
        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
        : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
    );

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ near_me: !filters.near_me, city: undefined })}
          aria-pressed={Boolean(filters.near_me)}
          className={chip(Boolean(filters.near_me))}
        >
          <MapPin className="size-4" aria-hidden />
          In my city
        </button>

        {CONDITIONS.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() =>
              onChange({ condition: filters.condition === choice.value ? undefined : choice.value })
            }
            aria-pressed={filters.condition === choice.value}
            className={chip(filters.condition === choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ChoiceField
          id="market-slot"
          label="Where it is worn"
          choices={SLOT_CHOICES}
          clearLabel="Anywhere"
          value={filters.slot || null}
          onChange={(value) => onChange({ slot: (value as Slot) ?? undefined })}
        />

        <div className="space-y-2">
          <Label htmlFor="market-city">City</Label>
          <Input
            id="market-city"
            value={filters.city ?? ""}
            onChange={(event) =>
              onChange({ city: event.target.value || undefined, near_me: undefined })
            }
            placeholder="Any city"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="market-size">Size</Label>
          <Input
            id="market-size"
            value={filters.size ?? ""}
            onChange={(event) => onChange({ size: event.target.value || undefined })}
            placeholder="Any size"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="market-max">Highest price</Label>
          <Input
            id="market-max"
            type="number"
            inputMode="numeric"
            min={0}
            value={filters.max_price ?? ""}
            onChange={(event) =>
              onChange({ max_price: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder="Any"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onClear}
        disabled={activeCount === 0}
        className="h-10 w-full rounded-full sm:w-auto sm:px-5"
      >
        {activeCount === 0
          ? "No filters are on"
          : `Clear ${activeCount} ${activeCount === 1 ? "filter" : "filters"}`}
      </Button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="aspect-3/4 w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function NothingHere({
  activeCount,
  onClear,
  onSell,
}: {
  activeCount: number;
  onClear: () => void;
  onSell: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Store className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">
        {activeCount > 0 ? "Nothing matched" : "Nobody is selling anything yet"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {activeCount > 0
          ? "Try turning off a filter or two."
          : "Be the first. Anything in your closet can go up for sale in a few taps."}
      </p>
      <Button
        type="button"
        variant={activeCount > 0 ? "outline" : "default"}
        onClick={activeCount > 0 ? onClear : onSell}
        className={cn("mt-4 h-11 rounded-full px-5", activeCount === 0 && "shadow-lg shadow-primary/20")}
      >
        {activeCount > 0 ? "Clear the filters" : "Sell something"}
      </Button>
    </div>
  );
}
