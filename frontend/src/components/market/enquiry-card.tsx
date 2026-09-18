"use client";

import Image from "next/image";
import { Check, Mail, Phone, Shirt, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";
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
  const other = side === "seller" ? enquiry.buyer : enquiry.listing.seller;

  return (
    <article className="rounded-xl border border-border p-3">
      <div className="flex gap-3">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {item.display_image_url ? (
            <Image src={item.display_image_url} alt="" fill sizes="64px" className="object-contain p-1" />
          ) : (
            <Shirt className="size-5 text-muted-foreground" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{item.name}</span>
            <Badge variant={enquiry.status === "ACCEPTED" ? "default" : "secondary"}>
              {enquiry.status_label}
            </Badge>
          </p>

          <p className="text-sm tabular-nums">
            {money(enquiry.listing.asking_price, enquiry.listing.currency)}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {side === "seller" ? "Asked by" : "Sold by"} {other.display_name}
            {other.city ? `, ${other.city}` : ""}
          </p>

          {enquiry.message ? (
            <p className="mt-2 rounded-lg bg-muted/50 p-2 text-sm">{enquiry.message}</p>
          ) : null}
        </div>
      </div>

      {enquiry.contact ? <ContactBlock enquiry={enquiry} /> : null}

      {waiting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {side === "seller" ? (
            <>
              <Button
                type="button"
                onClick={() => onAccept?.(enquiry)}
                disabled={busy}
                className="h-11 flex-1 gap-2"
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
      ) : null}
    </article>
  );
}

/** How to reach the other person. Only ever rendered when the server sent it. */
function ContactBlock({ enquiry }: { enquiry: Enquiry }) {
  const contact = enquiry.contact!;

  return (
    <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-medium">You both agreed. Here is how to reach them.</p>
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
