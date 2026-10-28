"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ItemPicker } from "@/components/planner/item-picker";
import { HistoryButton, WearHistoryDialog } from "@/components/wardrobe/wear-history-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import {
  useConfirmWorn,
  useDeletePlan,
  usePlanForDay,
  useSavePlan,
} from "@/hooks/use-planner";
import { getErrorMessage } from "@/lib/api";
import { daysAgo, friendlyDay, parseDay, spanInWords } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { lastWorn, lastWornSentence } from "@/lib/wear";
import type { PlannedOutfit } from "@/types/planner";

const MAX_ITEMS = 12;

/** "Today", "In 3 days", "2 weeks ago": how far the day is from now. */
function distance(date: string): string {
  const gap = daysAgo(date);
  if (gap === 0) return "Today";
  if (gap === -1) return "Tomorrow";
  if (gap === 1) return "Yesterday";
  return gap < 0 ? `In ${spanInWords(-gap)}` : `${spanInWords(gap)} ago`;
}

/** One day of the calendar: what is planned for it, or the form to plan it. */
export function DayPlan({ date }: { date: string }) {
  const { data: plan, isPending } = usePlanForDay(date);
  const [editing, setEditing] = useState(false);

  // Moving to another day closes whatever form was open on the last one.
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) {
    setLastDate(date);
    setEditing(false);
  }

  const longForm = parseDay(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const status = isPending ? null : plan ? (plan.is_confirmed ? "Already worn" : "Planned") : "Free day";

  return (
    <section aria-labelledby="day-plan-heading">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-card to-chart-4/10 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">{distance(date)}</p>
            <h2
              id="day-plan-heading"
              className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {longForm}
            </h2>
          </div>

          {status ? (
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                status === "Already worn" && "border-primary/30 bg-primary/10 text-primary",
                status === "Planned" && "border-border bg-card",
                status === "Free day" && "border-dashed border-border bg-card text-muted-foreground",
              )}
            >
              {status === "Already worn" ? <Check className="size-3.5" aria-hidden /> : null}
              {status}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isPending ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : editing || !plan ? (
          <PlanForm
            date={date}
            plan={plan ?? null}
            onDone={() => setEditing(false)}
            onCancel={plan ? () => setEditing(false) : undefined}
          />
        ) : (
          <PlanView plan={plan} onEdit={() => setEditing(true)} />
        )}
      </div>
    </section>
  );
}

