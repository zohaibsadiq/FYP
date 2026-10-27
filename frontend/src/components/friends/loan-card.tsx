"use client";

import { Check, Clock, Undo2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { friendlyDay } from "@/lib/dates";
import type { Loan } from "@/types/friends";

/**
 * Renders `their_name`, the viewer's own label for the other side, rather than
 * the account's display name, so two identical names stay distinguishable.
 */
export function LoanCard({
  loan,
  side,
  busy,
  onAgree,
  onDecline,
  onReturned,
  onCancel,
}: {
  loan: Loan;
  side: "lender" | "borrower";
  busy?: boolean;
  onAgree?: (loan: Loan) => void;
  onDecline?: (loan: Loan) => void;
  onReturned?: (loan: Loan) => void;
  onCancel?: (loan: Loan) => void;
}) {
  const waiting = loan.status === "ASKED";
  const out = loan.status === "AGREED";

  return (
    <article className="rounded-xl border border-border p-3">
      <div className="flex gap-3">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          <GarmentPicture src={loan.item.display_image_url} sizes="64px" className="p-1" iconClassName="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{loan.item.name}</span>
            <Badge variant={out ? "default" : "secondary"}>{loan.status_label}</Badge>
            {loan.is_overdue ? (
              <Badge variant="destructive" className="gap-1">
                <Clock className="size-3" aria-hidden />
                {loan.days_late} {loan.days_late === 1 ? "day" : "days"} late
              </Badge>
            ) : null}
          </p>

          <p className="text-sm text-muted-foreground">
            {side === "lender" ? `${loan.their_name} wants it` : `From ${loan.their_name}`}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {friendlyDay(loan.borrow_from)} until {friendlyDay(loan.borrow_until)}
          </p>

          {loan.message ? (
            <p className="mt-2 rounded-lg bg-muted/60 p-2 text-sm">{loan.message}</p>
          ) : null}
        </div>
      </div>

      {side === "lender" && waiting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => onAgree?.(loan)}
            disabled={busy}
            className="h-11 flex-1 gap-2"
          >
            <Check className="size-4" aria-hidden />
            Yes, lend it
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onDecline?.(loan)}
            disabled={busy}
            className="h-11 flex-1 gap-2"
          >
            <X className="size-4" aria-hidden />
            Not this time
          </Button>
        </div>
      ) : null}

      {side === "lender" && out ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onReturned?.(loan)}
          disabled={busy}
          className="mt-3 h-11 w-full gap-2"
        >
          <Undo2 className="size-4" aria-hidden />
          I got it back
        </Button>
      ) : null}

      {side === "borrower" && waiting ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onCancel?.(loan)}
          disabled={busy}
          className="mt-3 h-11 w-full"
        >
          I changed my mind
        </Button>
      ) : null}
    </article>
  );
}
