import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { GARMENT_SHAPES, SHAPE_CUTS, SHAPE_LINES } from "./garment-shapes";
import type { Slot } from "@/types/wardrobe";

const FRAME = { x: 2, y: 2, width: 96, height: 96, rx: 10 };

// A heap of clothes rather than any one garment, so it works for every slot.
const FOLDED =
  "M36 34 Q30 44 36 52 Q28 60 36 68 Q30 74 40 78 L62 78 Q72 72 66 66 Q74 58 66 50 Q73 40 64 34 Q50 28 36 34 Z";

const PAIR_LEFT = "translate(4 18.6) scale(0.55)";
const PAIR_RIGHT = "translate(44 18.6) scale(0.55)";

type WrongKind = "folded" | "single" | "far";

const GUIDE: Record<Slot, { intro: string; good: string; wrong: string; wrongKind: WrongKind }> = {
  TOP: {
    intro: "It works best when the whole thing lies flat and the surface behind it is plain.",
    good: "Flat, facing up",
    wrong: "Not folded up",
    wrongKind: "folded",
  },
  BOTTOM: {
    intro: "Lay them out lengthwise so the app can see the full shape.",
    good: "Laid out lengthwise",
    wrong: "Not folded up",
    wrongKind: "folded",
  },
  FULL_BODY: {
    intro: "Lay it out to its full length, and stand back far enough to fit all of it in.",
    good: "All of it, laid out",
    wrong: "Not folded up",
    wrongKind: "folded",
  },
  OUTERWEAR: {
    intro: "Lay it flat with the front facing up and the sleeves out to the sides.",
    good: "Flat, sleeves out",
    wrong: "Not folded up",
    wrongKind: "folded",
  },
  FOOTWEAR: {
    intro: "Put both shoes down side by side, facing the same way.",
    good: "Both shoes, side by side",
    wrong: "Not just one shoe",
    wrongKind: "single",
  },
  ACCESSORY: {
    intro: "Put it down on a plain surface and come close enough to fill the picture.",
    good: "On a plain surface",
    wrong: "Not far away",
    wrongKind: "far",
  },
  HEADWEAR: {
    intro: "Put it down on a plain surface and come close enough to fill the picture.",
    good: "On a plain surface",
    wrong: "Not far away",
    wrongKind: "far",
  },
  OTHER: {
    intro: "Put it down on a plain surface and come close enough to fill the picture.",
    good: "On a plain surface",
    wrong: "Not far away",
    wrongKind: "far",
  },
};

function Silhouette({ slot, transform }: { slot: Slot; transform?: string }) {
  return (
    <g transform={transform}>
      <path d={GARMENT_SHAPES[slot]} className="fill-foreground/80" />
      {SHAPE_LINES[slot] ? (
        <path
          d={SHAPE_LINES[slot]}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-foreground/80"
        />
      ) : null}
      {SHAPE_CUTS[slot] ? (
        <path d={SHAPE_CUTS[slot]} fill="none" strokeWidth="3" className="stroke-muted" />
      ) : null}
    </g>
  );
}

function Tile({
  slot,
  variant,
  good,
}: {
  slot: Slot;
  variant: "good" | "busy" | "wrong" | "edge";
  good?: boolean;
}) {
  const pair = slot === "FOOTWEAR";
  const { wrongKind } = GUIDE[slot];
  const clipId = `photo-guide-edge-${slot}`;

  let art: React.ReactNode;
  if (variant === "wrong" && wrongKind === "folded") {
    art = <path d={FOLDED} className="fill-foreground/80" />;
  } else if (variant === "wrong" && wrongKind === "far") {
    art = <Silhouette slot={slot} transform="translate(35 35) scale(0.3)" />;
  } else if (variant === "wrong") {
    art = <Silhouette slot={slot} />;
  } else if (variant === "edge") {
    art = (
      <g clipPath={`url(#${clipId})`}>
        {pair ? (
          <>
            <Silhouette slot={slot} transform="translate(30 18.6) scale(0.55)" />
            <Silhouette slot={slot} transform="translate(70 18.6) scale(0.55)" />
          </>
        ) : (
          <Silhouette slot={slot} transform="translate(20 -8) scale(1.15)" />
        )}
      </g>
    );
  } else if (pair) {
    art = (
      <>
        <Silhouette slot={slot} transform={PAIR_LEFT} />
        <Silhouette slot={slot} transform={PAIR_RIGHT} />
      </>
    );
  } else {
    art = <Silhouette slot={slot} />;
  }

  return (
    <svg viewBox="0 0 100 100" role="presentation" className="size-full">
      {variant === "busy" ? (
        <defs>
          <pattern
            id="photo-guide-clutter"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="14" height="14" className="fill-muted" />
            <rect width="6" height="14" className="fill-foreground/20" />
          </pattern>
        </defs>
      ) : null}

      {variant === "edge" ? (
        <clipPath id={clipId}>
          <rect {...FRAME} />
        </clipPath>
      ) : null}

      <rect
        {...FRAME}
        fill={variant === "busy" ? "url(#photo-guide-clutter)" : undefined}
        className={cn(
          "stroke-1",
          variant === "busy" ? "" : "fill-muted",
          good ? "stroke-primary/40" : "stroke-border",
        )}
      />
      {art}
    </svg>
  );
}

export function PhotoGuide({ slot }: { slot: Slot }) {
  const guide = GUIDE[slot];

  const tips = [
    { label: guide.good, good: true, variant: "good" as const },
    { label: "Not on a busy surface", good: false, variant: "busy" as const },
    { label: guide.wrong, good: false, variant: "wrong" as const },
    { label: "Not cut off at the edge", good: false, variant: "edge" as const },
  ];

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        The app cuts the background out for you. {guide.intro}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tips.map(({ label, good, variant }) => (
          <li key={label} className="space-y-2">
            <div className="relative aspect-square">
              <Tile slot={slot} variant={variant} good={good} />
              <span
                className={cn(
                  "absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full text-white",
                  good ? "bg-primary" : "bg-destructive",
                )}
              >
                {good ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                <span className="sr-only">{good ? "Do this" : "Avoid this"}</span>
              </span>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