function PlanView({ plan, onEdit }: { plan: PlannedOutfit; onEdit: () => void }) {
  const confirm = useConfirmWorn();
  const remove = useDeletePlan();
  const [confirming, setConfirming] = useState(false);
  const [showingHistoryFor, setShowingHistoryFor] = useState<number | null>(null);

  const inThePast = daysAgo(plan.planned_for) >= 0;
  const openHistoryFor = plan.item_details.find((item) => item.id === showingHistoryFor);

  return (
    <div className="space-y-5">
      {plan.label || plan.note ? (
        <div>
          {plan.label ? (
            <p className="font-display text-xl font-semibold tracking-tight">{plan.label}</p>
          ) : null}
          {plan.note ? <p className="mt-1 text-sm text-muted-foreground">{plan.note}</p> : null}
        </div>
      ) : null}

      {plan.is_confirmed ? (
        <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <Check className="size-4" aria-hidden />
          You wore this. It is on the record.
        </p>
      ) : null}

      {plan.item_details.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          This day is marked, but nothing is picked out for it yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {plan.item_details.map((item, index) => {
            const worn = lastWorn(item);
            return (
              <li
                key={item.id}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-col overflow-hidden rounded-2xl border border-border bg-card duration-500 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
              >
                <Link href={`/closet/${item.id}`} className="block">
                  <span className="relative block aspect-square bg-gradient-to-b from-muted/80 to-muted/20">
                    <GarmentPicture
                      src={item.display_image_url}
                      sizes="(max-width: 640px) 50vw, 200px"
                      className="p-3"
                      iconClassName="size-8"
                    />
                  </span>
                  <span className="block px-3 pt-3">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        worn.recent ? "text-amber-700" : "text-muted-foreground",
                      )}
                    >
                      {lastWornSentence(worn)}
                    </span>
                  </span>
                </Link>

                <div className="px-2 pb-2 pt-1">
                  <HistoryButton
                    onClick={() => setShowingHistoryFor(item.id)}
                    className="h-8 w-full justify-start px-2 text-xs text-muted-foreground"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {inThePast && !plan.is_confirmed && plan.item_details.length > 0 ? (
          <Button
            type="button"
            disabled={confirm.isPending}
            onClick={() =>
              confirm.mutate(plan.id, {
                onSuccess: (result) =>
                  toast.success(
                    result.recorded === 0
                      ? "Already on the record."
                      : `Saved. ${result.recorded} ${
                          result.recorded === 1 ? "thing" : "things"
                        } added to what you have worn.`,
                  ),
                onError: (error) =>
                  toast.error(getErrorMessage(error, "That could not be recorded.")),
              })
            }
            className="h-11 gap-2 px-5 shadow-lg shadow-primary/20"
          >
            {confirm.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            <Check className="size-4" aria-hidden />
            I wore this
          </Button>
        ) : null}

        <Button type="button" variant="outline" onClick={onEdit} className="h-11 gap-2 px-5">
          <Pencil className="size-4" aria-hidden />
          Change it
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="h-11 gap-2 px-4 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Clear this day
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {friendlyDay(plan.planned_for).toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              The plan goes, and the day becomes free again. Your clothes stay in the closet, and
              anything already recorded as worn stays on the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(plan.id, {
                  onSuccess: () => toast.success("That day is free again."),
                  onError: (error) =>
                    toast.error(getErrorMessage(error, "That could not be cleared.")),
                })
              }
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Yes, clear it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {openHistoryFor ? (
        <WearHistoryDialog
          item={openHistoryFor}
          open
          onOpenChange={(next) => {
            if (!next) setShowingHistoryFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PlanForm({
  date,
  plan,
  onDone,
  onCancel,
}: {
  date: string;
  plan: PlannedOutfit | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const save = useSavePlan();
  const [label, setLabel] = useState(plan?.label ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [items, setItems] = useState<number[]>(plan?.items ?? []);
  const [problem, setProblem] = useState("");

  // Nothing to save until the day has something on it. An always-visible Save
  // button on an empty form invites a tap that does nothing useful.
  const hasSomething = items.length > 0 || label.trim().length > 0 || note.trim().length > 0;
  const changed =
    !plan ||
    label.trim() !== plan.label ||
    note.trim() !== plan.note ||
    items.length !== plan.items.length ||
    items.some((id, index) => id !== plan.items[index]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");

    save.mutate(
      { id: plan?.id, planned_for: date, label: label.trim(), note: note.trim(), items },
      {
        onSuccess: () => {
          toast.success(plan ? "That day is updated." : `Saved for ${friendlyDay(date).toLowerCase()}.`);
          onDone();
        },
        onError: (error) =>
          setProblem(getErrorMessage(error, "That could not be saved. Try again.")),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="plan-label" className="mb-2 block">
            What is the day? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="plan-label"
            value={label}
            maxLength={80}
            placeholder="A wedding, office, Eid"
            onChange={(event) => setLabel(event.target.value)}
            className="h-11"
          />
        </div>

        <div>
          <Label htmlFor="plan-note" className="mb-2 block">
            Anything to remember? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="plan-note"
            value={note}
            maxLength={200}
            placeholder="Leaving at six"
            onChange={(event) => setNote(event.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-lg font-semibold tracking-tight">Pick what you will wear</p>
        <ItemPicker
          chosen={items}
          onChange={setItems}
          max={MAX_ITEMS}
          known={plan?.item_details ?? []}
        />
      </div>

      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {hasSomething && changed ? (
          <Button
            type="submit"
            disabled={save.isPending}
            className="h-11 gap-2 px-5 shadow-lg shadow-primary/20"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarPlus className="size-4" aria-hidden />
            )}
            {plan ? "Save changes" : "Save this day"}
          </Button>
        ) : (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            {hasSomething
              ? "Nothing has changed yet."
              : "Pick something to wear, or write what the day is, and a save button appears here."}
          </p>
        )}

        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={onCancel}
            className="h-11 px-5"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
