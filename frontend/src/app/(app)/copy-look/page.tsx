"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Shirt, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCopyLook } from "@/hooks/use-look";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { lastWorn, lastWornSentence } from "@/lib/wear";
import type { LookPart, LookResult } from "@/types/look";

const MAX_MB = 12;

export default function CopyLookPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const copy = useCopyLook();

  const [result, setResult] = useState<LookResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState("");

  function handleFile(file: File) {
    setProblem("");
    setResult(null);

    if (file.size > MAX_MB * 1024 * 1024) {
      setProblem(`That photo is larger than ${MAX_MB} MB. Try a smaller one.`);
      return;
    }

    setProgress(0);
    copy.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: setResult,
        onError: (error) =>
          setProblem(getErrorMessage(error, "That photo could not be read. Try another one.")),
      },
    );
  }

  function startOver() {
    setResult(null);
    setProblem("");
    setProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Copy a look</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Seen an outfit you like? Put the photo here and we will show you what in your own
          closet comes closest to it, and what you are missing.
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {!result && !copy.isPending ? (
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            className="h-32 w-full flex-col gap-2 border-dashed"
          >
            <Camera className="size-8" aria-hidden />
            <span className="text-base font-medium">Take or choose a photo</span>
            <span className="text-xs font-normal text-muted-foreground">
              JPG or PNG, up to {MAX_MB} MB
            </span>
          </Button>

          <div className="rounded-xl border border-border p-4">
            <p className="font-medium">What works best</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>A photo from head to feet, with the whole outfit showing.</li>
              <li>One person, standing, facing the camera.</li>
              <li>A plain wall behind them, so the clothes stand out.</li>
              <li>A photo of a single garment works too, on its own.</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Your photo is read and thrown away. Nothing is saved.
            </p>
          </div>
        </div>
      ) : null}

      {copy.isPending ? (
        <div className="space-y-3 rounded-xl border border-border p-6 text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-primary" aria-hidden />
          <p className="font-medium">Reading the outfit</p>
          <p className="text-sm text-muted-foreground">
            The first one takes longer while the picture is separated from its background.
          </p>
          <Progress value={progress} className="mx-auto max-w-sm" />
          <p className="sr-only" aria-live="polite">
            Uploading, {progress} percent
          </p>
        </div>
      ) : null}

      {problem ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {problem}
        </p>
      ) : null}

      {result ? <Result result={result} onStartOver={startOver} /> : null}
    </div>
  );
}

function Result({ result, onStartOver }: { result: LookResult; onStartOver: () => void }) {
  const unreadable = result.code !== "";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {result.preview ? (
          <figure className="space-y-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/40">
              {/* A data URI from the answer itself, so next/image is not involved. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.preview} alt="" className="size-full object-contain" />
            </div>
            <figcaption className="text-xs text-muted-foreground">The photo you sent</figcaption>
          </figure>
        ) : null}

        <div className="space-y-4">
          {unreadable ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/40">
              <p className="font-medium">That photo could not be read</p>
              <p className="mt-1 text-sm">{result.note}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-muted-foreground">
                  How close you can get with what you own
                </p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tabular-nums">{result.how_close}%</span>
                  <span className="text-lg">{result.verdict}</span>
                </p>
              </div>

              <Progress value={result.how_close} />

              <p className="text-sm text-muted-foreground">{result.note}</p>
            </>
          )}

          <Button type="button" variant="outline" onClick={onStartOver} className="h-11 gap-2 px-5">
            <RotateCcw className="size-4" aria-hidden />
            Try another photo
          </Button>
        </div>
      </div>

      {result.parts.map((part) => (
        <Part key={part.slot || "single"} part={part} />
      ))}
    </div>
  );
}

function Part({ part }: { part: LookPart }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <span
            className="size-5 shrink-0 rounded border border-border"
            style={{ backgroundColor: part.hex }}
            aria-hidden
          />
          {part.slot_label}
          <span className="font-normal text-muted-foreground">{part.color_name}</span>
        </h2>

        {!part.missing ? (
          <p className="text-sm text-muted-foreground">
            Closest you own: <span className="font-medium text-foreground">{part.best_score}%</span>
          </p>
        ) : null}
      </div>

      {part.missing ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4">
          <Sparkles className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-48 flex-1 text-sm text-muted-foreground">
            You have nothing in {part.color_name.toLowerCase()} for this. Adding one would complete
            the look.
          </p>
          <Link
            href="/closet/add"
            className="text-sm font-medium text-primary hover:underline"
          >
            Add something
          </Link>
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {part.matches.map((match) => {
            const worn = lastWorn(match.item);
            return (
              <li key={match.item.id}>
                <Link
                  href={`/closet/${match.item.id}`}
                  className="flex h-full items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {match.item.display_image_url ? (
                      <Image
                        src={match.item.display_image_url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <Shirt className="size-5 text-muted-foreground" aria-hidden />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{match.item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lastWornSentence(worn)}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span
                      className={cn(
                        "block text-sm font-semibold tabular-nums",
                        match.score >= 70 ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {match.score}%
                    </span>
                    <span className="block text-xs text-muted-foreground">{match.verdict}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
