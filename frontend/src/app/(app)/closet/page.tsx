"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Heart, Lightbulb, Plus, Search, Shirt, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/wardrobe/empty-state";
import { GoneList } from "@/components/wardrobe/gone-list";
import { ItemCard } from "@/components/wardrobe/item-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGarments,
  useMarkWorn,
  useToggleFavorite,
  useToggleLaundry,
  useWardrobeStats,
} from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SLOT_LABELS, type Slot, type WardrobeStats } from "@/types/wardrobe";

const SLOT_TABS: { value: Slot | "ALL"; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "TOP", label: SLOT_LABELS.TOP },
  { value: "BOTTOM", label: SLOT_LABELS.BOTTOM },
  { value: "FULL_BODY", label: SLOT_LABELS.FULL_BODY },
  { value: "OUTERWEAR", label: SLOT_LABELS.OUTERWEAR },
  { value: "FOOTWEAR", label: SLOT_LABELS.FOOTWEAR },
  { value: "ACCESSORY", label: SLOT_LABELS.ACCESSORY },
];

/**
 * What the page is showing: everything, one sort of thing, or the things that
 * have left the closet for good. "Gone" sits alongside the sorts rather than on
 * a page of its own, because it is the same question - where is my stuff.
 */
type View = Slot | "ALL" | "GONE";

/** How many owned things sit under one tab, once the counts have arrived. */
function countFor(value: Slot | "ALL", stats: WardrobeStats | undefined): number | undefined {
  if (!stats) return undefined;
  if (value === "ALL") return stats.total;
  return (stats.by_slot ?? []).find((row) => row.slot === value)?.count ?? 0;
}

