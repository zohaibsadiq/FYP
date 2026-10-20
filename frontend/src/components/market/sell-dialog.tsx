"use client";

import Image from "next/image";
import { useState } from "react";
import { Shirt, TriangleAlert } from "lucide-react";

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Set your price" : "What are you selling?"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Your photo and details are already on it. Just the price and condition."
              : "Pick something from your own clothes."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-6">
          {!item ? (
            <PickItem items={wardrobe} loading={isPending} onPick={setItem} />
          ) : (
            <div className="space-y-5">
              <Chosen item={item} onChange={() => setItem(null)} />

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">How worn is it?</legend>
                <div className="grid gap-2">
                  {CONDITIONS.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setCondition(choice.value)}
                      aria-pressed={condition === choice.value}
                      className={cn(
                        "min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        condition === choice.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:border-primary hover:bg-accent",
                      )}
                    >
                      {choice.label}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {choice.hint}
                      </span>
                    </button>
                  ))}
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
                        "min-h-11 rounded-full border px-4 text-sm transition-colors",
                        audience === tab.value
                          ? "border-primary bg-primary font-medium text-primary-foreground"
                          : "border-border hover:border-primary hover:bg-accent",
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
                  <p className="text-xs text-muted-foreground">
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
                  className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  {problem}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={submit}
                disabled={create.isPending || !price}
                className="h-11 w-full"
              >
                {create.isPending ? "Putting it up..." : "Put it up for sale"}
              </Button>
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
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Shirt className="mx-auto size-7 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">Nothing to sell yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add some clothes to your closet first, then you can offer them here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="w-full rounded-lg border border-border p-1.5 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="relative block aspect-square overflow-hidden rounded bg-muted">
              {item.display_image_url ? (
                <Image
                  src={item.display_image_url}
                  alt=""
                  fill
                  sizes="100px"
                  className="object-contain p-1"
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <Shirt className="size-5 text-muted-foreground" aria-hidden />
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-xs">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Chosen({ item, onChange }: { item: GarmentListItem; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {item.display_image_url ? (
          <Image src={item.display_image_url} alt="" fill sizes="56px" className="object-contain p-1" />
        ) : (
          <Shirt className="size-5 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[item.category_name, item.brand].filter(Boolean).join(" - ")}
        </span>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onChange} className="shrink-0">
        Change
      </Button>
    </div>
  );
}
