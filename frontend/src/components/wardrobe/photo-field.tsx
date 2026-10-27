"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { PhotoGuide } from "@/components/wardrobe/photo-guide";
import { useDiscardUpload, useUploadGarmentImage } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import type { ImageUploadResult, Slot } from "@/types/wardrobe";

const MAX_MB = 12;

interface Props {
  /** The picture already saved on the item, if any. Shown until a new one is chosen. */
  current?: string;
  /** A photo uploaded in this session and not yet saved on the item. */
  uploaded: ImageUploadResult | null;
  /** True once the person has asked for the saved picture to go when they save. */
  removed?: boolean;
  onUploaded: (result: ImageUploadResult | null) => void;
  onRemoved?: (removed: boolean) => void;
  /** Reports while a photo is being sent, so the form's Save button can wait. */
  onBusyChange?: (busy: boolean) => void;
  /** Shows the photo guide for this sort of thing before a photo is chosen. */
  slot?: Slot | null;
  /** Puts focus on the first button, for when the photo is the reason the form opened. */
  autoFocus?: boolean;
}

/**
 * Choosing, replacing or removing a garment's photo. Used when adding an item
 * and when changing one, so both places behave the same way.
 *
 * The photo is sent as soon as it is chosen, so the cutout appears while the
 * rest of the form is still being filled in. Nothing is saved on the item
 * until the form's own Save button.
 */
export function PhotoField({
  current = "",
  uploaded,
  removed = false,
  onUploaded,
  onRemoved,
  onBusyChange,
  slot = null,
  autoFocus,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const firstButton = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState("");

  const upload = useUploadGarmentImage();
  const discard = useDiscardUpload();

  useEffect(() => {
    if (autoFocus) firstButton.current?.focus();
  }, [autoFocus]);

  // The preview is the browser's own copy of the chosen file. The memory it
  // borrows is given back once the preview is no longer on screen.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  // Nothing waits on this. A photo left behind on the image host costs
  // storage rather than breaking anything.
  function letGo(previous: ImageUploadResult | null) {
    if (!previous) return;
    discard.mutate([previous.original_image_public_id, previous.clean_image_public_id]);
  }

  function choose() {
    fileInput.current?.click();
  }

  function handleFile(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setProblem(`That photo is too big. Please pick one under ${MAX_MB} MB.`);
      return;
    }
    letGo(uploaded);
    onUploaded(null);
    onRemoved?.(false);
    setProblem("");
    setProgress(0);
    setPreview(URL.createObjectURL(file));
    onBusyChange?.(true);

    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (result) => {
          onUploaded(result);
          if (result.warning) toast.warning(result.warning);
          else toast.success("Background removed.");
        },
        onError: (e) => {
          setPreview("");
          setProblem(getErrorMessage(e, "That photo could not be used. Please try another one."));
        },
        onSettled: () => onBusyChange?.(false),
      },
    );
  }

  function startAgain() {
    letGo(uploaded);
    onUploaded(null);
    setPreview("");
    setProblem("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const detected = uploaded?.detected.primary_color_name;

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {problem ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          {problem}
        </p>
      ) : null}

      {preview ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <figure>
            <figcaption className="mb-2 text-xs font-medium text-muted-foreground">Your photo</figcaption>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
              {/* The browser's own copy of the file, so next/image is not involved. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="size-full object-contain" />
            </div>
          </figure>

          <figure>
            <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
              Background removed
            </figcaption>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
              {upload.isPending ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                  <p aria-live="polite" className="text-xs text-muted-foreground">
                    {progress < 100
                      ? `Sending your photo, ${progress}%`
                      : "Cutting out the background. This takes a few seconds."}
                  </p>
                </div>
              ) : uploaded ? (
                <Image
                  src={uploaded.clean_image_url}
                  alt="The item with its background removed"
                  fill
                  sizes="(max-width: 640px) 100vw, 300px"
                  className="object-contain p-2"
                />
              ) : null}
            </div>
          </figure>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="button" variant="outline" onClick={startAgain} className="h-11 gap-2">
              <Upload className="size-4" aria-hidden />
              Use a different photo
            </Button>

            {detected ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  aria-hidden
                  className="size-4 rounded border border-border"
                  style={{ background: uploaded?.detected.primary_color_hex }}
                />
                We think this is {detected.toLowerCase()}
              </p>
            ) : null}
          </div>
        </div>
      ) : current && !removed ? (
        <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
            <GarmentPicture src={current} alt="The photo saved now" sizes="160px" className="p-2" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button ref={firstButton} type="button" variant="outline" onClick={choose} className="h-11 gap-2">
              <Camera className="size-4" aria-hidden />
              Change photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemoved?.(true)}
              className="h-11 gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Remove photo
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {slot ? <PhotoGuide slot={slot} /> : null}

          {current && removed ? (
            <p className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
              The photo will be removed when you save.
              <Button type="button" variant="outline" size="sm" onClick={() => onRemoved?.(false)} className="h-9 gap-2">
                <Undo2 className="size-4" aria-hidden />
                Keep it
              </Button>
            </p>
          ) : null}

          <Button
            ref={firstButton}
            type="button"
            variant="outline"
            onClick={choose}
            className="h-28 w-full flex-col gap-2 border-dashed"
          >
            <Camera className="size-7" aria-hidden />
            <span className="text-base font-medium">Take or choose a photo</span>
            <span className="text-xs font-normal text-muted-foreground">
              JPG or PNG, up to {MAX_MB} MB
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