export default function ClosetPage() {
  const [chosenView, setView] = useState<View>("ALL");
  const [search, setSearch] = useState("");
  const [favourites, setFavourites] = useState(false);

  const { data: stats } = useWardrobeStats();
  const goneCount = stats?.gone ?? 0;

  // Bringing the last put-away thing back empties this view and takes its
  // button away with it, which would strand somebody on a page saying nothing
  // has left their closet. Worked out rather than stored, so it corrects itself
  // the moment the count arrives.
  const view: View = chosenView === "GONE" && goneCount === 0 ? "ALL" : chosenView;

  const filters = useMemo(
    () => ({
      ...(view !== "ALL" && view !== "GONE" ? { slot: view } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(favourites ? { is_favorite: true } : {}),
    }),
    [view, search, favourites],
  );

  const { data, isPending, isPlaceholderData, isError, error } = useGarments(filters);

  // Results for the previous filter stay in memory while the new ones load,
  // so the page does not jump. They must not be shown as the answer, though:
  // on a slow connection, clothes for women under the Men tab looks like a bug.
  const waiting = isPending || isPlaceholderData;

  const markWorn = useMarkWorn();
  const toggleLaundry = useToggleLaundry();
  const toggleFavorite = useToggleFavorite();

  const items = data?.results ?? [];
  const isFiltering = view !== "ALL" || favourites || search.trim().length > 0;
  const closetIsEmpty = (stats?.total ?? 0) === 0;

  // Somebody who has sold everything has an empty closet but still needs the
  // way in to what they sold, so that button lives in the header, next to
  // "Add an item", rather than in the row of sorts that an empty closet hides.
  const showControls = !closetIsEmpty || view === "GONE";

  function run(
    action: { mutate: (id: number, opts: object) => void },
    id: number,
    success: string,
  ) {
    action.mutate(id, {
      onSuccess: () => toast.success(success),
      onError: (e: unknown) => toast.error(getErrorMessage(e, "That did not save. Try again.")),
    });
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-2/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">My closet</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">My Clothes</h1>
          <p className="mt-2 text-muted-foreground">
            {stats
              ? `${stats.total} ${stats.total === 1 ? "item" : "items"}, ${stats.in_laundry} in the wash`
              : "Loading your things"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {goneCount > 0 ? (
            <Button
              type="button"
              variant={view === "GONE" ? "default" : "outline"}
              onClick={() => setView(view === "GONE" ? "ALL" : "GONE")}
              aria-pressed={view === "GONE"}
              className="h-11 gap-2 rounded-full px-4"
            >
              <Archive className="size-4" aria-hidden />
              Sold and put away
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  view === "GONE"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {goneCount}
              </span>
            </Button>
          ) : null}

          <Link
            href="/closet/add"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 gap-2 px-5 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5",
            )}
          >
            <Plus className="size-5" aria-hidden />
            Add an item
          </Link>
        </div>
      </header>

      {showControls && (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl border border-border bg-card p-3 duration-500 [animation-delay:80ms] sm:p-4">
          <Label htmlFor="closet-search" className="sr-only">
            Search your clothes
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="closet-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your clothes, like: blue shirt"
              className="h-12 rounded-full border-transparent bg-muted/60 pl-12 pr-12 focus-visible:border-ring focus-visible:bg-card"
            />
            {search ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Clear the search box</span>
              </Button>
            ) : null}
          </div>

          {!closetIsEmpty ? (
            <div className="-mx-3 mt-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
              <div className="flex gap-2 pb-1" role="group" aria-label="Narrow the list">
                <Button
                  type="button"
                  variant={favourites ? "default" : "outline"}
                  onClick={() => setFavourites((on) => !on)}
                  aria-pressed={favourites}
                  className={cn(
                    "h-9 shrink-0 gap-1.5 rounded-full px-4",
                    favourites && "shadow-md shadow-primary/20",
                  )}
                >
                  <Heart className={cn("size-3.5", favourites && "fill-current")} aria-hidden />
                  Favourites
                  {stats ? (
                    <span
                      aria-hidden
                      className={cn(
                        "rounded-full px-1.5 text-[0.7rem] tabular-nums",
                        favourites ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {stats.favorites ?? 0}
                    </span>
                  ) : null}
                </Button>
                <span aria-hidden className="my-1.5 w-px shrink-0 bg-border" />
                {SLOT_TABS.map((tab) => {
                  const selected = view === tab.value;
                  const count = countFor(tab.value, stats);
                  return (
                    <Button
                      key={tab.value}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      onClick={() => setView(tab.value)}
                      aria-pressed={selected}
                      className={cn(
                        "h-9 shrink-0 gap-1.5 rounded-full px-4",
                        selected && "shadow-md shadow-primary/20",
                      )}
                    >
                      {tab.label}
                      {count !== undefined ? (
                        <span
                          aria-hidden
                          className={cn(
                            "rounded-full px-1.5 text-[0.7rem] tabular-nums",
                            selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div key={view} className="space-y-5 duration-300 animate-in fade-in slide-in-from-bottom-1">
        {view === "GONE" ? (
          <div className="space-y-4">
            {/* A plain way out. The button in the header toggles too, but it
                reads as a filter, and an empty closet hides the row of sorts
                that would otherwise lead back. */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setView("ALL")}
              className="-ml-3 h-11 gap-2"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to my clothes
            </Button>

            <h2 className="font-display text-2xl font-semibold tracking-tight">Sold and put away</h2>

            <GoneList search={search.trim()} />
          </div>
        ) : isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {getErrorMessage(error, "Your clothes could not be loaded just now.")}
          </p>
        ) : waiting ? (
          <div aria-busy className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-3/5 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 && closetIsEmpty && goneCount > 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing in your closet right now"
            body="Everything you had has been sold or put away. Bring something back, or add something new."
            action={{ href: "/closet/add", label: "Add an item" }}
            secondary={
              <Button type="button" variant="outline" onClick={() => setView("GONE")}>
                See what is sold and put away
              </Button>
            }
          />
        ) : items.length === 0 && closetIsEmpty ? (
          <EmptyState
            icon={Shirt}
            title="Your closet is empty"
            body="Add the clothes you own. Once they are here, the app can tell you where each one is kept and what goes together."
            steps={[
              "Take a photo of one item on a plain surface.",
              "Upload it. The background is removed for you.",
              "Say where you keep it, like a drawer or a shelf.",
            ]}
            action={{ href: "/closet/add", label: "Add my first item" }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nothing matched"
            body="No clothes match what you picked. Try a different word, or show everything again."
            secondary={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setView("ALL");
                  setFavourites(false);
                }}
              >
                Show everything
              </Button>
            }
          />
        ) : (
          <>
            {data?.spelling_guessed ? (
              <p
                aria-live="polite"
                className="flex items-start gap-2 rounded-xl border border-chart-4/50 bg-chart-4/10 px-4 py-3 text-sm"
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                <span>
                  Nothing is spelled <strong>{search.trim()}</strong>. These look closest.
                </span>
              </p>
            ) : isFiltering ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Showing {data?.count} of {stats?.total ?? data?.count}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                  style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
                >
                  <ItemCard
                    item={item}
                    priority={index < 4}
                    busy={
                      markWorn.isPending ||
                      toggleLaundry.isPending ||
                      toggleFavorite.isPending
                    }
                    onWear={(id) => run(markWorn, id, "Saved. We will remember you wore it today.")}
                    onToggleLaundry={(id) =>
                      run(
                        toggleLaundry,
                        id,
                        item.status === "IN_LAUNDRY" ? "Back in your closet." : "Moved to the wash.",
                      )
                    }
                    onToggleFavorite={(id) => run(toggleFavorite, id, "Saved.")}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
