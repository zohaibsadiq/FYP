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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAskToBorrow } from "@/hooks/use-friends";
import { getErrorMessage } from "@/lib/api";
import type { GarmentToBorrow } from "@/types/friends";

function isoDay(offset: number): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return day.toISOString().slice(0, 10);
}

/**
 * Asking a friend for something of theirs.
 *
 * Both dates are required. Without a day to give it back there is nothing to
 * remind anybody about, and borrowed things quietly become kept things.
 */
export function BorrowDialog({
  item,
  friendName,
  onClose,
  onSent,
}: {
  item: GarmentToBorrow | null;
  friendName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [from, setFrom] = useState(isoDay(0));
  const [until, setUntil] = useState(isoDay(7));
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const askToBorrow = useAskToBorrow();

  function send() {
    if (!item) return;
    setProblem("");
    askToBorrow.mutate(
      { itemId: item.id, borrow_from: from, borrow_until: until, message },
      {
        onSuccess: () => {
          setMessage("");
          onSent();
        },
        onError: (error) => setProblem(getErrorMessage(error, "That did not send. Try again.")),
      },
    );
  }

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            Ask to borrow
          </DialogTitle>
          <DialogDescription>
            {item ? `${item.name} from ${friendName}. They can say yes or no.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="borrow-from">From</Label>
              <Input
                id="borrow-from"
                type="date"
                value={from}
                min={isoDay(0)}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borrow-until">Give it back by</Label>
              <Input
                id="borrow-until"
                type="date"
                value={until}
                min={from}
                onChange={(event) => setUntil(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="borrow-message">Say why, if you like</Label>
            <Textarea
              id="borrow-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="For a wedding on Saturday."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Do not put your phone number here. You already know each other.
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

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={send}
              disabled={askToBorrow.isPending || !from || !until}
              className="h-11 flex-1 shadow-lg shadow-primary/20"
            >
              {askToBorrow.isPending ? "Asking..." : "Ask"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="h-11 flex-1">
              Not now
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            What happens next: they say yes or no. After a yes it counts as lent out until
            the day you give it back.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
