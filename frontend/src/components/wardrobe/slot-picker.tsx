"use client";

import { Check } from "lucide-react";

import { GARMENT_SHAPES, SHAPE_CUTS, SHAPE_LINES } from "./garment-shapes";
import { cn } from "@/lib/utils";
import { SLOTS, SLOT_LABELS, type Category, type Slot } from "@/types/wardrobe";

function Silhouette({ slot, cut }: { slot: Slot; cut: string }) {
  return (
    <svg viewBox="0 0 100 100" role="presentation" className="size-9">
      <path d={GARMENT_SHAPES[slot]} fill="currentColor" />
      {SHAPE_LINES[slot] ? (
        <path
          d={SHAPE_LINES[slot]}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ) : null}
      {SHAPE_CUTS[slot] ? (
        <path d={SHAPE_CUTS[slot]} fill="none" strokeWidth="3" className={cut} />
      ) : null}
    </svg>
  );
}

export function SlotPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: Slot | null;
  onChange: (slot: Slot) => void;
}) {
  // Examples come from the categories themselves, so the tile never promises
  // something the next question cannot offer.
  const examples = new Map<Slot, string[]>();
  for (const category of categories) {
    const list = examples.get(category.slot) ?? [];
    if (list.length < 3) list.push(category.name);
    examples.set(category.slot, list);
  }

  const available = SLOTS.filter((slot) => examples.has(slot));

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {available.map((slot) => {
        const selected = value === slot;
        return (
          <li key={slot}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(slot)}
              className={cn(
                "group relative flex size-full min-h-36 flex-col items-center justify-start gap-2 rounded-2xl border-2 bg-card p-3 text-center transition-all duration-300",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10",
                selected
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/40",
              )}
            >
              {selected ? (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-200">
                  <Check className="size-3" aria-hidden />
                </span>
              ) : null}

              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-full transition-colors duration-300",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Silhouette slot={slot} cut={selected ? "stroke-primary" : "stroke-muted"} />
              </span>

              <span className="text-sm font-semibold text-foreground">{SLOT_LABELS[slot]}</span>
              <span className="min-h-8 text-xs leading-snug text-muted-foreground">
                {examples.get(slot)?.join(", ")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
