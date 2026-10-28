"use client";

import Image from "next/image";
import { Download, Loader2, Shirt, Sparkles, Trash2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TryOn } from "@/types/tryon";

/**
 * One generated picture. A waiting one keeps the garment faintly on screen so
 * the card does not change size when the result lands, and because a person
 * waiting three minutes should still be able to see what they asked for.
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
  const ready = picture.status === "READY" && Boolean(picture.result_url);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative aspect-3/4 overflow-hidden bg-gradient-to-b from-muted/80 to-muted/20">
        {ready ? (
          <Image
            src={picture.result_url}
            alt={`You wearing ${picture.garment_name}`}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <>
            {picture.garment_image_url ? (
              <Image
                src={picture.garment_image_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className={cn("object-contain p-6", waiting ? "opacity-30" : "opacity-15")}
              />
            ) : null}

            {waiting ? (
              <span
                aria-hidden
                className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-card/80 to-transparent"
              />
            ) : null}

            <span className="relative flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              {waiting ? (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-card shadow-md">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">Drawing it on you</span>
                  <span className="text-xs text-muted-foreground">
                    This takes two to four minutes. Leave the page open or come back later.
                  </span>
                </>
              ) : failed ? (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <TriangleAlert className="size-6" aria-hidden />
                  </span>
                  <span className="text-sm leading-snug text-muted-foreground">
                    {picture.error || "That did not work."}
                  </span>
                </>
              ) : (
                <Shirt className="size-8 text-muted-foreground" aria-hidden />
              )}
            </span>
          </>
        )}

        {waiting ? (
          <Badge variant="secondary" className="absolute left-2 top-2 gap-1 shadow-sm">
            <Sparkles className="size-3" aria-hidden />
            Working on it
          </Badge>
        ) : null}

        {ready ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
            <Sparkles className="size-3 text-primary" aria-hidden />
            {picture.status_label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold">{picture.garment_name}</p>
        <p className="truncate text-xs text-muted-foreground">{picture.garment_slot_label}</p>

        <div className="mt-3 flex gap-2">
          {ready ? (
            <a
              href={picture.result_url}
              download
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-9 flex-1 gap-2")}
            >
              <Download className="size-4" aria-hidden />
              Save
            </a>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(picture)}
            disabled={busy}
            className={cn(
              "h-9 gap-2 text-destructive hover:text-destructive",
              ready ? "px-2.5" : "flex-1",
            )}
          >
            <Trash2 className="size-4" aria-hidden />
            <span className={ready ? "sr-only" : ""}>Delete</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
