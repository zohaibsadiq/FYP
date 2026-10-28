"use client";

import { Check, Mail, Phone, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Enquiry } from "@/types/market";

/**
 * One request to buy, seen from either side.
 *
 * The contact block only appears when the server sends one, and the server
 * only sends one on a request the seller has accepted. Nothing here decides
 * that; the screen simply shows what it was given.
 */
export function EnquiryCard({
  enquiry,
  side,
  onAccept,
  onDecline,
  onWithdraw,
  busy,
}: {
  enquiry: Enquiry;
  side: "buyer" | "seller";
  onAccept?: (enquiry: Enquiry) => void;
  onDecline?: (enquiry: Enquiry) => void;
  onWithdraw?: (enquiry: Enquiry) => void;
  busy?: boolean;
}) {
  const item = enquiry.listing.item;
  const waiting = enquiry.status === "SENT";
  const agreed = enquiry.status === "ACCEPTED";
  const other = side === "seller" ? enquiry.buyer : enquiry.listing.seller;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        agreed ? "border-primary/30" : "border-border",
      )}
    >
      <div className="flex gap-4">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-muted/80 to-muted/20">
          <GarmentPicture src={item.display_image_url} sizes="64px" className="p-1" iconClassName="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{item.name}</span>
            <Badge variant={agreed ? "default" : "secondary"}>{enquiry.status_label}</Badge>
          </p>

          <p className="font-display text-lg font-semibold tabular-nums tracking-tight">
            {money(enquiry.listing.asking_price, enquiry.listing.currency)}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {side === "seller" ? "Asked by" : "Sold by"} {other.display_name}
            {other.city ? `, ${other.city}` : ""}
          </p>

          {enquiry.message ? (
            <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">{enquiry.message}</p>
          ) : null}
        </div>
      </div>

      {enquiry.contact ? <ContactBlock enquiry={enquiry} /> : null}

      {waiting ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            {side === "seller" ? (
              <>
                <Button
                  type="button"
                  onClick={() => onAccept?.(enquiry)}
                  disabled={busy}
                  className="h-11 flex-1 gap-2 shadow-md shadow-primary/20"
                >
                  <Check className="size-4" aria-hidden />
                  Yes, deal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDecline?.(enquiry)}
                  disabled={busy}
                  className="h-11 flex-1 gap-2"
                >
                  <X className="size-4" aria-hidden />
                  No thanks
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onWithdraw?.(enquiry)}
                disabled={busy}
                className="h-11 w-full"
              >
                Change my mind
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {side === "seller"
              ? "Say yes and you both see each other's details, so you can arrange the handover."
              : "The seller has not answered yet. You can take the request back at any time."}
          </p>
        </div>
      ) : null}
    </article>
  );
}

/** How to reach the other person. Only ever rendered when the server sent it. */
function ContactBlock({ enquiry }: { enquiry: Enquiry }) {
  const contact = enquiry.contact!;

  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check className="size-4 text-primary" aria-hidden />
        You both agreed. Here is how to reach them.
      </p>
      <p className="mt-1 text-sm">{contact.name}{contact.city ? `, ${contact.city}` : ""}</p>

      <ul className="mt-2 space-y-1 text-sm">
        {contact.phone ? (
          <li className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`tel:${contact.phone}`} className="font-medium hover:underline">
              {contact.phone}
            </a>
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <a href={`mailto:${contact.email}`} className="break-all font-medium hover:underline">
            {contact.email}
          </a>
        </li>
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">
        Pay each other directly. This app never handles money, so meet somewhere public
        and check the item before you pay.
      </p>
    </div>
  );
}
