"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Store, Tag, X } from "lucide-react";

import { AudienceTabs } from "@/components/shop/audience-tabs";
import { DealCard } from "@/components/shop/deal-card";
import { FilterPanel } from "@/components/shop/filter-panel";
import { FreshnessBar } from "@/components/shop/freshness-bar";
import { ChoiceField } from "@/components/form/choice-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeals, useFilterOptions, useFreshness } from "@/hooks/use-shopping";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, type Audience, type DealFilters } from "@/types/shopping";

// Long enough that typing a word does not send a request per letter, short
// enough that the grid does not feel stuck.
const TYPING_PAUSE = 350;

const STARTING_FILTERS: DealFilters = { on_sale: true, ordering: "-discount_percent" };

// Filters whose default is on, so the reset button does not count them as
// something the person switched on themselves.
const BY_DEFAULT = new Set(["on_sale", "ordering", "audience"]);

export default function ShopPage() {
  const { data: me } = useCurrentUser();

  // Opens on whatever this person usually shops for. "Everything" and a
  // profile that has not loaded both mean no narrowing, which is the safe
  // way round: showing too much is recoverable, hiding things is not.
  const preferred =
    me?.shopping_for && me.shopping_for !== "EVERYTHING"
      ? (me.shopping_for as Audience)
      : undefined;
  const [touchedAudience, setTouchedAudience] = useState(false);

  const [filters, setFilters] = useState<DealFilters>(STARTING_FILTERS);
  const [typed, setTyped] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: typed.trim() || undefined })),
      TYPING_PAUSE,
    );
    return () => clearTimeout(timer);
  }, [typed]);

  const audience = touchedAudience ? filters.audience : (filters.audience ?? preferred);

  const { data: freshness } = useFreshness();
  const { data: options } = useFilterOptions();
  const {
    data,
    isPending,
    isPlaceholderData,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDeals({ ...filters, audience });

  // Results for the previous filter stay in memory while the new ones load,
  // so the page does not jump. They must not be shown as the answer, though:
  // on a slow connection, women's clothes under the Men tab looks like a bug.
  const waiting = isPending || isPlaceholderData;

  const deals = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);
  const total = data?.pages[0]?.count ?? 0;

  const activeCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) =>
          !BY_DEFAULT.has(key) && value !== undefined && value !== "" && value !== false,
      ).length,
    [filters],
  );

  function change(patch: Partial<DealFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearAll() {
    setTyped("");
    setFilters((current) => ({ ...STARTING_FILTERS, audience: current.audience }));
  }

  function changeAudience(audience: Audience | "") {
    setTouchedAudience(true);
    // The narrower filters are dropped on purpose. A size or a colour that
    // exists in menswear may not exist in the children's range, and a page
    // that goes empty on a tap looks broken.
    setFilters((current) => ({
      ...STARTING_FILTERS,
      ordering: current.ordering,
      search: current.search,
      audience: audience || undefined,
    }));
  }

  const nothingLoaded = (freshness?.deals_listed ?? 0) === 0;

  return (
    <div className="relative mx-auto max-w-7xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-5/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">Reduced right now</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Sales
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            What is reduced right now at {freshness?.shops_total ?? "several"} shops, read
            from what each shop publishes. Tap anything to buy it on the shop&apos;s own site.
          </p>
        </div>

        {freshness && freshness.deals_on_sale > 0 ? (
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium">
            <Tag className="size-4 text-primary" aria-hidden />
            {freshness.deals_on_sale.toLocaleString("en-US")} things on sale
          </span>
        ) : null}
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:60ms]">
        <FreshnessBar freshness={freshness} />
      </div>

      {nothingLoaded ? (
        <NothingLoadedYet />
      ) : (
        <>
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:120ms]">
            <AudienceTabs
              value={audience ?? ""}
              counts={options?.audiences}
              total={freshness?.deals_listed}
              onChange={changeAudience}
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl border border-border bg-card p-3 duration-500 [animation-delay:180ms] sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Label htmlFor="deal-search" className="sr-only">
                  Search the sales
                </Label>
                <div className="relative flex">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="deal-search"
                    type="search"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    placeholder="Search the sales, like: navy kurta"
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
                <div className="min-w-48 flex-1 [&_label]:sr-only">
                  <ChoiceField
                    id="deal-sort"
                    label="Order by"
                    choices={SORT_OPTIONS}
                    value={filters.ordering ?? SORT_OPTIONS[0].value}
                    onChange={(ordering) =>
                      change({ ordering: ordering ?? SORT_OPTIONS[0].value })
                    }
                  />
                </div>
              </div>

              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-2 rounded-full px-4 lg:hidden"
                    >
                      <SlidersHorizontal className="size-4" aria-hidden />
                      Filters
                      {activeCount > 0 ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          {activeCount}
                        </span>
                      ) : null}
                    </Button>
                  }
                />
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle className="font-display text-xl font-semibold tracking-tight">
                      Filters
                    </SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-6">
                    <FilterPanel
                      filters={filters}
                      options={options}
                      onChange={change}
                      onClear={clearAll}
                      activeCount={activeCount}
                    />
                    <Button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="mt-6 h-11 w-full shadow-lg shadow-primary/20"
                    >
                      Show {total.toLocaleString("en-US")}{" "}
                      {total === 1 ? "result" : "results"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="mt-3">
              <QuickChips filters={filters} onChange={change} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4">
                <FilterPanel
                  filters={filters}
                  options={options}
                  onChange={change}
                  onClear={clearAll}
                  activeCount={activeCount}
                />
              </div>
            </aside>

            <section>
              <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                {waiting
                  ? "Looking..."
                  : `${total.toLocaleString("en-US")} ${total === 1 ? "thing" : "things"} found`}
              </p>

              {/* Keyed on the chosen audience so switching Men/Women/Kids eases
                  the new results in rather than swapping them in one frame. */}
              <div
                key={audience ?? "all"}
                aria-busy={waiting}
                className="duration-200 animate-in fade-in slide-in-from-bottom-1"
              >
                {isError ? (
                  <p
                    role="alert"
                    className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
                  >
                    {getErrorMessage(error, "The sales could not be loaded. Try again shortly.")}
                  </p>
                ) : waiting ? (
                  <LoadingGrid />
                ) : deals.length === 0 ? (
                  <NothingMatched onClear={clearAll} activeCount={activeCount} />
                ) : (
                  <>
                    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                      {deals.map((deal, index) => (
                        <li
                          key={deal.id}
                          className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                          style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
                        >
                          <DealCard deal={deal} />
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
                        That is everything that matched.
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** One tap for the things people ask for most, without opening the panel. */
function QuickChips({
  filters,
  onChange,
}: {
  filters: DealFilters;
  onChange: (patch: Partial<DealFilters>) => void;
}) {
  const chips = [
    {
      label: "Half price or better",
      on: filters.min_discount === 50,
      toggle: () => onChange({ min_discount: filters.min_discount === 50 ? undefined : 50 }),
    },
    {
      label: "Under Rs 2,000",
      on: filters.max_price === 2000,
      toggle: () => onChange({ max_price: filters.max_price === 2000 ? undefined : 2000 }),
    },
    {
      label: "In stock only",
      on: Boolean(filters.in_stock),
      toggle: () => onChange({ in_stock: !filters.in_stock }),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.toggle}
          aria-pressed={chip.on}
          className={cn(
            // Tall enough to be tapped by a thumb, like every other control here.
            "h-10 rounded-full border px-4 text-sm font-medium transition-all duration-200",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            chip.on
              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="aspect-3/4 w-full rounded-2xl" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function NothingMatched({
  onClear,
  activeCount,
}: {
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Store className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">Nothing matched</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {activeCount > 0
          ? "Try turning off a filter or two."
          : "Try a different word in the search box."}
      </p>
      {activeCount > 0 ? (
        <Button type="button" variant="outline" onClick={onClear} className="mt-4 h-11 rounded-full px-5">
          Clear the filters
        </Button>
      ) : null}
    </div>
  );
}

function NothingLoadedYet() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Store className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">No prices have been loaded yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        The shops are read on a schedule rather than while you wait. Once the first
        refresh has run, everything on sale will show up here.
      </p>
    </div>
  );
}
