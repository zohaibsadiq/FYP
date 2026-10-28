"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Images,
  Scan,
  Shirt,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { BodyPhotoCard } from "@/components/tryon/body-photo-card";
import { TryOnCard } from "@/components/tryon/tryon-card";
import { UploadGarmentDialog } from "@/components/tryon/upload-garment-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GARMENT_SHAPES } from "@/components/wardrobe/garment-shapes";
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
import { WEARABLE_SLOTS, type TryOn, type TryOnAvailability } from "@/types/tryon";
import { SLOT_LABELS, type GarmentListItem, type Slot } from "@/types/wardrobe";

const HOW_IT_WORKS = [
  {
    icon: Camera,
    title: "Add one photo of yourself",
    body: "Full length, facing the camera, on a plain background.",
  },
  {
    icon: Shirt,
    title: "Pick something to try",
    body: "A top, bottoms, outerwear or a full outfit from your closet, or a photo from a shop.",
  },
  {
    icon: Sparkles,
    title: "See it on you",
    body: "The picture is drawn in two to four minutes and kept here for you.",
  },
];

export default function TryOnPage() {
  const { data: availability, isPending: availabilityLoading } = useTryOnAvailability();
  const { data: pictures, isPending: picturesLoading } = useTryOns();
  const { data: closet } = useGarments({});

  const ask = useAskForTryOn();
  const askWithUpload = useTryOnUpload();
  const remove = useDeleteTryOn();
  const [uploading, setUploading] = useState(false);

  const ready = Boolean(availability?.has_body_photo);
  const on = Boolean(availability?.available);
  // Only the slots the supplier can draw, and only things still in the closet.
  const wearable = (closet?.results ?? []).filter(
    (item: GarmentListItem) =>
      item.display_image_url &&
      (WEARABLE_SLOTS as readonly string[]).includes(item.category_slot),
  );

  const made = pictures ?? [];
  const readyCount = made.filter((picture) => picture.status === "READY").length;
  const waitingCount = made.filter((picture) => picture.status === "PENDING").length;

  const steps = [
    { label: "Your photo", done: ready },
    { label: "Pick a garment", done: made.length > 0 },
    { label: "See it on you", done: readyCount > 0 },
  ];

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  const gallery = (
    <Gallery
      pictures={made}
      loading={picturesLoading}
      ready={ready}
      readyCount={readyCount}
      waitingCount={waitingCount}
      busy={remove.isPending}
      onDelete={(chosen) =>
        remove.mutate(chosen.id, {
          onSuccess: () => toast.success("Deleted."),
          onError: complain,
        })
      }
    />
  );

  return (
    <div className="relative mx-auto max-w-6xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-2/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">Virtual try-on</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Try It On
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            See a piece from your closet drawn onto a photo of you, before you decide
            what to wear.
          </p>
        </div>

        {on && availability ? (
          <div className="flex flex-wrap items-center gap-2">
            <LeftToday availability={availability} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setUploading(true)}
              disabled={!ready || availability.left_today === 0}
              className="h-11 gap-2 px-5"
            >
              <ImagePlus className="size-4" aria-hidden />
              Upload a photo instead
            </Button>
          </div>
        ) : null}
      </header>

      {!availabilityLoading ? <Steps steps={steps} /> : null}

      {availabilityLoading ? (
        <Skeleton className="h-16 w-full rounded-2xl" />
      ) : !on ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-chart-4/50 bg-chart-4/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            Try It On is switched off at the moment. Everything else in the app works
            as normal.
          </span>
        </p>
      ) : null}

      {ready && on && availability ? (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          {/* The photo stays in view on a wide screen while the rest scrolls. */}
          <div>
            <div className="lg:sticky lg:top-6">
              <BodyPhotoCard />
            </div>
          </div>

          <div className="space-y-8">
            <section
              aria-labelledby="pick-heading"
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both space-y-4 duration-500 [animation-delay:80ms]"
            >
              <div>
                <p className="text-sm font-medium text-primary">Step 2</p>
                <h2 id="pick-heading" className="font-display text-2xl font-semibold tracking-tight">
                  Pick something to try
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap a piece and it is drawn onto your photo.
                </p>
              </div>

              {availability.left_today === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  That is all for today. Come back tomorrow.
                </p>
              ) : wearable.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Shirt className="size-6" aria-hidden />
                  </span>
                  <p className="mt-3 font-medium">Nothing here can be drawn on yet</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Tops, bottoms, outerwear and full outfits work. Shoes, bags and watches
                    cannot be drawn onto a photo.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setUploading(true)}
                      className="h-11 gap-2 shadow-lg shadow-primary/20"
                    >
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
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {wearable.map((item: GarmentListItem, index) => (
                    <li
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                      style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
                    >
                      <GarmentChoice
                        item={item}
                        priority={index < 3}
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

            {gallery}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {!ready ? <HowItWorks /> : null}
          <BodyPhotoCard />
          {gallery}
        </div>
      )}

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

/** The three steps, with a tick on each one already done. */
function Steps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ol className="animate-in fade-in flex flex-wrap items-center gap-2 duration-500" aria-label="How far you are">
      {steps.map((step, index) => {
        const current = !step.done && steps.slice(0, index).every((earlier) => earlier.done);
        return (
          <li key={step.label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                step.done && "border-primary/30 bg-primary/10 text-primary",
                current && "border-primary bg-card shadow-md shadow-primary/10",
                !step.done && !current && "border-border bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[0.7rem] font-semibold",
                  step.done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden className="hidden h-px w-6 bg-border sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** How many pictures can still be made today, as words and a small bar. */
function LeftToday({ availability }: { availability: TryOnAvailability }) {
  const { left_today: left, daily_limit: limit } = availability;
  const share = limit > 0 ? Math.round((left / limit) * 100) : 0;
  return (
    <span className="inline-flex h-11 items-center gap-3 rounded-full border border-border bg-card px-4 text-sm">
      <span className="font-medium tabular-nums">
        {left} of {limit} left today
      </span>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${share}%` }}
        />
      </span>
    </span>
  );
}

/** What happens here, for somebody who has not added a photo yet. */
function HowItWorks() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-2/10 p-6 duration-500 [animation-delay:80ms] sm:p-8">
      <div aria-hidden className="absolute right-6 top-6 hidden gap-3 opacity-60 sm:flex">
        {(["TOP", "BOTTOM", "OUTERWEAR", "FULL_BODY"] as Slot[]).map((slot, index) => (
          <svg
            key={slot}
            viewBox="0 0 100 100"
            className="animate-float size-14"
            style={{ animationDelay: `${index * 0.7}s` }}
          >
            <path d={GARMENT_SHAPES[slot]} className={index % 2 ? "fill-chart-2/60" : "fill-primary/50"} />
          </svg>
        ))}
      </div>

      <p className="text-sm font-medium text-primary">How it works</p>
      <h2 className="mt-1 max-w-lg font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Your closet, drawn onto a photo of you
      </h2>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 font-mono text-xs text-muted-foreground">Step {index + 1}</p>
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Every picture made so far, newest first, with the ones still cooking. */
function Gallery({
  pictures,
  loading,
  ready,
  readyCount,
  waitingCount,
  busy,
  onDelete,
}: {
  pictures: TryOn[];
  loading: boolean;
  ready: boolean;
  readyCount: number;
  waitingCount: number;
  busy: boolean;
  onDelete: (picture: TryOn) => void;
}) {
  const summary =
    pictures.length === 0
      ? "Nothing made yet."
      : [
          readyCount > 0 ? `${readyCount} ready` : "",
          waitingCount > 0 ? `${waitingCount} on the way` : "",
        ]
          .filter(Boolean)
          .join(", ") || `${pictures.length} ${pictures.length === 1 ? "picture" : "pictures"}`;

  return (
    <section
      aria-labelledby="pictures-heading"
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both space-y-4 duration-500 [animation-delay:160ms]"
    >
      <div>
        <p className="text-sm font-medium text-primary">Step 3</p>
        <h2 id="pictures-heading" className="font-display text-2xl font-semibold tracking-tight">
          Your pictures
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-3/4 rounded-2xl" />
          ))}
        </div>
      ) : pictures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Images className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-medium">No pictures yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {ready
              ? "Pick something above and it will appear here."
              : "Add a photo of yourself to get started."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {pictures.map((picture, index) => (
            <li
              key={picture.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
            >
              <TryOnCard picture={picture} busy={busy} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One thing from the closet, ready to be tapped. */
function GarmentChoice({
  item,
  busy,
  priority,
  onPick,
}: {
  item: GarmentListItem;
  busy?: boolean;
  /** Loads the picture first. For the first few tiles, which are in view on arrival. */
  priority?: boolean;
  onPick: (item: GarmentListItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      disabled={busy}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <span className="relative block aspect-4/5 w-full overflow-hidden bg-gradient-to-b from-muted/80 to-muted/20">
        {item.display_image_url ? (
          <Image
            src={item.display_image_url}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 20vw, 33vw"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : null}

        <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-card/90 text-primary shadow-sm backdrop-blur">
          <WandSparkles className="size-3.5" aria-hidden />
        </span>

        {/* Slides up on hover so the tile says what a tap does. */}
        <span className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground opacity-0 shadow-lg shadow-primary/30 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <WandSparkles className="size-3.5" aria-hidden />
          Try it on
        </span>
      </span>

      <span className="block p-3">
        <span className="block truncate text-sm font-medium">{item.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {SLOT_LABELS[item.category_slot]}
        </span>
      </span>
    </button>
  );
}
