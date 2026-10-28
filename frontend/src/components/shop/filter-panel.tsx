"use client";

import { RotateCcw } from "lucide-react";

import { ChoiceField } from "@/components/form/choice-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/money";
import type { DealFilters, Facet, FilterOptions } from "@/types/shopping";
import type { Slot } from "@/types/wardrobe";

const DISCOUNT_STEPS = [
  { value: "20", label: "20% off or more" },
  { value: "30", label: "30% off or more" },
  { value: "50", label: "Half price or better" },
  { value: "70", label: "70% off or more" },
];

interface FilterPanelProps {
  filters: DealFilters;
  options?: FilterOptions;
  onChange: (patch: Partial<DealFilters>) => void;
  onClear: () => void;
  /** How many filters are on, so the reset button can say what it will undo. */
  activeCount: number;
}

function asChoices(facets: Facet[] = []) {
  return facets.map((facet) => ({
    value: facet.value,
    label: `${facet.label} (${facet.count})`,
  }));
}

/** Every way of narrowing the sales, in three short groups. */
export function FilterPanel({
  filters,
  options,
  onChange,
  onClear,
  activeCount,
}: FilterPanelProps) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="font-display text-base font-semibold tracking-tight">
          Price
        </legend>

        <SwitchRow
          id="on-sale"
          label="Only reduced things"
          checked={Boolean(filters.on_sale)}
          onChange={(on_sale) => onChange({ on_sale })}
        />

        <SwitchRow
          id="just-dropped"
          label="Price dropped this week"
          checked={Boolean(filters.just_dropped)}
          onChange={(just_dropped) => onChange({ just_dropped })}
        />

        <ChoiceField
          id="min-discount"
          label="How big a cut"
          choices={DISCOUNT_STEPS}
          clearLabel="Any"
          value={filters.min_discount ? String(filters.min_discount) : null}
          onChange={(value) =>
            onChange({ min_discount: value ? Number(value) : undefined })
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="min-price">Lowest</Label>
            <Input
              id="min-price"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={options ? String(options.price_floor) : "0"}
              value={filters.min_price ?? ""}
              onChange={(event) =>
                onChange({
                  min_price: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-price">Highest</Label>
            <Input
              id="max-price"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={options ? String(options.price_ceiling) : "Any"}
              value={filters.max_price ?? ""}
              onChange={(event) =>
                onChange({
                  max_price: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </div>

        {options ? (
          <p className="text-xs text-muted-foreground">
            Prices run from {money(options.price_floor)} to{" "}
            {money(options.price_ceiling)}.
          </p>
        ) : null}
      </fieldset>

      {/* The line sits on a wrapper, not the fieldset: a fieldset draws its
          heading into its own border, which would cut the line in half. */}
      <div className="border-t border-border pt-5">
        <fieldset className="space-y-4">
          <legend className="font-display text-base font-semibold tracking-tight">
            What it is
          </legend>

          <ChoiceField
            id="filter-slot"
            label="Where it is worn"
            choices={asChoices(options?.slots)}
            clearLabel="Anywhere"
            value={filters.slot || null}
            onChange={(value) =>
              onChange({ slot: (value as Slot) ?? undefined })
            }
          />

          <ChoiceField
            id="filter-category"
            label="Kind"
            choices={asChoices(options?.categories)}
            clearLabel="Any kind"
            value={filters.category ?? null}
            onChange={(category) =>
              onChange({ category: category ?? undefined })
            }
          />

          <ChoiceField
            id="filter-color"
            label="Colour"
            choices={asChoices(options?.colors)}
            clearLabel="Any colour"
            value={filters.color ?? null}
            onChange={(color) => onChange({ color: color ?? undefined })}
          />

          <ChoiceField
            id="filter-size"
            label="Size"
            choices={asChoices(options?.sizes)}
            clearLabel="Any size"
            value={filters.size ?? null}
            onChange={(size) => onChange({ size: size ?? undefined })}
          />
        </fieldset>
      </div>

      <div className="border-t border-border pt-5">
        <fieldset className="space-y-4">
          <legend className="font-display text-base font-semibold tracking-tight">
            Where from
          </legend>

          <ChoiceField
            id="filter-shop"
            label="Shop"
            choices={asChoices(options?.shops)}
            clearLabel="All shops"
            value={filters.shop ?? null}
            onChange={(shop) => onChange({ shop: shop ?? undefined })}
          />

          <SwitchRow
            id="in-stock"
            label="Leave out sold out things"
            checked={Boolean(filters.in_stock)}
            onChange={(in_stock) => onChange({ in_stock })}
          />
        </fieldset>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onClear}
        disabled={activeCount === 0}
        className="h-11 w-full gap-2 rounded-full"
      >
        <RotateCcw className="size-4" aria-hidden />
        {activeCount === 0
          ? "No filters are on"
          : `Clear ${activeCount} ${activeCount === 1 ? "filter" : "filters"}`}
      </Button>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint ? (
          <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}
