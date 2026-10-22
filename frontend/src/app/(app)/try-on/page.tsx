"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ImagePlus, Scan, Shirt, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { BodyPhotoCard } from "@/components/tryon/body-photo-card";
import { TryOnCard } from "@/components/tryon/tryon-card";
import { UploadGarmentDialog } from "@/components/tryon/upload-garment-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAskForTryOn,
  useDeleteTryOn,
  useTryOnAvailability,
  useTryOnUpload,
  useTryOns,
} from "@/hooks/use-tryon";
import { useGarments } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WEARABLE_SLOTS } from "@/types/tryon";
import type { GarmentListItem } from "@/types/wardrobe";

export default function TryOnPage() {
  const { data: availability, isPending: availabilityLoading } = useTryOnAvailability();
  const { data: pictures, isPending: picturesLoading } = useTryOns();
  const { data: closet } = useGarments({});

  const ask = useAskForTryOn();
  const askWithUpload = useTryOnUpload();
  const remove = useDeleteTryOn();
  const [uploading, setUploading] = useState(false);

  const ready = Boolean(availability?.has_body_photo);
  // Only the slots the supplier can draw, and only things still in the closet.
  const wearable = (closet?.results ?? []).filter(
    (item: GarmentListItem) =>
      item.display_image_url &&
      (WEARABLE_SLOTS as readonly string[]).includes(item.category_slot),
  );

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Try It On</h1>
        <p className="mt-2 text-muted-foreground">
          See a piece from your closet drawn onto a photo of you, before you decide
          what to wear.
        </p>
      </div>

      {availabilityLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : !availability?.available ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Try It On is switched off at the moment. Everything else in the app works
            as normal.
          </span>
        </p>
      ) : null}

      <BodyPhotoCard />

      {ready && availability?.available ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Pick something to try</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {availability.left_today} of {availability.daily_limit} left today
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setUploading(true)}
              disabled={availability.left_today === 0}
              className="h-11 gap-2"
            >
              <ImagePlus className="size-4" aria-hidden />
              Upload a photo instead
            </Button>
          </div>

          {availability.left_today === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              That is all for today. Come back tomorrow.
            </p>
          ) : wearable.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Shirt className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-medium">Nothing here can be drawn on yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Tops, bottoms, outerwear and full outfits work. Shoes, bags and watches
                cannot be drawn onto a photo.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={() => setUploading(true)} className="h-11 gap-2">
                  <ImagePlus className="size-4" aria-hidden />
                  Upload a photo instead
                </Button>
                <Link
                  href="/closet/add"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11")}
                >
                  Add an item
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {wearable.map((item: GarmentListItem) => (
                <li key={item.id}>
                  <GarmentChoice
                    item={item}
                    busy={ask.isPending}
                    onPick={(chosen) =>
                      ask.mutate(chosen.id, {
                        onSuccess: () =>
                          toast.success("Started. It takes a few minutes."),
                        onError: complain,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Your pictures</h2>

        {picturesLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : (pictures ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">No pictures yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {ready
                ? "Pick something above and it will appear here."
                : "Add a photo of yourself to get started."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(pictures ?? []).map((picture) => (
              <li key={picture.id}>
                <TryOnCard
                  picture={picture}
                  busy={remove.isPending}
                  onDelete={(chosen) =>
                    remove.mutate(chosen.id, {
                      onSuccess: () => toast.success("Deleted."),
                      onError: complain,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <UploadGarmentDialog
        open={uploading}
        onOpenChange={setUploading}
        busy={askWithUpload.isPending}
        onSubmit={({ file, slot, saveAs }, onFailure) =>
          askWithUpload.mutate(
            { file, slot, saveAs },
            {
              onSuccess: () => {
                setUploading(false);
                toast.success(
                  saveAs
                    ? `Started, and ${saveAs} is now in your closet.`
                    : "Started. It takes a few minutes.",
                );
              },
              onError: (error) =>
                onFailure(getErrorMessage(error, "That did not work. Try again.")),
            },
          )
        }
      />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Scan className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          These pictures are a guide to how something looks, not how it fits. Check the
          size before buying anything.
        </span>
      </p>
    </div>
  );
}

function GarmentChoice({
  item,
  busy,
  onPick,
}: {
  item: GarmentListItem;
  busy?: boolean;
  onPick: (item: GarmentListItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      disabled={busy}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary focus-visible:border-primary disabled:opacity-60"
    >
      <span className="relative block aspect-square bg-muted/40">
        {item.display_image_url ? (
          <Image
            src={item.display_image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, 33vw"
            className="object-contain p-2"
          />
        ) : null}
      </span>
      <span className="block min-h-11 px-2 py-2 text-xs leading-snug">
        <span className="line-clamp-2 font-medium">{item.name}</span>
      </span>
    </button>
  );
}
