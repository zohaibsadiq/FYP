"use client";

import { GARMENT_SHAPES, SHAPE_CUTS, SHAPE_LINES } from "./garment-shapes";
import { cn } from "@/lib/utils";
import { SLOTS, SLOT_LABELS, type Category, type Slot } from "@/types/wardrobe";

function Silhouette({ slot }: { slot: Slot }) {
  return (
    <svg viewBox="0 0 100 100" role="presentation" className="size-12">
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
        <path d={SHAPE_CUTS[slot]} fill="none" strokeWidth="3" className="stroke-card" />
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
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {available.map((slot) => {
        const selected = value === slot;
        return (
          <li key={slot}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(slot)}
              className={cn(
                "flex size-full min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 bg-card p-3 text-center transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected
                  ? "border-primary text-primary"
                  : "border-border text-foreground/70 hover:border-primary/40",
              )}
            >
              <Silhouette slot={slot} />
              <span className="text-sm font-medium text-foreground">{SLOT_LABELS[slot]}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {examples.get(slot)?.join(", ")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
