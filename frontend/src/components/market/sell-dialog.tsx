"use client";

import { useState } from "react";
import { Check, Shirt, Sparkles, TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateListing, usePriceSuggestion } from "@/hooks/use-market";
import { useGarments } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AUDIENCE_TABS, CONDITIONS, type Audience, type Condition } from "@/types/market";
import type { GarmentListItem } from "@/types/wardrobe";

/**
 * Offers only wearable items: anything sold, archived or lent out is filtered
 * out before the picker renders. Condition and price are the only fields the
 * closet cannot already answer.
 */
export function SellDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [item, setItem] = useState<GarmentListItem | null>(null);
  const [condition, setCondition] = useState<Condition>("GOOD");
  // Null means "whatever is suggested". It only becomes a string once somebody
  // types their own figure, so the box follows the condition until then
  // without any state having to be kept in step with anything else.
  const [typedPrice, setTypedPrice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [chosenAudience, setChosenAudience] = useState<Audience | null>(null);
  const [problem, setProblem] = useState("");

  const { data: me } = useCurrentUser();

  // Only things actually in the wardrobe. Something already for sale, sold or
  // lent out cannot be offered.
  const { data, isPending } = useGarments({ status: "IN_WARDROBE" });
  const { data: suggestion } = usePriceSuggestion(open ? (item?.id ?? null) : null, condition);
  const create = useCreateListing();

  // Most people sell their own clothes, so their usual section is the
  // starting point. Anybody selling something of a relative's changes it.
  const usual =
    me?.shopping_for && me.shopping_for !== "EVERYTHING"
      ? (me.shopping_for as Audience)
      : "UNKNOWN";
  const audience = chosenAudience ?? usual;

  const suggested = suggestion?.suggested_price
    ? String(Math.round(Number(suggestion.suggested_price)))
    : "";
  const price = typedPrice ?? suggested;

  function reset() {
    setItem(null);
    setCondition("GOOD");
    setTypedPrice(null);
    setNote("");
    setChosenAudience(null);
    setProblem("");
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function submit() {
    if (!item) return;
    setProblem("");
    create.mutate(
      { item: item.id, asking_price: price || "0", condition, audience, note },
      {
        onSuccess: () => close(false),
        onError: (error) =>
          setProblem(getErrorMessage(error, "That could not be listed. Try again.")),
      },
    );
  }

  const wardrobe = data?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <p className="text-xs font-medium text-primary">Step {item ? 2 : 1} of 2</p>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            {item ? "Set your price" : "What are you selling?"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Your photo and details are already on it. Just the price and condition."
              : "Pick something from your own clothes. Tap the one you want to sell."}
          </DialogDescription>
        </DialogHeader>

        <div>
          {!item ? (
            <PickItem items={wardrobe} loading={isPending} onPick={setItem} />
          ) : (
            <div className="space-y-5">
              <Chosen item={item} onChange={() => setItem(null)} />

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">How worn is it?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONDITIONS.map((choice) => {
                    const on = condition === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => setCondition(choice.value)}
                        aria-pressed={on}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200",
                          on
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-primary/5",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                        >
                          {on ? <Check className="size-3" aria-hidden /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className={cn("block", on && "font-medium")}>{choice.label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {choice.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Who would it suit?</legend>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_TABS.filter((tab) => tab.value).map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setChosenAudience(tab.value as Audience)}
                      aria-pressed={audience === tab.value}
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm font-medium transition-all duration-200",
                        audience === tab.value
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="sell-price">Your price</Label>
                <Input
                  id="sell-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={price}
                  onChange={(event) => setTypedPrice(event.target.value)}
                  placeholder="0"
                />
                {suggestion ? (
                  <p className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <span>
                      {suggestion.suggested_price ? (
                        <>
                          We suggest{" "}
                          <span className="font-medium text-foreground">
                            {money(suggestion.suggested_price, suggestion.currency)}
                          </span>
                          {suggestion.paid ? (
                            <> because you paid {money(suggestion.paid, suggestion.currency)}.</>
                          ) : null}{" "}
                          {suggestion.explanation}
                        </>
                      ) : (
                        suggestion.explanation
                      )}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sell-note">Anything a buyer should know</Label>
                <Textarea
                  id="sell-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Slight fade on one sleeve"
                />
                <p className="text-xs text-muted-foreground">
                  Do not put your phone number here. It is shared automatically once you
                  accept a buyer.
                </p>
              </div>

              {problem ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  {problem}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={submit}
                disabled={create.isPending || !price}
                className="h-11 w-full shadow-lg shadow-primary/20"
              >
                {create.isPending ? "Putting it up..." : "Put it up for sale"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                What happens next: buyers ask, you say yes or no to each one, and then
                you arrange the handover yourselves.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickItem({
  items,
  loading,
  onPick,
}: {
  items: GarmentListItem[];
  loading: boolean;
  onPick: (item: GarmentListItem) => void;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading your clothes...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Shirt className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-medium">Nothing to sell yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add some clothes to your closet first, then you can offer them here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="w-full rounded-xl border border-border bg-card p-1.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="relative block aspect-square overflow-hidden rounded-lg bg-gradient-to-b from-muted/80 to-muted/20">
              <GarmentPicture src={item.display_image_url} sizes="100px" className="p-1" iconClassName="size-5" />
            </span>
            <span className="mt-1 block truncate text-xs font-medium">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Chosen({ item, onChange }: { item: GarmentListItem; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-2.5">
      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card">
        <GarmentPicture src={item.display_image_url} sizes="56px" className="p-1" iconClassName="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[item.category_name, item.brand].filter(Boolean).join(" - ")}
        </span>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onChange} className="shrink-0 rounded-full">
        Change
      </Button>
    </div>
  );
}
