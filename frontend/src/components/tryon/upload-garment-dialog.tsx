"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, TriangleAlert, WandSparkles } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { UPLOAD_SLOTS, type UploadSlot } from "@/types/tryon";

/**
 * A garment that is not in the closet.
 *
 * The part of the body has to be asked for here, because nothing is known
 * about a bare photograph. Sent as the wrong one, a kurta is drawn onto the
 * legs. Closet garments skip this question: their category already answers it.
 */
export function UploadGarmentDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (
    payload: { file: File; slot: UploadSlot; saveAs: string },
    onFailure: (message: string) => void,
  ) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [slot, setSlot] = useState<UploadSlot | "">("");
  const [keep, setKeep] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");

  // The preview address is worked out from the chosen file rather than stored
  // separately. The browser lends memory for it, and the cleanup below gives
  // that memory back once the preview is no longer on screen.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function close() {
    setFile(null);
    setSlot("");
    setKeep(false);
    setName("");
    setProblem("");
    onOpenChange(false);
  }

  const ready = Boolean(file) && slot !== "" && (!keep || name.trim().length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            Try on a photo
          </DialogTitle>
          <DialogDescription>
            A picture of a garment, from a shop page or your own camera. It does not
            have to be in your closet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="garment-file">The garment</Label>
            <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-3">
              <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card shadow-sm">
                {preview ? (
                  <Image src={preview} alt="" fill sizes="80px" className="object-contain p-1" />
                ) : (
                  <ImagePlus className="size-6 text-primary" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  className="h-10 rounded-full px-4"
                >
                  {file ? "Choose a different one" : "Choose a picture"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  A plain background works best. A shop&apos;s own product photo is ideal.
                </p>
              </div>
            </div>
            <input
              ref={fileInput}
              id="garment-file"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                setProblem("");
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Where is it worn?</legend>
            <p className="text-xs text-muted-foreground">
              Needed because the picture alone does not say. Your closet items
              answer this on their own.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {UPLOAD_SLOTS.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setSlot(choice.value)}
                  aria-pressed={slot === choice.value}
                  className={cn(
                    "h-10 rounded-full border px-4 text-sm font-medium transition-all duration-200",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    slot === choice.value
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 rounded-2xl border border-border p-3">
            <button
              type="button"
              onClick={() => setKeep(!keep)}
              aria-pressed={keep}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium">Keep it in my closet</span>
                <span className="block text-xs text-muted-foreground">
                  {keep
                    ? "It becomes a normal item you can wear, plan and lend."
                    : "Off. The picture is used once and not saved as an item."}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200",
                  keep ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "block size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                    keep && "translate-x-5",
                  )}
                />
              </span>
            </button>

            {keep ? (
              <div className="animate-in fade-in slide-in-from-top-1 space-y-1.5 pt-1 duration-200">
                <Label htmlFor="garment-name">What is it called?</Label>
                <Input
                  id="garment-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Blue embroidered kurta"
                  maxLength={120}
                />
              </div>
            ) : null}
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
              onClick={() => {
                if (!file || slot === "") return;
                setProblem("");
                onSubmit({ file, slot, saveAs: keep ? name.trim() : "" }, (message) =>
                  setProblem(message),
                );
              }}
              disabled={!ready || busy}
              className="h-11 flex-1 gap-2 shadow-lg shadow-primary/20"
            >
              <WandSparkles className="size-4" aria-hidden />
              {busy ? "Starting..." : "Try it on"}
            </Button>
            <Button type="button" variant="outline" onClick={close} className="h-11 flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
