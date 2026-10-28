"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, Check, PersonStanding, ShieldCheck, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBodyPhoto, useDeleteBodyPhoto, useSaveBodyPhoto } from "@/hooks/use-tryon";
import { getErrorMessage } from "@/lib/api";

const WORKS_WELL = [
  "Stand facing the camera, head to knees in frame",
  "A plain wall behind you, nothing cluttered",
  "Good light, ideally daylight from the front",
  "Arms a little away from your body, hands visible",
];

const WORKS_BADLY = [
  "Sitting down, turned sideways, or from above",
  "A dark room, or strong light behind you",
  "A busy background with other people in it",
  "Very loose clothing that hides your shape",
];

/**
 * The photograph every generated picture is drawn onto.
 *
 * The explanation sits above the file picker rather than behind a link.
 * Asking for a full-length photograph of somebody is the point at which they
 * decide whether to trust the app, and that decision is made from whatever is
 * on screen at that moment.
 */
export function BodyPhotoCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: photo, isPending } = useBodyPhoto();
  const save = useSaveBodyPhoto();
  const remove = useDeleteBodyPhoto();

  function choose(file: File | undefined) {
    if (!file) return;
    setProblem("");
    save.mutate(file, {
      onSuccess: () => toast.success("Saved. You can change it whenever you like."),
      onError: (error) => setProblem(getErrorMessage(error, "That photo could not be saved.")),
    });
  }

  if (isPending) return <Skeleton className="h-72 w-full rounded-3xl" />;

  if (photo?.has_body_photo) {
    return (
      <section
        aria-labelledby="body-photo-heading"
        className="animate-in fade-in zoom-in-95 overflow-hidden rounded-3xl border border-border bg-card duration-500"
      >
        <div className="relative aspect-3/4 bg-gradient-to-b from-muted/80 to-muted/20">
          <Image
            src={photo.body_photo_url}
            alt="The photo of you that clothes are drawn onto"
            fill
            sizes="(max-width: 1024px) 100vw, 320px"
            className="object-cover"
          />
          <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-card/90 px-3 text-xs font-medium shadow-sm backdrop-blur">
            <Check className="size-3.5 text-primary" aria-hidden />
            Your photo is saved
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <h2 id="body-photo-heading" className="font-display text-lg font-semibold tracking-tight">
            You
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only you ever see it. It is sent away to be drawn on, and nothing else.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={save.isPending}
              className="h-10 gap-2 rounded-full px-4"
            >
              <Camera className="size-4" aria-hidden />
              {save.isPending ? "Saving..." : "Use a different photo"}
            </Button>

            {confirmingDelete ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    remove.mutate(undefined, {
                      onSuccess: () => {
                        setConfirmingDelete(false);
                        toast.success("Deleted, along with every picture made from it.");
                      },
                      onError: (error: unknown) =>
                        toast.error(getErrorMessage(error, "That did not work. Try again.")),
                    })
                  }
                  disabled={remove.isPending}
                  className="h-10 gap-2 rounded-full px-4 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Yes, delete everything
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-10 gap-2 rounded-full px-4"
                >
                  <X className="size-4" aria-hidden />
                  Keep it
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                className="h-10 gap-2 rounded-full px-4 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                Delete my photo
              </Button>
            )}
          </div>

          {confirmingDelete ? (
            <p className="mt-3 rounded-xl bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
              Deleting the photo also deletes every picture that was made from it.
            </p>
          ) : null}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="body-photo-heading"
      className="animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-3xl border border-border bg-card duration-500"
    >
      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* A dashed frame in the shape of the photo wanted: tall, one person. */}
        <div className="flex items-center justify-center bg-gradient-to-b from-primary/10 to-chart-2/10 p-6">
          <div className="flex aspect-3/4 w-full max-w-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-card/70 text-primary">
            <PersonStanding className="animate-float size-16" aria-hidden />
            <span className="mt-2 text-xs font-medium">Head to knees, facing you</span>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <h2 id="body-photo-heading" className="font-display text-2xl font-semibold tracking-tight">
            Add a photo of yourself
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your clothes get drawn onto this photo. One photo is enough, and you can
            change or delete it whenever you like.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
                Works well
              </p>
              <ul className="mt-2 space-y-1.5">
                {WORKS_WELL.map((line) => (
                  <li key={line} className="text-sm leading-snug text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <X className="size-4 shrink-0 text-destructive" aria-hidden />
                Gives a poor result
              </p>
              <ul className="mt-2 space-y-1.5">
                {WORKS_BADLY.map((line) => (
                  <li key={line} className="text-sm leading-snug text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              Before you add it
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The photo is kept on the app&apos;s picture host and sent to the company that
              draws the clothes on. It is never shown to other people, never attached to
              anything you sell or lend, and deleting it deletes every picture made from
              it. Adding a photo means you agree to that.
            </p>
          </div>

          {problem ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              {problem}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={save.isPending}
            className="mt-5 h-12 w-full gap-2 shadow-lg shadow-primary/20 sm:w-auto sm:px-8"
          >
            <Camera className="size-4" aria-hidden />
            {save.isPending ? "Saving..." : "Choose a photo and agree"}
          </Button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0])}
      />
    </section>
  );
}
