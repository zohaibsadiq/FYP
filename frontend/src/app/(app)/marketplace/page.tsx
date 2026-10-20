"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Search, Store, Tag, X } from "lucide-react";
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
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useListings({ ...filters, audience });

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
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Buy and Sell</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Clothes other people are selling. Money is never handled here: you agree with
            each other and settle it yourselves.
          </p>
        </div>

        <Button type="button" onClick={() => setSelling(true)} className="h-11 gap-2 px-5">
          <Plus className="size-5" aria-hidden />
          Sell something
        </Button>
      </header>

      <AudienceRow value={audience ?? ""} onChange={changeAudience} />

      <MyBits stats={stats} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-2">
          <Label htmlFor="market-search">Search what is for sale</Label>
          <div className="relative flex">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="market-search"
              type="search"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Try: kurta"
              className="pl-11"
            />
            {typed ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setTyped("")}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Clear the search box</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="sm:w-52">
          <ChoiceField
            id="market-sort"
            label="Order by"
            choices={LISTING_SORTS}
            value={filters.ordering ?? LISTING_SORTS[0].value}
            onChange={(ordering) => change({ ordering: ordering ?? LISTING_SORTS[0].value })}
          />
        </div>
      </div>

      <Filters filters={filters} onChange={change} onClear={clearAll} activeCount={activeCount} />

      <section>
        <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
          {isPending
            ? "Looking..."
            : `${total.toLocaleString("en-US")} ${total === 1 ? "thing" : "things"} for sale`}
        </p>

        {/* Keyed on the chosen audience so switching Everyone/Women/Men/Kids
            eases the new results in instead of snapping to them. */}
        <div
          key={audience ?? "all"}
          className="duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
        {isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {getErrorMessage(error, "The marketplace could not be loaded. Try again shortly.")}
          </p>
        ) : isPending ? (
          <LoadingGrid />
        ) : listings.length === 0 ? (
          <NothingHere activeCount={activeCount} onClear={clearAll} onSell={() => setSelling(true)} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <li key={listing.id}>
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
                  className="h-11 px-8"
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

/** The seller-side summary, and the link into it. */
function MyBits({ stats }: { stats?: { my_listings: number; enquiries_waiting_on_me: number; my_enquiries_answered: number } }) {
  if (!stats) return null;
  const nothingYet =
    stats.my_listings === 0 && stats.enquiries_waiting_on_me === 0 && stats.my_enquiries_answered === 0;
  if (nothingYet) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
      {stats.enquiries_waiting_on_me > 0 ? (
        <span className="font-medium">
          {stats.enquiries_waiting_on_me}{" "}
          {stats.enquiries_waiting_on_me === 1 ? "person is" : "people are"} waiting on your answer
        </span>
      ) : null}
      {stats.my_listings > 0 ? (
        <span className="text-muted-foreground">
          {stats.my_listings} of yours {stats.my_listings === 1 ? "is" : "are"} up for sale
        </span>
      ) : null}
      {stats.my_enquiries_answered > 0 ? (
        <span className="text-muted-foreground">
          {stats.my_enquiries_answered} of your requests {stats.my_enquiries_answered === 1 ? "was" : "were"} accepted
        </span>
      ) : null}

      <Link
        href="/marketplace/selling"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto h-9 gap-2")}
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
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ near_me: !filters.near_me, city: undefined })}
          aria-pressed={Boolean(filters.near_me)}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
            filters.near_me
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-border hover:border-primary hover:bg-accent",
          )}
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
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm transition-colors",
              filters.condition === choice.value
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border hover:border-primary hover:bg-accent",
            )}
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
        className="h-11 w-full sm:w-auto"
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
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
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
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <Store className="mx-auto size-8 text-muted-foreground" aria-hidden />
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
        className="mt-4 h-11"
      >
        {activeCount > 0 ? "Clear the filters" : "Sell something"}
      </Button>
    </div>
  );
}
