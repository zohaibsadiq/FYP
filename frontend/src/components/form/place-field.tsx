"use client";

import { useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { canHoldMorePlaces, type StorageLocation } from "@/types/wardrobe";

const CREATE = "__new_place__";

type Option = {
  value: string;
  label: string;
  note?: string;
  disabled?: boolean;
};

type PlaceFieldProps = {
  id: string;
  label: string;
  places: StorageLocation[];
  value: string | null;
  onChange: (value: string | null) => void;
  onCreate: (name: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  creating?: boolean;
  /** Hides places that have no room left inside them. */
  mustHoldAnother?: boolean;
  /** Keeps a place from being offered as somewhere to put itself. */
  excludeId?: number | null;
};

export function PlaceField({
  id,
  label,
  places,
  value,
  onChange,
  onCreate,
  placeholder = "Type a name, or pick one below",
  hint,
  error,
  creating = false,
  mustHoldAnother = false,
  excludeId = null,
}: PlaceFieldProps) {
  const options = useMemo<Option[]>(
    () =>
      places
        .filter((place) => place.id !== excludeId)
        .map((place) => {
          const full = mustHoldAnother && !canHoldMorePlaces(place.depth);
          return {
            value: String(place.id),
            label: place.full_path,
            disabled: full,
            note: full ? "full, nothing else fits inside" : undefined,
          };
        }),
    [places, mustHoldAnother, excludeId],
  );

  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  const [query, setQuery] = useState(selectedLabel);
  const typed = query.trim();
  const alreadyThere =
    typed !== "" &&
    places.some(
      (place) =>
        place.name.toLowerCase() === typed.toLowerCase() ||
        place.full_path.toLowerCase() === typed.toLowerCase(),
    );

  const shown = useMemo<Option[]>(
    () =>
      typed !== "" && !alreadyThere
        ? [...options, { value: CREATE, label: `Add "${typed}" as a new place` }]
        : options,
    [options, typed, alreadyThere],
  );

  // Combobox.Item carries the id while the list filters and renders the trail,
  // so the collection has to say which part of an option is which.
  const items = useMemo(
    () =>
      Combobox.createItems(shown, {
        getValue: (option: Option) => option.value,
        getLabel: (option: Option) => option.label,
      }),
    [shown],
  );

  // The box shows the chosen trail. A place created from inside the list
  // arrives as a new value rather than a click, and would otherwise leave the
  // "Add ..." text sitting in the input. Adjusted during render rather than in
  // an effect so the input never paints the stale text first.
  const [lastSelectedLabel, setLastSelectedLabel] = useState(selectedLabel);
  if (lastSelectedLabel !== selectedLabel) {
    setLastSelectedLabel(selectedLabel);
    setQuery(selectedLabel);
  }

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <Combobox.Root
        items={items}
        value={value}
        inputValue={query}
        onInputValueChange={setQuery}
        onValueChange={(next) => {
          if (next === CREATE) {
            onCreate(typed);
            return;
          }
          onChange(next ?? null);
        }}
        onOpenChange={(open) => {
          if (!open) setQuery(selectedLabel);
        }}
      >
        <Combobox.InputGroup
          className={cn(
            "flex h-11 w-full items-center rounded-lg border border-input bg-transparent pr-1 pl-3.5",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            error && "border-destructive ring-3 ring-destructive/20",
          )}
        >
          <Combobox.Input
            id={id}
            placeholder={placeholder}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />

          {creating ? (
            <span className="flex size-9 items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="sr-only">Adding the place</span>
            </span>
          ) : (
            <Combobox.Clear
              aria-label={`Clear ${label}`}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </Combobox.Clear>
          )}

          <Combobox.Trigger
            aria-label="Show the list of places"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-4" aria-hidden />
          </Combobox.Trigger>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="isolate z-50">
            <Combobox.Popup className="max-h-(--available-height) w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                Type a name to add your first place.
              </Combobox.Empty>

              <Combobox.List>
                {(option: Option) => (
                  <Combobox.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="grid min-h-11 grid-cols-[1.25rem_1fr] items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {option.value === CREATE ? (
                      <Plus className="col-start-1 size-4 text-primary" aria-hidden />
                    ) : (
                      <Combobox.ItemIndicator className="col-start-1">
                        <Check className="size-4" aria-hidden />
                      </Combobox.ItemIndicator>
                    )}

                    <span className="col-start-2 py-2">
                      {option.label}
                      {option.note ? (
                        <span className="block text-xs text-muted-foreground">{option.note}</span>
                      ) : null}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
