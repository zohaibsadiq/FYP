"use client";

import Image from "next/image";
import { Download, Loader2, Shirt, Trash2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TryOn } from "@/types/tryon";

/**
 * One generated picture. A waiting one keeps the garment on screen so the row
 * does not change size when the result lands, and because a person waiting
 * three minutes should still be able to see what they asked for.
 */
export function TryOnCard({
  picture,
  busy,
  onDelete,
}: {
  picture: TryOn;
  busy?: boolean;
  onDelete: (picture: TryOn) => void;
}) {
  const waiting = picture.status === "PENDING";
  const failed = picture.status === "FAILED";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[3/4] bg-muted/40">
        {picture.status === "READY" && picture.result_url ? (
          <Image
            src={picture.result_url}
            alt={`You wearing ${picture.garment_name}`}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            {waiting ? (
              <>
                <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">Drawing it on you</span>
                <span className="text-xs text-muted-foreground">
                  This takes two to four minutes. Leave the page open or come back later.
                </span>
              </>
            ) : failed ? (
              <>
                <TriangleAlert className="size-7 text-destructive" aria-hidden />
                <span className="text-sm leading-snug text-muted-foreground">
                  {picture.error || "That did not work."}
                </span>
              </>
            ) : (
              <Shirt className="size-8 text-muted-foreground" aria-hidden />
            )}
          </span>
        )}

        {waiting ? (
          <Badge variant="secondary" className="absolute left-2 top-2">
            Working on it
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate font-medium">{picture.garment_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {picture.garment_slot_label}
        </p>

        <div className="mt-3 flex gap-2">
          {picture.status === "READY" && picture.result_url ? (
            <a
              href={picture.result_url}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
            >
              <Download className="size-4" aria-hidden />
              Save
            </a>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={() => onDelete(picture)}
            disabled={busy}
            className="h-11 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className={picture.status === "READY" ? "sr-only" : ""}>Delete</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
