"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useForgetWear, useItemWears, useRecordWear } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import { friendlyDay, spanInWords, todayIso } from "@/lib/dates";
import type { Garment } from "@/types/wardrobe";

/** Every day this item was worn, newest first, with a way to add a past day. */
export function WearHistory({ item }: { item: Garment }) {
  const { data: log, isPending, isError } = useItemWears(item.id);
  const record = useRecordWear();
  const forget = useForgetWear();

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");

  const busy = record.isPending || forget.isPending;

  function addPastDay(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");

    record.mutate(
      { id: item.id, date, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`Saved. You wore this on ${friendlyDay(date).toLowerCase()}.`);
          setAdding(false);
          setNote("");
          setDate(todayIso());
        },
        onError: (error) =>
          setProblem(getErrorMessage(error, "That day could not be saved. Try another one.")),
      },
    );
  }

  function removeDay(day: string) {
    forget.mutate(
      { id: item.id, date: day },
      {
        onSuccess: () => toast.success("Taken off the record."),
        onError: (error) =>
          toast.error(getErrorMessage(error, "That day could not be removed.")),
      },
    );
  }

  return (
    <section aria-labelledby="wear-history-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wear-history-heading" className="font-display text-xl font-semibold tracking-tight">
            When you wore it
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.wear_count === 0
              ? "Nothing recorded yet. Tap the button above on a day you wear it."
              : item.days_since_worn === null
                ? `${item.wear_count} ${item.wear_count === 1 ? "day" : "days"} recorded`
                : `${item.wear_count} ${item.wear_count === 1 ? "day" : "days"} recorded, last worn ${
                    item.days_since_worn === 0 ? "today" : `${spanInWords(item.days_since_worn)} ago`
                  }`}
          </p>
        </div>

        {!adding ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding(true)}
            className="h-10 gap-2 rounded-full px-4"
          >
            <CalendarPlus className="size-4" aria-hidden />
            I wore it on another day
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={addPastDay}
          className="animate-in fade-in slide-in-from-bottom-1 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 duration-300 sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wear-date" className="mb-2 block">
                Which day?
              </Label>
              <Input
                id="wear-date"
                type="date"
                value={date}
                max={todayIso()}
                required
                onChange={(event) => setDate(event.target.value)}
                aria-describedby={problem ? "wear-problem" : "wear-date-hint"}
                aria-invalid={problem ? true : undefined}
                className="h-11 bg-card"
              />
              <p id="wear-date-hint" className="mt-1 text-xs text-muted-foreground">
                A day that has already passed.
              </p>
            </div>

            <div>
              <Label htmlFor="wear-note" className="mb-2 block">
                What was the occasion? <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="wear-note"
                value={note}
                maxLength={200}
                placeholder="A wedding, office, Eid"
                onChange={(event) => setNote(event.target.value)}
                className="h-11 bg-card"
              />
            </div>
          </div>

          {problem ? (
            <p id="wear-problem" role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className="h-11 gap-2 px-5">
              {record.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save this day
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setProblem("");
              }}
              className="h-11 px-5"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          The history could not be loaded just now.
        </p>
      ) : isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
        </div>
      ) : log.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Once you start recording the days you wear this, they show up here, newest first.
        </p>
      ) : (
        <ol className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          {log.map((wear, index) => (
            <li key={wear.id} className="relative flex items-start gap-4 pb-4 last:pb-0">
              {/* A thin line joins each day to the next one down. */}
              {index < log.length - 1 ? (
                <span aria-hidden className="absolute bottom-0 left-[0.4rem] top-5 w-px bg-border" />
              ) : null}
              <span
                aria-hidden
                className="relative mt-1.5 size-3.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15"
              />

              <div className="min-w-0 flex-1">
                <p className="font-medium">{friendlyDay(wear.worn_on)}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {wear.note ? wear.note : wear.worn_on}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() => removeDay(wear.worn_on)}
                className="-mt-1 size-10 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
              >
                <Undo2 className="size-4" aria-hidden />
                <span className="sr-only">
                  Remove {friendlyDay(wear.worn_on)} from the record
                </span>
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
