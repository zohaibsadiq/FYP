"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Check, Loader2, Pencil, Shirt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ItemPicker } from "@/components/planner/item-picker";
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
import {
  useConfirmWorn,
  useDeletePlan,
  usePlanForDay,
  useSavePlan,
} from "@/hooks/use-planner";
import { getErrorMessage } from "@/lib/api";
import { daysAgo, friendlyDay, parseDay } from "@/lib/dates";
import type { PlannedOutfit } from "@/types/planner";

const MAX_ITEMS = 12;

export function DayPlan({ date }: { date: string }) {
  const { data: plan, isPending } = usePlanForDay(date);
  const [editing, setEditing] = useState(false);

  // Moving to another day closes whatever form was open on the last one.
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) {
    setLastDate(date);
    setEditing(false);
  }

  const longForm = parseDay(date).toDateString();

  return (
    <section aria-labelledby="day-plan-heading" className="space-y-4">
      <div>
        <h2 id="day-plan-heading" className="text-lg font-semibold">
          {friendlyDay(date)}
        </h2>
        <p className="text-sm text-muted-foreground">{longForm}</p>
      </div>

      {isPending ? (
        <Skeleton className="h-40 rounded-xl" />
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
    </section>
  );
}

function PlanView({ plan, onEdit }: { plan: PlannedOutfit; onEdit: () => void }) {
  const confirm = useConfirmWorn();
  const remove = useDeletePlan();
  const [confirming, setConfirming] = useState(false);

  const inThePast = daysAgo(plan.planned_for) >= 0;

  return (
    <div className="space-y-4">
      {plan.label ? <p className="text-base font-medium">{plan.label}</p> : null}
      {plan.note ? <p className="text-sm text-muted-foreground">{plan.note}</p> : null}

      {plan.is_confirmed ? (
        <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          <Check className="size-4" aria-hidden />
          You wore this. It is on the record.
        </p>
      ) : null}

      {plan.item_details.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          This day is marked, but nothing is picked out for it yet.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {plan.item_details.map((item) => (
            <li key={item.id}>
              <Link
                href={`/closet/${item.id}`}
                className="flex aspect-square flex-col items-center justify-end gap-1 rounded-xl border border-border p-2 text-center transition-colors hover:border-primary hover:bg-accent"
              >
                <span className="relative flex w-full flex-1 items-center justify-center overflow-hidden">
                  {item.display_image_url ? (
                    <Image
                      src={item.display_image_url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 30vw, 120px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <Shirt className="size-7 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="line-clamp-2 text-xs leading-tight">{item.name}</span>
              </Link>
            </li>
          ))}
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
            className="h-11 gap-2 px-5"
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
    <form onSubmit={submit} className="space-y-5">
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
        <p className="mb-3 font-medium">Pick what you will wear</p>
        <ItemPicker chosen={items} onChange={setItems} max={MAX_ITEMS} />
      </div>

      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending} className="h-11 gap-2 px-5">
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CalendarPlus className="size-4" aria-hidden />
          )}
          {plan ? "Save changes" : "Save this day"}
        </Button>

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
