"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

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
import { useEnquire } from "@/hooks/use-market";
import { getErrorMessage } from "@/lib/api";
import { money } from "@/lib/money";
import type { Listing } from "@/types/market";

/** Asking a seller for something. A message is optional; asking is the point. */
export function EnquiryDialog({
  listing,
  onClose,
  onSent,
}: {
  listing: Listing | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const enquire = useEnquire();

  function send() {
    if (!listing) return;
    setProblem("");
    enquire.mutate(
      { listing: listing.id, message },
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

  return (
    <Dialog open={listing !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask to buy</DialogTitle>
          <DialogDescription>
            {listing
              ? `${listing.item.name} for ${money(listing.asking_price, listing.currency)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="enquiry-message">Say something (optional)</Label>
            <Textarea
              id="enquiry-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Is this still available?"
            />
            <p className="text-xs text-muted-foreground">
              Do not put your phone number here. If they say yes, you will both see each
              other&apos;s details straight away.
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
            onClick={send}
            disabled={enquire.isPending}
            className="h-11 w-full"
          >
            {enquire.isPending ? "Sending..." : "Send the request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
