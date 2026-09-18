"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Lightbulb, Plus, Search, Shirt, X } from "lucide-react";
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
import { SLOT_LABELS, type Slot } from "@/types/wardrobe";

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

export default function ClosetPage() {
  const [chosenView, setView] = useState<View>("ALL");
  const [search, setSearch] = useState("");

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
    }),
    [view, search],
  );

  const { data, isPending, isError, error } = useGarments(filters);

  const markWorn = useMarkWorn();
  const toggleLaundry = useToggleLaundry();
  const toggleFavorite = useToggleFavorite();

  const items = data?.results ?? [];
  const isFiltering = view !== "ALL" || search.trim().length > 0;
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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Clothes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
              className="h-11 gap-2"
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
            className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5")}
          >
            <Plus className="size-5" aria-hidden />
            Add an item
          </Link>
        </div>
      </div>

      {showControls && (
        <>
          <div>
            <Label htmlFor="closet-search" className="mb-2 block">
              Search your clothes
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="closet-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try: blue shirt"
                className="pl-11"
              />
              {search ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Clear the search box</span>
                </Button>
              ) : null}
            </div>
          </div>

          {!closetIsEmpty ? (
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <div className="flex gap-2 pb-1">
              {SLOT_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  variant={view === tab.value ? "default" : "outline"}
                  onClick={() => setView(tab.value)}
                  aria-pressed={view === tab.value}
                  className="shrink-0"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
          ) : null}
        </>
      )}

      <div key={view} className="space-y-6 duration-200 animate-in fade-in slide-in-from-bottom-1">
        {view === "GONE" ? (
          <GoneList search={search.trim()} />
        ) : isError ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {getErrorMessage(error, "Your clothes could not be loaded just now.")}
          </p>
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
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
                className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Nothing is spelled <strong>{search.trim()}</strong>. These look closest.
                </span>
              </p>
            ) : isFiltering ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Showing {data?.count} of {stats?.total ?? data?.count}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
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
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
