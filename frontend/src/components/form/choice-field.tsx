"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Choice = { value: string; label: string };

type ChoiceFieldProps = {
  id: string;
  label: string;
  choices: Choice[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Resting text while nothing is picked. A clearLabel takes its place. */
  placeholder?: string;
  /** Adds a row that puts the answer back to nothing. Leave out on a required field. */
  clearLabel?: string;
  hint?: string;
  error?: string;
  emptyLabel?: string;
  disabled?: boolean;
};

export function ChoiceField({
  id,
  label,
  choices,
  value,
  onChange,
  placeholder = "Choose one",
  clearLabel,
  hint,
  error,
  emptyLabel = "There is nothing to choose from yet",
  disabled,
}: ChoiceFieldProps) {
  // The dropdown finds the label for the chosen value by looking it up in this
  // list. Without the list it would print the raw value, so a storage place
  // would show as "14" instead of "Drawer 2". The entry with a null value is
  // the "clear" row, and it also takes the place of the placeholder text.
  const items = clearLabel ? [{ value: null, label: clearLabel }, ...choices] : choices;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const isEmpty = choices.length === 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <Select
        items={items}
        value={value}
        onValueChange={(next) => onChange(next ?? null)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {clearLabel ? <SelectItem value={null}>{clearLabel}</SelectItem> : null}

          {isEmpty && !clearLabel ? (
            <SelectItem value="" disabled>
              {emptyLabel}
            </SelectItem>
          ) : null}

          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
