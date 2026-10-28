"use client";

import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBlockPerson, useReportListing } from "@/hooks/use-market";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { REPORT_REASONS, type Listing } from "@/types/market";

/**
 * Flagging a listing, and blocking the person if it comes to that.
 *
 * A report never hides anything by itself. If one report took a listing down,
 * anybody could silence anybody, so this only puts it in front of a person to
 * look at. Blocking is the part that takes effect immediately, because that is
 * the reporter's own business.
 */
export function ReportDialog({
  listing,
  onClose,
  onSent,
}: {
  listing: Listing | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const report = useReportListing();
  const block = useBlockPerson();

  function send() {
    if (!listing || !reason) return;
    setProblem("");
    report.mutate(
      { listing: listing.id, reason, note },
      {
        onSuccess: () => {
          onSent();
          onClose();
        },
        onError: (error) =>
          setProblem(getErrorMessage(error, "That could not be sent. Try again.")),
      },
    );
  }

  function blockSeller() {
    if (!listing) return;
    block.mutate(listing.seller.id, {
      onSuccess: () => {
        onSent();
        onClose();
      },
      onError: (error) => setProblem(getErrorMessage(error, "That did not work. Try again.")),
    });
  }

  return (
    <Dialog open={listing !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            Report this listing
          </DialogTitle>
          <DialogDescription>
            Somebody will look at it. Nothing is hidden automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">What is wrong with it?</legend>
            <div className="grid gap-2">
              {REPORT_REASONS.map((choice) => {
                const on = reason === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setReason(choice.value)}
                    aria-pressed={on}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-sm transition-all duration-200",
                      on
                        ? "border-primary bg-primary/5 font-medium shadow-sm"
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
                    {choice.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="report-note">Anything to add (optional)</Label>
            <Textarea
              id="report-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              rows={2}
            />
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
            onClick={send}
            disabled={!reason || report.isPending}
            className="h-11 w-full shadow-lg shadow-primary/20"
          >
            {report.isPending ? "Sending..." : "Send the report"}
          </Button>

          <div className="rounded-2xl border border-border p-4">
            <p className="text-sm font-medium">Would you rather not see them at all?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Blocking hides their things from you and yours from them, straight away.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={blockSeller}
              disabled={block.isPending}
              className="mt-3 h-11 w-full"
            >
              {block.isPending
                ? "Blocking..."
                : `Block ${listing?.seller.display_name ?? "this person"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
